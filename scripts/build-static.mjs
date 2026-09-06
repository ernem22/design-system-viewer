import { readdir, readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { existsSync } from "node:fs";
import { buildSystem } from "../src/core/parse.js";

const SYSTEMS_DIR = "systems";
const OUT_DIR = "dist-static";

async function main() {
  // 1. Build preview
  console.log("Preview already built via vite, copying...");

  // 2. Generate systems/index.json for static fallback
  const files = existsSync(SYSTEMS_DIR) ? (await readdir(SYSTEMS_DIR)).filter(f => f.endsWith(".json") && f !== "index.json") : [];
  const systems = [];
  for (const f of files) {
    const data = JSON.parse(await readFile(join(SYSTEMS_DIR, f), "utf8"));
    // rebuild to ensure latest schema/taxonomy
    const rebuilt = buildSystem({ name: data.name, slug: data.slug, createdAt: data.createdAt, css: data.css });
    rebuilt.updatedAt = data.updatedAt || rebuilt.updatedAt;
    systems.push(rebuilt);
  }
  systems.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  await mkdir(join(OUT_DIR, "systems"), { recursive: true });
  await writeFile(join(OUT_DIR, "systems", "index.json"), JSON.stringify(systems, null, 2));
  // also copy individual systems
  for (const s of systems) {
    await writeFile(join(OUT_DIR, "systems", `${s.slug}.json`), JSON.stringify(s, null, 2));
  }
  // also write to source for local static dev — only if systems dir exists (ignored in git)
  try {
    await mkdir(SYSTEMS_DIR, { recursive: true });
    await writeFile(join(SYSTEMS_DIR, "index.json"), JSON.stringify(systems, null, 2));
  } catch {}

  console.log(`Generated ${systems.length} systems to ${OUT_DIR}/systems` + (existsSync(SYSTEMS_DIR) ? ` and ${SYSTEMS_DIR}/index.json` : ""));
}

main().catch(e => { console.error(e); process.exit(1); });
