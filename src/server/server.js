import http from "node:http";
import { readFile, readdir, writeFile, unlink, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { buildSystem, mergeSystem, slugify } from "../core/parse.js";

// Always re-derive from CSS on read so taxonomy/schema changes propagate
// without a manual re-save. Cheap (regex parse + categorize, no I/O).
function upgrade(sys) {
  const rebuilt = buildSystem({ name: sys.name, slug: sys.slug, createdAt: sys.createdAt, css: sys.css });
  return { ...rebuilt, updatedAt: sys.updatedAt || rebuilt.updatedAt };
}

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const SYSTEMS_DIR = join(ROOT, "systems");
const PREVIEW_DIR = join(ROOT, "preview", "dist");
const PORT = process.env.PORT || 4173;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".woff2": "font/woff2",
  ".map": "application/json; charset=utf-8",
};

const json = (res, code, body) => {
  res.writeHead(code, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
};

const readBody = (req) =>
  new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (c) => {
      raw += c;
      if (raw.length > 2_000_000) reject(new Error("payload too large"));
    });
    req.on("end", () => resolve(raw));
    req.on("error", reject);
  });

async function listSystems() {
  if (!existsSync(SYSTEMS_DIR)) return [];
  // index.json is the generated static bundle of every system, not a system —
  // parsing it as one yields a bogus "untitled" entry in the picker.
  const files = (await readdir(SYSTEMS_DIR)).filter((f) => f.endsWith(".json") && f !== "index.json");
  const systems = await Promise.all(
    files.map(async (f) => upgrade(JSON.parse(await readFile(join(SYSTEMS_DIR, f), "utf8")))),
  );
  return systems.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const path = url.pathname;

  try {
    // — API
    if (path === "/api/systems" && req.method === "GET") {
      return json(res, 200, await listSystems());
    }
    if (path === "/api/systems" && req.method === "POST") {
      const { name, css, mode, slug } = JSON.parse((await readBody(req)) || "{}");
      if (!css || !String(css).trim()) return json(res, 400, { error: "css cannot be empty" });

      let system;
      if (mode === "merge") {
        const file = join(SYSTEMS_DIR, `${slugify(slug || "")}.json`);
        if (!existsSync(file)) return json(res, 404, { error: "system to merge not found" });
        system = mergeSystem(JSON.parse(await readFile(file, "utf8")), css);
      } else {
        system = buildSystem({ name, css });
        if (existsSync(join(SYSTEMS_DIR, `${system.slug}.json`)))
          return json(res, 409, { error: `"${system.slug}" already exists — use Add Tokens to merge` });
      }

      await mkdir(SYSTEMS_DIR, { recursive: true });
      await writeFile(join(SYSTEMS_DIR, `${system.slug}.json`), JSON.stringify(system, null, 2));
      return json(res, mode === "merge" ? 200 : 201, system);
    }
    if (path.startsWith("/api/systems/") && req.method === "DELETE") {
      const slug = slugify(decodeURIComponent(path.slice("/api/systems/".length)));
      const file = join(SYSTEMS_DIR, `${slug}.json`);
      if (!existsSync(file)) return json(res, 404, { error: "not found" });
      await unlink(file);
      return json(res, 200, { ok: true });
    }

    // Proxy for the "Import from URL" dialog: fetching arbitrary URLs
    // client-side fails on CORS for any host without ACAO headers.
    if (path === "/api/fetch-css" && req.method === "GET") {
      const target = url.searchParams.get("url");
      let parsed;
      try { parsed = new URL(target); } catch { return json(res, 400, { error: "invalid url" }); }
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:")
        return json(res, 400, { error: "only http/https urls are supported" });
      try {
        const r = await fetch(parsed, {
          redirect: "follow",
          headers: { "user-agent": "design-system-viewer", accept: "text/css,text/plain,*/*" },
          signal: AbortSignal.timeout(15_000),
        });
        if (!r.ok) return json(res, 502, { error: `upstream ${r.status} ${r.statusText}` });
        const text = await r.text();
        if (text.length > 2_000_000) return json(res, 502, { error: "stylesheet too large (max 2 MB)" });
        res.writeHead(200, { "content-type": "text/plain; charset=utf-8" });
        return res.end(text);
      } catch (err) {
        return json(res, 502, { error: String(err && err.message) || "fetch failed" });
      }
    }

    if (req.method !== "GET") return json(res, 405, { error: "method" });

    // favicon — no file, return 204 to avoid 404 noise
    if (path === "/favicon.ico" || path === "/design-system-viewer/favicon.ico") {
      res.writeHead(204);
      return res.end();
    }

    // — Preview app (React/Radix, built by `npm run build`)
    // Handle both local (/preview/*) and Pages (/design-system-viewer/preview/*) bases
    const isPagesPreview = path === "/design-system-viewer/preview" || path.startsWith("/design-system-viewer/preview/");
    const isLocalPreview = path === "/preview" || path.startsWith("/preview/");
    const previewBase = isPagesPreview ? "/design-system-viewer/preview/" : isLocalPreview ? "/preview/" : null;
    if (previewBase) {
      if (!existsSync(PREVIEW_DIR)) {
        res.writeHead(503, { "content-type": "text/plain; charset=utf-8" });
        return res.end("Preview not built. Run npm run build in project root");
      }
      const sub = path.replace(new RegExp(`^${previewBase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`), "") || "index.html";
      let pf = normalize(join(PREVIEW_DIR, sub));
      if (!pf.startsWith(PREVIEW_DIR)) {
        res.writeHead(404, { "content-type": "text/plain" });
        return res.end("404");
      }
      if (!existsSync(pf)) {
        if (extname(pf)) { res.writeHead(404, { "content-type": "text/plain" }); return res.end("404"); }
        pf = join(PREVIEW_DIR, "index.html"); // SPA fallback for client routes
      }
      // hashed assets are immutable; index.html must not be cached or it pins old asset hashes
      const isHtml = pf.endsWith(".html");
      res.writeHead(200, {
        "content-type": MIME[extname(pf)] || "application/octet-stream",
        "cache-control": isHtml ? "no-store" : "public, max-age=31536000, immutable",
      });
      return res.end(await readFile(pf));
    }

    // — Static files (root viewer). No bundler here, so nothing is content-hashed;
    // skip caching so edits to app.js / index.html show up on reload.
    const rel = path === "/" ? "/index.html" : path;
    const file = normalize(join(ROOT, "." + rel));
    if (!file.startsWith(ROOT) || !existsSync(file)) {
      res.writeHead(404, { "content-type": "text/plain" });
      return res.end("404");
    }
    res.writeHead(200, {
      "content-type": MIME[extname(file)] || "application/octet-stream",
      "cache-control": "no-cache",
    });
    res.end(await readFile(file));
  } catch (err) {
    json(res, 500, { error: String(err && err.message) || "error" });
  }
});

server.listen(PORT, () => {
  console.log(`Design System Viewer → http://localhost:${PORT}`);
});
