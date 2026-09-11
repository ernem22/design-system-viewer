import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import http from "node:http";
import { mkdtemp, cp, rm, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

// Copy the app to a temp dir so we can control whether preview/dist exists.
const SRC = fileURLToPath(new URL(".", import.meta.url));
let dir, proc, base;

async function startServer(port) {
  return new Promise((resolve, reject) => {
    const p = spawn(process.execPath, ["src/server/server.js"], {
      cwd: dir,
      env: { ...process.env, PORT: String(port) },
      stdio: ["ignore", "pipe", "inherit"],
    });
    p.stdout.on("data", (b) => { if (String(b).includes("http://")) resolve(p); });
    p.on("error", reject);
    setTimeout(() => reject(new Error("server start timeout")), 5000);
  });
}

before(async () => {
  dir = await mkdtemp(join(tmpdir(), "dsv-"));
  // copy server and core files preserving structure for the temp server
  await mkdir(join(dir, "src", "core"), { recursive: true });
  await mkdir(join(dir, "src", "server"), { recursive: true });
  await mkdir(join(dir, "src", "viewer"), { recursive: true });
  for (const f of ["src/server/server.js", "src/core/parse.js", "src/core/schema.js", "src/core/taxonomy.js", "src/core/contrast.js"]) {
    await cp(join(SRC, "../../", f), join(dir, f));
  }
  await cp(join(SRC, "../../index.html"), join(dir, "index.html"));
  await cp(join(SRC, "../../", "src/viewer/app.js"), join(dir, "src/viewer/app.js"));
  await mkdir(join(dir, "systems"), { recursive: true });
  const port = 4100 + Math.floor(Math.random() * 300);
  base = `http://localhost:${port}`;
  proc = await startServer(port);
});

after(async () => {
  // Windows keeps the cwd handle until the child is really gone — removing the
  // temp dir before that races into EBUSY.
  if (proc && proc.exitCode === null) {
    await new Promise((resolve) => { proc.once("exit", resolve); proc.kill(); });
  }
  if (dir) await rm(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
});

test("systems/index.json is a build artifact, not a system", async () => {
  await fetch(`${base}/api/systems`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "Real", css: "--color-bg: #fff;" }),
  });
  const all = await (await fetch(`${base}/api/systems`)).json();
  // build-static.mjs drops the bundle next to the per-system files
  await writeFile(join(dir, "systems", "index.json"), JSON.stringify(all, null, 2));

  const after = await (await fetch(`${base}/api/systems`)).json();
  assert.deepEqual(after.map((s) => s.slug), ["real"]);
});

test("/preview/ returns 503 when preview/dist is missing", async () => {
  const res = await fetch(`${base}/preview/`);
  assert.equal(res.status, 503);
  assert.match(await res.text(), /npm run build/);
});

test("/preview/ serves index.html once dist exists (SPA fallback for unknown paths)", async () => {
  await mkdir(join(dir, "preview", "dist", "assets"), { recursive: true });
  await writeFile(join(dir, "preview", "dist", "index.html"), "<!doctype html><title>preview</title>");
  await writeFile(join(dir, "preview", "dist", "assets", "app.js"), "console.log(1)");

  const idx = await fetch(`${base}/preview/`);
  assert.equal(idx.status, 200);
  assert.match(await idx.text(), /<title>preview<\/title>/);

  const asset = await fetch(`${base}/preview/assets/app.js`);
  assert.equal(asset.status, 200);
  assert.equal(asset.headers.get("content-type"), "text/javascript; charset=utf-8");

  const deep = await fetch(`${base}/preview/some/client/route`);
  assert.equal(deep.status, 200);
  assert.match(await deep.text(), /<title>preview<\/title>/);
});

test("missing /preview file with an extension is 404; extensionless client route falls back", async () => {
  assert.equal((await fetch(`${base}/preview/assets/missing-xyz.js`)).status, 404);
  const route = await fetch(`${base}/preview/settings/profile`);
  assert.equal(route.status, 200);
  assert.match(await route.text(), /<title>preview<\/title>/);
});

// Regression: importing CSS from an arbitrary URL client-side dies on CORS
// ("Fetch failed: Failed to fetch") for any host without ACAO headers. The
// dialog must route through /api/fetch-css, which has no same-origin limit.
test("/api/fetch-css proxies CSS from a host that sends no CORS headers", async () => {
  // stand up a plain CSS file server — deliberately with NO Access-Control-Allow-Origin
  let cssHits = 0;
  const cssServer = http.createServer((req, res) => {
    cssHits++;
    res.writeHead(200, { "content-type": "text/css" });
    res.end("/* tokens */\n--color-bg: #ffffff;\n--color-text: #111111;\n");
  });
  await new Promise((r) => cssServer.listen(0, "127.0.0.1", r));
  const cssPort = cssServer.address().port;

  try {
    const res = await fetch(`${base}/api/fetch-css?url=${encodeURIComponent(`http://127.0.0.1:${cssPort}/tokens.css`)}`);
    assert.equal(res.status, 200);
    assert.match(await res.text(), /--color-bg: #ffffff/);
    assert.equal(cssHits, 1, "proxy should hit the URL exactly once");
  } finally {
    await new Promise((r) => cssServer.close(r));
  }

  // bad protocol must be rejected, not fetched
  const bad = await fetch(`${base}/api/fetch-css?url=${encodeURIComponent("file:///C:/Windows/win.ini")}`);
  assert.equal(bad.status, 400);
});
