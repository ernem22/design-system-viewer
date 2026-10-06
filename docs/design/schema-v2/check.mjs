// Validates schema v2 (schema.mjs) and the Preview element map (elements.mjs), then writes
// tokens.md and elements.md. Run from the repo root:  node docs/design/schema-v2/check.mjs
// Exit 1 on any violation; the violations are printed. The rules checked are the ones stated in
// ../token-schema-v2.md §3 and §6 and ../preview-token-map.md §1.
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { TOKENS, COMPONENTS } from "./schema.mjs";
import { ELEMENTS } from "./elements.mjs";
import { RENAMED, REMOVED } from "./migration.mjs";
import { REFERENCE as V1 } from "../../../src/core/schema.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..", "..");
const errors = [];
const err = (m) => errors.push(m);

// ---------------------------------------------------------------- names and grammar
const byName = new Map();
for (const t of TOKENS) {
  if (byName.has(t.name)) err(`duplicate name ${t.name}`);
  byName.set(t.name, t);
}
const T1 = /^ref-(color|font-family|font-size|font-weight|line-height|tracking|space|radius|border-width|shadow|blur|opacity|scale|duration|easing)-[a-z0-9]+(-[a-z0-9]+)*$/;
const T2_CATS = ["color", "text", "space", "size", "radius", "border-width", "shadow", "focus", "opacity", "blur", "motion", "z", "layout", "icon"];
const COMP_NAMES = COMPONENTS.map((c) => c.name);
const STATES = ["hover", "pressed", "selected", "checked", "focus", "error", "current", "visited", "done"];
const BANNED = ["active", "muted", "main", "default"];
const SCALE = /-(2xs|xs|sm|md|lg|xl|2xl)(-|$)/;
for (const t of TOKENS) {
  const parts = t.name.split("-");
  if (t.tier === 1 && !T1.test(t.name)) err(`tier 1 grammar: ${t.name}`);
  if (t.tier === 2 && !T2_CATS.some((c) => t.name === c || t.name.startsWith(c + "-"))) err(`tier 2 must start with a category: ${t.name}`);
  if (t.tier === 2 && t.name.startsWith("ref-")) err(`tier 2 uses ref-: ${t.name}`);
  if (t.tier === 3 && !COMP_NAMES.some((c) => t.name.startsWith(c + "-"))) err(`tier 3 must start with a component: ${t.name}`);
  for (const b of BANNED) if (parts.includes(b)) err(`banned word "${b}": ${t.name}`);
  if (parts.includes("default")) err(`banned word "default" (use regular): ${t.name}`);
  if (t.tier === 3 && parts.includes("disabled")) err(`per-component disabled token (rule 1.4): ${t.name}`);
  // a state word must be the last segment
  // (index 0 is the category, e.g. the "focus" of focus-ring-width, not a state)
  STATES.forEach((s) => { const i = parts.indexOf(s, 1); if (i >= 1 && i !== parts.length - 1) err(`state "${s}" not last: ${t.name}`); });
  // a scale and a state never together
  if (STATES.includes(parts.at(-1)) && SCALE.test(t.name) && t.tier !== 1) err(`scale and state together: ${t.name}`);
  // on-* only for text/icon placed on a fill
  if (parts.includes("on") && !/^color-(text|icon)-on-/.test(t.name)) err(`"on-" outside color-text/icon-on-*: ${t.name}`);
}

// ---------------------------------------------------------------- aliases (strict, one tier down)
const refsOf = (def) => [...String(def).matchAll(/var\(--([a-z0-9-]+)\)/g)].map((m) => m[1]);
const aliasedBy = new Map(); // name -> [names whose default references it]
for (const t of TOKENS) {
  if (t.tier === 1) { if (t.def !== null) err(`tier 1 must hold a literal the user fills, not a default: ${t.name}`); continue; }
  if (t.def === null) { if (!t.core) err(`root decision not in the core: ${t.name}`); continue; }
  const refs = refsOf(t.def);
  if (!refs.length) err(`default has no var(): ${t.name} = ${t.def}`);
  if (/\d+(px|rem|ms)|#[0-9a-f]{3,8}/i.test(t.def.replace(/var\([^)]*\)/g, ""))) err(`literal unit/colour in a default: ${t.name} = ${t.def}`);
  for (const r of refs) {
    const target = byName.get(r);
    if (!target) { err(`default references an unknown name: ${t.name} -> ${r}`); continue; }
    if (target.tier !== t.tier - 1) err(`default skips or reverses a tier: ${t.name} (tier ${t.tier}) -> ${r} (tier ${target.tier})`);
    if (target.type !== t.type && !(t.type === "transition")) err(`type mismatch: ${t.name} (${t.type}) -> ${r} (${target.type})`);
    (aliasedBy.get(r) || aliasedBy.set(r, []).get(r)).push(t.name);
  }
}

// ---------------------------------------------------------------- elements
const expand = (pat, where) => {
  if (pat.endsWith("*")) {
    const pre = pat.slice(0, -1);
    const hit = TOKENS.filter((t) => t.name.startsWith(pre)).map((t) => t.name);
    if (!hit.length) err(`${where}: pattern ${pat} matches nothing`);
    return hit;
  }
  if (!byName.has(pat)) err(`${where}: unknown token ${pat}`);
  return [pat];
};
const readers = new Map(); // name -> [element labels]
for (const e of ELEMENTS) {
  const label = `${e.section} › ${e.title}`;
  e.expanded = [...new Set(e.reads.flatMap((p) => expand(p, label)))].sort();
  const live = ["keep", "change", "new"].includes(e.verdict);
  if (live && !e.expanded.length && !(e.composes && e.composes.length)) err(`${label}: a live element reads nothing`);
  if (!live && e.expanded.length) err(`${label}: a ${e.verdict} element must read nothing`);
  if (e.verdict === "merge" && !e.into) err(`${label}: merge without "into"`);
  if (e.verdict === "remove" && !e.note) err(`${label}: remove without a reason`);
  for (const c of e.composes || []) if (!COMP_NAMES.includes(c) && c !== "select") err(`${label}: composes unknown component ${c}`);
  for (const n of e.expanded) {
    if (n.startsWith("ref-") && e.section !== "Foundations") err(`${label}: reads tier 1 (${n}) outside Foundations (rule 1.6)`);
    (readers.get(n) || readers.set(n, []).get(n)).push(label);
  }
}
for (const t of TOKENS) if (!readers.has(t.name)) err(`read by no Preview element: ${t.name}`);
// every "into" target must be a live element or a section
const liveTitles = new Set(ELEMENTS.filter((e) => ["keep", "change", "new"].includes(e.verdict)).flatMap((e) => [e.title, `${e.section} › ${e.title}`]));
liveTitles.add("Prose").add("App shell").add("Data viz (screen)");
for (const e of ELEMENTS.filter((x) => x.into)) {
  const target = e.into.split(" (")[0].split(";")[0].trim();
  const ok = liveTitles.has(target) || ELEMENTS.some((x) => x.section === "Screens" && x.title === target && x.verdict === "keep");
  if (!ok) err(`${e.section} › ${e.title}: merge target "${e.into}" is not a live element`);
}

// ---------------------------------------------------------------- the element list matches the app today
const GAL = join(ROOT, "app/src/gallery/components");
const fileTitles = {};
for (const f of readdirSync(GAL).filter((f) => f.endsWith(".tsx"))) {
  const titles = [...readFileSync(join(GAL, f), "utf8").matchAll(/<Demo[^>]*title="([^"]+)"/g)].map((m) => m[1]);
  if (titles.length) fileTitles[f] = titles;
}
let demosToday = 0;
for (const [f, titles] of Object.entries(fileTitles)) {
  for (const t of titles) {
    demosToday++;
    const hits = ELEMENTS.filter((e) => e.file === f && e.title === t);
    if (hits.length !== 1) err(`demo "${t}" in ${f} is listed ${hits.length} times (must be exactly 1)`);
  }
}
for (const e of ELEMENTS.filter((e) => e.verdict !== "new" && !e.file.startsWith("screens/")))
  if (!(fileTitles[e.file] || []).includes(e.title)) err(`listed demo "${e.title}" (${e.file}) does not exist in the app`);
const screensToday = readdirSync(join(GAL, "screens")).filter((f) => f.endsWith(".tsx") && f !== "screenBits.tsx").map((f) => f.replace(".tsx", ""));
for (const s of screensToday) if (ELEMENTS.filter((e) => e.file === `screens/${s}.tsx`).length !== 1) err(`screen ${s} is not listed exactly once`);
for (const e of ELEMENTS.filter((e) => e.file.startsWith("screens/"))) if (!screensToday.includes(e.title)) err(`listed screen ${e.title} does not exist`);

// ---------------------------------------------------------------- migration: every v1 name is handled
const v1Names = V1.flatMap((g) => g.tokens.map((n) => n.replace(/^--/, "")));
for (const n of v1Names) {
  const inR = n in RENAMED, inX = n in REMOVED;
  if (inR === inX) err(`v1 ${n}: must be renamed XOR removed (renamed=${inR}, removed=${inX})`);
  if (inR && !byName.has(RENAMED[n])) err(`v1 ${n} -> ${RENAMED[n]}: target is not a v2 name`);
}
for (const n of [...Object.keys(RENAMED), ...Object.keys(REMOVED)]) if (!v1Names.includes(n)) err(`migration lists ${n}, which is not a v1 name`);

// ---------------------------------------------------------------- report
const count = (f) => TOKENS.filter(f).length;
const stats = {
  tier1: count((t) => t.tier === 1), tier2: count((t) => t.tier === 2), tier3: count((t) => t.tier === 3), total: TOKENS.length,
  core: count((t) => t.core), roots: count((t) => t.tier > 1 && t.def === null), components: COMPONENTS.length,
  demosToday, screensToday: screensToday.length,
  demosAfter: ELEMENTS.filter((e) => e.section !== "Screens" && e.section !== "Foundations" && ["keep", "change", "new"].includes(e.verdict)).length,
  foundations: ELEMENTS.filter((e) => e.section === "Foundations").length,
  screensAfter: ELEMENTS.filter((e) => e.section === "Screens" && e.verdict === "keep").length,
  v1: v1Names.length, v1Renamed: Object.keys(RENAMED).length, v1Removed: Object.keys(REMOVED).length,
  mergedOrRemoved: ELEMENTS.filter((e) => e.section !== "Screens" && ["merge", "remove"].includes(e.verdict)).length,
};

// ---------------------------------------------------------------- tokens.md
const code = (s) => "`" + s + "`";
const def = (t) => (t.def === null ? (t.tier === 1 ? "— (value)" : "**root: user fills**") : code(t.def.replace(/var\(--([a-z0-9-]+)\)/g, "$1")));
let md = `# Schema v2: every token\n\nGenerated by \`check.mjs\` from \`schema.mjs\` and \`elements.mjs\`. Do not edit by hand.\n\n`;
md += `Totals: tier 1 = ${stats.tier1}, tier 2 = ${stats.tier2}, tier 3 = ${stats.tier3}, so **${stats.total} names**.\n\n`;
md += `Required core: ${stats.core} names. These are the tier-1 ★ groups plus ${stats.roots} root decisions (tier 2 or 3 names with nothing to alias).\n\n`;
md += `Columns:\n\n`;
md += `- **Default**: the alias the schema ships, shown without \`var(--)\`.\n`;
md += `- **Read by**: the Preview elements that read the token directly.\n`;
md += `- **Aliased by**: the names whose default resolves to it.\n`;
for (const tier of [1, 2, 3]) {
  md += `\n## Tier ${tier}\n`;
  const groups = [...new Set(TOKENS.filter((t) => t.tier === tier).map((t) => t.group))];
  for (const g of groups) {
    const rows = TOKENS.filter((t) => t.tier === tier && t.group === g);
    const comp = COMPONENTS.find((c) => c.name === g);
    md += `\n### ${g} (${rows.length})${comp ? ` — covers: ${comp.covers}` : ""}\n\n| Name | $type | Default | Read by | Aliased by |\n|---|---|---|---|---|\n`;
    for (const t of rows) md += `| ${code("--" + t.name)}${t.core ? " ★" : ""} | ${t.type} | ${def(t)} | ${(readers.get(t.name) || []).join("<br>")} | ${(aliasedBy.get(t.name) || []).map(code).join(" ")} |\n`;
  }
}
writeFileSync(join(HERE, "tokens.md"), md);

// ---------------------------------------------------------------- elements.md
let em = `# Preview elements after v2: what each one reads\n\nGenerated by \`check.mjs\` from \`elements.mjs\`. Do not edit by hand.\n\n`;
em += `Today: ${stats.demosToday} demos and ${stats.screensToday} screens.\n\n`;
em += `After: ${stats.foundations} Foundations specimens, ${stats.demosAfter} component demos and ${stats.screensAfter} screens. ${stats.mergedOrRemoved} demos are merged or removed.\n`;
for (const sec of [...new Set(ELEMENTS.map((e) => e.section))]) {
  em += `\n## ${sec}\n\n| Element | Verdict | Reads | Note |\n|---|---|---|---|\n`;
  for (const e of ELEMENTS.filter((x) => x.section === sec)) {
    const note = [e.into ? `→ ${e.into}` : "", e.note || "", e.composes && e.composes.length ? `composes: ${e.composes.join(", ")}` : ""].filter(Boolean).join("; ");
    em += `| ${e.title} | ${e.verdict} | ${e.expanded.map(code).join(" ")} | ${note} |\n`;
  }
}
writeFileSync(join(HERE, "elements.md"), em);

// ---------------------------------------------------------------- migration.md
let mm = `# Migration v1 -> v2\n\nGenerated by \`check.mjs\` from \`migration.mjs\`. Do not edit by hand.\n\n`;
mm += `v1 has ${stats.v1} names: ${stats.v1Renamed} move to a v2 name and ${stats.v1Removed} are removed. Every v1 name is listed exactly once.\n`;
for (const g of V1) {
  mm += `\n## ${g.label} (v1 group \`${g.id}\`)\n\n| v1 | v2 | Reason (removed only) |\n|---|---|---|\n`;
  for (const n of g.tokens.map((x) => x.replace(/^--/, ""))) mm += `| ${code("--" + n)} | ${n in RENAMED ? code("--" + RENAMED[n]) : "removed"} | ${REMOVED[n] || ""} |\n`;
}
writeFileSync(join(HERE, "migration.md"), mm);

console.log(JSON.stringify(stats));
if (errors.length) { console.error(`\n${errors.length} violation(s):\n` + errors.map((e) => "  - " + e).join("\n")); process.exit(1); }
console.log("OK: every rule holds.");
