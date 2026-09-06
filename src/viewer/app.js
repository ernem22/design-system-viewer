import { parseTokens, lintTokens } from "../core/parse.js";
import { categorize } from "../core/taxonomy.js";
import { coverage, templateCss, REFERENCE } from "../core/schema.js";
import { contrastRatio, rating, CONTRAST_PAIRS } from "../core/contrast.js";

const $ = (id) => document.getElementById(id);
const main = $("main");
const picker = $("sysPicker");
const dlg = $("dlg");

let systems = [];
let active = new URLSearchParams(location.search).get("sys") || null;
let showMissing = true;
let schemaMode = false;
let dlgMode = "add"; // "add" | "merge"
let filter = "";
const TABS = ["system", "preview", "compare"];

// Shareable state lives in the query string; localStorage is the fallback.
const bootParams = new URLSearchParams(location.search);
let tab = TABS.includes(bootParams.get("tab"))
  ? bootParams.get("tab")
  : TABS.includes(localStorage.getItem("dsv.tab"))
    ? localStorage.getItem("dsv.tab")
    : "system";
let frameMode = null; // which URL the iframe currently holds: "preview" | "compare"
let cmpState = null; // last {cmp,v,c} pushed up from the compare iframe

function syncUrl() {
  const p = new URLSearchParams();
  if (tab !== "system") p.set("tab", tab);
  if (active) p.set("sys", active);
  if (tab === "compare" && cmpState) {
    if (cmpState.cmp) p.set("cmp", cmpState.cmp);
    if (cmpState.v && cmpState.v !== "component") p.set("cv", cmpState.v);
    if (cmpState.c && cmpState.c !== "button") p.set("cc", cmpState.c);
  }
  const qs = p.toString();
  history.replaceState(null, "", qs ? `?${qs}` : location.pathname);
}

// Seed the compare iframe from a shared link (first load only).
function cmpQuery() {
  const seed = [];
  for (const [from, to] of [["cmp", "cmp"], ["cv", "v"], ["cc", "c"]]) {
    const val = bootParams.get(from);
    if (val) seed.push(`${to}=${encodeURIComponent(val)}`);
  }
  return seed.length ? `&${seed.join("&")}` : "";
}

// ─────────────────────────────────────────────── data
const LS_KEY = "dsv.systems";
function loadFromLS() {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || "[]"); } catch { return []; }
}
function saveToLS(list) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(list)); } catch {}
}
async function load() {
  if (isStaticHost()) {
    try {
      const cached = loadFromLS();
      if (cached.length) systems = cached;
      else {
        const r = await fetch("./systems/index.json");
        systems = r.ok ? await r.json() : [];
      }
    } catch { systems = []; }
    if (!systems.some((s) => s.slug === active)) active = systems[0]?.slug ?? null;
    render();
    syncPreview();
    syncUrl();
    return;
  }
  try {
    const res = await fetch("/api/systems");
    if (!res.ok) throw new Error("no api");
    systems = await res.json();
    saveToLS(systems);
  } catch {
    try {
      const cached = loadFromLS();
      if (cached.length) systems = cached;
      else {
        const r = await fetch("./systems/index.json");
        systems = r.ok ? await r.json() : [];
      }
    } catch { systems = []; }
  }
  if (!systems.some((s) => s.slug === active)) active = systems[0]?.slug ?? null;
  render();
  syncPreview();
  syncUrl();
}

// ─────────────────────────────────────────────── tabs / preview
function activateTab(next) {
  tab = next;
  localStorage.setItem("dsv.tab", tab);
  const inFrame = tab === "preview" || tab === "compare";
  $("tabSystem").classList.toggle("active", tab === "system");
  $("tabPreview").classList.toggle("active", tab === "preview");
  $("tabCompare").classList.toggle("active", tab === "compare");
  main.hidden = inFrame;
  $("previewFrame").hidden = !inFrame;
  // keep system actions visible on all tabs — no friction
  const wrap = $("sysActionsWrap");
  if (wrap) wrap.hidden = !activeSystem();
  closeMenu();
  if (inFrame) syncPreview();
  syncUrl();
}

// The single iframe serves both the preview gallery and compare mode. Load the
// right URL when its mode changes; otherwise just message it the active slug.
function getPreviewBase() {
  // GitHub Pages serves at /design-system-viewer/, locally at /
  const base = document.baseURI.includes("/design-system-viewer/") ? "/design-system-viewer/preview/" : "/preview/";
  return base;
}
function syncPreview() {
  if (tab !== "preview" && tab !== "compare") return;
  const frame = $("previewFrame");
  const base = getPreviewBase();
  if (frameMode !== tab) {
    frame.src = tab === "compare"
      ? `${base}?mode=compare${cmpQuery()}`
      : active ? `${base}?sys=${encodeURIComponent(active)}` : base;
    frameMode = tab;
  } else if (tab === "preview") {
    frame.contentWindow?.postMessage({ type: "dsv:system", slug: active || "" }, location.origin);
  }
}

window.addEventListener("message", (e) => {
  if (e.origin !== location.origin) return;
  if (e.data?.type === "dsv:preview-ready" && tab === "preview") {
    $("previewFrame").contentWindow?.postMessage({ type: "dsv:system", slug: active || "" }, location.origin);
  }
  if (e.data?.type === "dsv:compare-state") {
    cmpState = e.data;
    if (tab === "compare") syncUrl();
  }
});

const isStaticHost = () => location.hostname.includes("github.io") || location.protocol === "file:" || !navigator.onLine;
async function postSystem(body) {
  // On Pages, don't even try the API — go straight to localStorage to avoid 405 console noise
  if (isStaticHost()) {
    const { buildSystem: bs, mergeSystem: ms } = await import("../core/parse.js");
    let list = loadFromLS();
    if (!list.length) {
      try { const r = await fetch("./systems/index.json"); if (r.ok) list = await r.json(); } catch {}
    }
    let system;
    if (body.mode === "merge") {
      const existing = list.find(s => s.slug === body.slug) || systems.find(s => s.slug === body.slug);
      if (!existing) throw new Error("system to merge not found");
      system = ms(existing, body.css);
      list = list.map(s => s.slug === system.slug ? system : s);
    } else {
      system = bs({ name: body.name, css: body.css });
      if (list.some(s => s.slug === system.slug)) throw new Error(`"${system.slug}" already exists — use Add Tokens to merge`);
      list.push(system);
    }
    saveToLS(list);
    systems = list;
    active = system.slug;
    render();
    syncPreview();
    syncUrl();
    return;
  }
  try {
    const res = await fetch("/api/systems", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error(txt || `HTTP ${res.status}`);
    }
    const data = await res.json();
    active = data.slug;
    await load();
    return;
  } catch (e) {
    const msg = String(e.message || e);
    const isStatic = msg.includes("Failed to fetch") || msg.includes("404") || msg.includes("405") || msg.includes("HTTP 4");
    if (isStatic) {
      const { buildSystem: bs, mergeSystem: ms } = await import("../core/parse.js");
      let list = loadFromLS();
      // try to populate from static if LS empty
      if (!list.length) {
        try {
          const r = await fetch("./systems/index.json");
          if (r.ok) list = await r.json();
        } catch {}
      }
      let system;
      if (body.mode === "merge") {
        const existing = list.find(s => s.slug === body.slug) || systems.find(s => s.slug === body.slug);
        if (!existing) throw new Error("system to merge not found");
        system = ms(existing, body.css);
        list = list.map(s => s.slug === system.slug ? system : s);
      } else {
        system = bs({ name: body.name, css: body.css });
        if (list.some(s => s.slug === system.slug)) throw new Error(`"${system.slug}" already exists — use Add Tokens to merge`);
        list.push(system);
      }
      saveToLS(list);
      systems = list;
      active = system.slug;
      render();
      syncPreview();
      syncUrl();
      return;
    }
    throw e;
  }
}

async function remove(slug) {
  if (isStaticHost()) {
    let list = loadFromLS();
    list = list.filter(s => s.slug !== slug);
    saveToLS(list);
    systems = list;
    active = null;
    await load();
    showToast("System deleted", "ok");
    return;
  }
  try {
    await fetch(`/api/systems/${encodeURIComponent(slug)}`, { method: "DELETE" });
  } catch {
    let list = loadFromLS();
    list = list.filter(s => s.slug !== slug);
    saveToLS(list);
    systems = list;
  }
  active = null;
  await load();
  showToast("System deleted", "ok");
}

const activeSystem = () => systems.find((s) => s.slug === active);

// ─────────────────────────────────────────────── render
function render() {
  const sys = activeSystem();

  picker.hidden = systems.length < 2;
  const wrap = $("sysActionsWrap");
  if (wrap) wrap.hidden = !sys;
  const _mb = $("mergeBtn"); if (_mb) _mb.hidden = !sys;
  const _sb = $("schemaBtn"); if (_sb) { _sb.hidden = !sys; _sb.textContent = schemaMode ? "Gallery" : "Schema"; }
  const _db = $("deleteBtn"); if (_db) _db.hidden = !sys;
  if (!picker.hidden) {
    picker.innerHTML = systems.map((s) => `<option value="${s.slug}">${esc(s.name)}</option>`).join("");
    picker.value = active;
  }

  if (!sys) {
    main.innerHTML = `<div class="empty">No systems yet.<br />Use <b>Add System</b> at top right to paste a CSS token block.</div>`;
    return;
  }

  const cov = sys.coverage ?? coverage(parseTokens(sys.css).map((t) => t.name));
  const pct = Math.round((cov.present / cov.expected) * 100);

  const d = (iso) => new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
  const updated = sys.updatedAt && sys.updatedAt !== sys.createdAt ? ` · updated ${d(sys.updatedAt)}` : "";

  const warns = sys.warnings ?? lintTokens(parseTokens(sys.css));

  main.innerHTML = `
    <div class="sys-meta"><code>${esc(sys.slug)}</code> · ${sys.tokenCount ?? "?"} tokens · added ${d(sys.createdAt)}${updated} · <span class="dim">double-click value → edit</span></div>
    ${
      warns.length
        ? `<details class="warn-row"><summary>⚠ ${warns.length} possible value issues</summary>${warns
            .map((w) => `<div><code>${esc(w.name)}: ${esc(w.value)}</code> — ${esc(w.msg)}</div>`)
            .join("")}</details>`
        : ""
    }
    <div class="toolbar">
      <span class="cov">
        <span class="bar-track"><span class="bar-fill" style="width:${pct}%"></span></span>
        <b>${cov.present}/${cov.expected}</b> schema tokens (${pct}%) ·
        <b>${cov.missing}</b> missing · <b>${cov.extraCount}</b> extra
      </span>
      <input type="search" id="tokenFilter" class="tok-filter" placeholder="Filter tokens…" value="${esc(filter)}" autocomplete="off" />
      ${
        schemaMode
          ? ""
          : `<label class="inline"><input type="checkbox" id="toggleMissing" ${showMissing ? "checked" : ""}/> Show missing</label>`
      }
      <span class="tb-spacer"></span>
      <button id="toolbarAddTokens" class="tiny" title="Add tokens to this system (PATCH)">Add tokens</button>
      <button id="toolbarSchema" class="tiny" title="Toggle schema view">${schemaMode ? "Gallery" : "Schema"}</button>
      <button id="expCss" class="tiny" title="Download active system as clean :root CSS">CSS</button>
      <button id="expJson" class="tiny" title="Download active system as JSON">JSON</button>
      <button id="toolbarDelete" class="tiny danger" title="Delete this system" style="color: var(--ui-danger); border-color: color-mix(in srgb, var(--ui-danger) 30%, transparent);">Delete</button>
    </div>
    <div id="body"></div>`;

  if (!schemaMode) {
    $("toggleMissing").addEventListener("change", (e) => {
      showMissing = e.target.checked;
      render();
    });
  }
  const paint = () => {
    const view = schemaMode ? schemaView(sys, cov) : gallery(sys, cov);
    $("body").replaceChildren(view);
    if (!schemaMode && !filter) appendContrast(sys, view);
  };
  const fi = $("tokenFilter");
  fi.addEventListener("input", (e) => {
    filter = e.target.value.trim().toLowerCase();
    paint();
  });
  fi.addEventListener("keydown", (e) => { if (e.key === "Escape") { fi.value = ""; fi.dispatchEvent(new Event("input")); } });
  $("expCss")?.addEventListener("click", () => download(`${sys.slug}.css`, systemToCss(sys), "text/css"));
  $("expJson")?.addEventListener("click", () => download(`${sys.slug}.json`, JSON.stringify(sys, null, 2), "application/json"));
  $("toolbarAddTokens")?.addEventListener("click", () => openDialog("merge"));
  $("toolbarSchema")?.addEventListener("click", () => { schemaMode = !schemaMode; render(); });
  $("toolbarDelete")?.addEventListener("click", () => { if (confirm(`Delete "${sys.name}"? This cannot be undone.`)) remove(sys.slug); });

  paint();
}

const matchTok = (name) => !filter || name.toLowerCase().includes(filter);
const valueMap = (sys) => new Map((sys.groups ? sys.groups.flatMap((g) => g.tokens) : parseTokens(sys.css)).map((t) => [t.name, t.value]));

// — Gallery view
function gallery(sys, cov) {
  const wrap = document.createElement("div");
  wrap.className = "gallery";
  // base (light) values — dark-variant overrides live in sys.themes, not here
  for (const [name, value] of valueMap(sys)) wrap.style.setProperty(name, value);

  const missingByCat = Object.fromEntries(cov.groups.map((g) => [g.id, g.missing]));
  const groups = sys.groups ?? categorize(parseTokens(sys.css));

  let shown = 0;
  for (const g of groups) {
    const tokens = g.tokens.filter((t) => matchTok(t.name));
    if (!tokens.length) continue;
    shown += tokens.length;
    wrap.appendChild(renderGroup({ ...g, tokens }, (missingByCat[g.id] || []).filter(matchTok)));
  }

  // Reference categories the system has *nothing* for yet.
  const seen = new Set(groups.map((g) => g.id));
  if (showMissing) {
    for (const rg of cov.groups) {
      if (seen.has(rg.id) || rg.present.length) continue;
      const miss = rg.missing.filter(matchTok);
      if (!miss.length) continue;
      const el = document.createElement("section");
      el.className = "group";
      el.innerHTML =
        `<h2>${esc(rg.label)}<span>0/${rg.expected}</span></h2>` +
        `<div class="missing-row">missing: ${miss.map((n) => `<code>${esc(n)}</code>`).join(" ")}</div>`;
      wrap.appendChild(el);
    }
  }
  if (filter && !shown) wrap.innerHTML = `<div class="empty">No tokens matching "<b>${esc(filter)}</b>".</div>`;
  return wrap;
}

function renderGroup(g, missing = []) {
  const el = document.createElement("section");
  el.className = "group";
  el.innerHTML = `<h2>${esc(g.label)}<span>${g.tokens.length}</span></h2>`;

  if (g.kind === "color") el.appendChild(colorGrid(g.tokens));
  else if (g.id === "font-size") el.appendChild(rows(g.tokens, typeRow));
  else if (g.id === "font-family") el.appendChild(rows(g.tokens, fontFamilyRow));
  else if (g.id === "font-weight") el.appendChild(rows(g.tokens, fontWeightRow));
  else if (g.id === "line-height") el.appendChild(rows(g.tokens, lineHeightRow));
  else if (g.id === "letter-spacing") el.appendChild(rows(g.tokens, letterSpacingRow));
  else if (g.id === "spacing" || g.id === "size" || g.id === "blur" || g.id === "border-width")
    el.appendChild(rows(g.tokens, barRow));
  else if (g.id === "radius") el.appendChild(rows(g.tokens, radiusRow));
  else if (g.kind === "shadow") el.appendChild(rows(g.tokens, shadowRow));
  else if (g.id === "duration") el.appendChild(rows(g.tokens, motionRow));
  else if (g.id === "easing") el.appendChild(rows(g.tokens, easingRow));
  else if (g.id === "opacity") el.appendChild(rows(g.tokens, opacityRow));
  else if (g.id === "z-index") el.appendChild(rows(g.tokens, numberRow));
  else if (g.id === "breakpoint") el.appendChild(rows(g.tokens, breakpointRow));
  else el.appendChild(rawTable(g.tokens));

  if (showMissing && missing.length) {
    const m = document.createElement("div");
    m.className = "missing-row";
    m.innerHTML = `missing (${missing.length}): ${missing.map((n) => `<code>${esc(n)}</code>`).join(" ")}`;
    el.appendChild(m);
  }
  return el;
}

// — Schema checklist view — schema-based, no dropdown, live coverage
function schemaView(sys, cov) {
  const have = valueMap(sys);
  const wrap = document.createElement("div");
  wrap.className = "schema-view";
  // header with system name + coverage bar
  const pct = Math.round((cov.present / cov.expected) * 100);
  const hdr = document.createElement("div");
  hdr.style.cssText = "display:flex; align-items:center; gap:12px; margin:0 0 20px; padding:12px 16px; background:var(--ui-bg-2); border:1px solid var(--ui-line); border-radius: var(--r);";
  hdr.innerHTML = `<span style="font-size:13px; font-weight:600;">${esc(sys.name)}</span><span style="font-size:12px; color:var(--ui-dim);">${esc(sys.slug)}</span><span style="margin-left:auto; font-size:12px; color:var(--ui-dim); display:flex; align-items:center; gap:8px;"><span class="bar-track" style="width:120px;"><span class="bar-fill" style="width:${pct}%"></span></span><b style="color:var(--ui-text);">${cov.present}/${cov.expected}</b> (${pct}%)</span>`;
  wrap.appendChild(hdr);

  let shown = 0;
  for (const g of cov.groups) {
    const names = REFERENCE.find((r) => r.id === g.id).tokens.filter(matchTok);
    if (!names.length) continue;
    shown += names.length;
    const sec = document.createElement("section");
    sec.className = "group";
    sec.innerHTML = `<h2>${esc(g.label)}<span>${g.present.length}/${g.expected}</span></h2>`;
    const table = document.createElement("table");
    table.className = "raw";
    table.innerHTML = names
      .map((name) => {
        const hit = have.has(name);
        const val = have.get(name) ?? "";
        return `<tr data-token="${esc(name)}" data-value="${esc(val)}" title="${hit ? "copy" : "missing"}"><td class="${hit ? "yes" : "no"}">${hit ? "✓" : "✗"} ${esc(name)}</td><td>${esc(val)}${hit ? "" : '<span style="color:var(--ui-dim); font-size:11px; margin-left:6px;">— missing</span>'}</td></tr>`;
      })
      .join("");
    sec.appendChild(table);
    wrap.appendChild(sec);
  }
  const extra = cov.extra.filter(matchTok);
  if (extra.length) {
    const sec = document.createElement("section");
    sec.className = "group";
    sec.innerHTML =
      `<h2>Outside Schema<span>${cov.extra.length}</span></h2>` +
      `<div class="missing-row">${extra.map((n) => `<code>${esc(n)}</code>`).join(" ")}</div>`;
    wrap.appendChild(sec);
  }
  if (filter && !shown && !extra.length) wrap.innerHTML = `<div class="empty">No tokens matching "<b>${esc(filter)}</b>".</div>`;
  return wrap;
}

// — shared cell builders
function colorGrid(tokens) {
  const w = document.createElement("div");
  w.className = "swatches";
  w.innerHTML = tokens
    .map(
      (t) => `<div class="swatch" data-token="${esc(t.name)}" data-value="${esc(t.value)}" title="click to copy">
        <div class="chip" style="--val: var(${t.name})"></div>
        <div class="n">${esc(t.name)}</div><div class="v">${esc(t.value)}</div>
        <button class="tiny" data-update="${esc(t.name)}" title="Update token" style="margin-top:6px; width:100%;">Update</button>
      </div>`,
    )
    .join("");
  // wire update buttons
  w.querySelectorAll("[data-update]").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const sw = e.target.closest("[data-token]");
      openTokenUpdate(sw.dataset.token, sw.dataset.value);
    });
  });
  return w;
}
function rows(tokens, rowFn) {
  const w = document.createElement("div");
  w.className = "rows";
  for (const t of tokens) w.appendChild(rowFn(t));
  return w;
}
function baseRow(t, demoHtml) {
  const r = document.createElement("div");
  r.className = "row";
  r.dataset.token = t.name;
  r.dataset.value = t.value;
  r.title = "click to copy — double-click or use Update to edit";
  r.innerHTML = `<div class="label"><b>${esc(t.name)}</b>${esc(t.value)}</div><div class="demo" style="display:flex; align-items:center; gap:10px;">${demoHtml}<button class="tiny" data-update="${esc(t.name)}" title="Update token value" style="margin-left:auto; flex:none;">Update</button></div>`;
  // update button — stop propagation so copy handler doesn't fire
  r.querySelector("[data-update]")?.addEventListener("click", (e) => {
    e.stopPropagation();
    openTokenUpdate(t.name, t.value);
  });
  return r;
}
function openTokenUpdate(name, cur) {
  const v = prompt(`Update ${name}`, cur);
  if (v == null) return;
  const trimmed = v.trim();
  if (!trimmed || trimmed === cur) return;
  patchToken(name, trimmed);
}
const barRow = (t) => baseRow(t, `<div class="bar" style="width: var(${t.name})"></div>`);
const radiusRow = (t) => baseRow(t, `<div class="radiusbox" style="border-radius: var(${t.name})"></div>`);
const shadowRow = (t) => baseRow(t, `<div class="shadowbox" style="box-shadow: var(${t.name})"></div>`);
const motionRow = (t) => baseRow(t, `<div class="motionbox" style="transition-duration: var(${t.name})"></div>`);
const easingRow = (t) => baseRow(t, `<div class="motionbox" style="transition-timing-function: var(${t.name}); transition-duration: 420ms"></div>`);
const opacityRow = (t) => baseRow(t, `<div class="shadowbox" style="opacity: var(${t.name}); background: var(--ui-accent)"></div>`);
const typeRow = (t) =>
  baseRow(t, `<div class="typespec" style="font-size: var(${t.name})">Aa Bb Cc — sample text 0123</div>`);
const fontFamilyRow = (t) =>
  baseRow(t, `<div class="typespec" style="font-family: var(${t.name})">Aa Bb Cc — ${esc(t.value)}</div>`);
const fontWeightRow = (t) =>
  baseRow(t, `<div class="typespec" style="font-weight: var(${t.name})">Aa Bb Cc — weight ${esc(t.value)}</div>`);
const lineHeightRow = (t) =>
  baseRow(t, `<div class="typespec" style="line-height: var(${t.name}); background: var(--ui-panel); padding: 6px 8px; border-radius: var(--r-sm)">Line one<br/>Line two — ${esc(t.value)}</div>`);
const letterSpacingRow = (t) =>
  baseRow(t, `<div class="typespec" style="letter-spacing: var(${t.name})">AV Va — letter spacing ${esc(t.value)}</div>`);
const numberRow = (t) =>
  baseRow(t, `<span class="contrast-num" style="background: var(--ui-panel); padding: 4px 8px; border-radius: var(--r-sm)">${esc(t.value)}</span>`);
const breakpointRow = (t) =>
  baseRow(t, `<span class="contrast-num" style="background: var(--ui-panel); padding: 4px 8px; border-radius: var(--r-sm)">${esc(t.value)}</span>`);
function rawTable(tokens) {
  const table = document.createElement("table");
  table.className = "raw";
  table.innerHTML = tokens
    .map((t) => `<tr data-token="${esc(t.name)}" data-value="${esc(t.value)}" title="click to copy"><td>${esc(t.name)}</td><td>${esc(t.value)}</td><td><button class="tiny" data-update="${esc(t.name)}" title="Update token">Update</button></td></tr>`)
    .join("");
  table.querySelectorAll("[data-update]").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const tr = e.target.closest("[data-token]");
      openTokenUpdate(tr.dataset.token, tr.dataset.value);
    });
  });
  return table;
}
const esc = (s) =>
  String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

// ─────────────────────────────────────────────── copy / export
// click any token cell → copy `--name: value;`
main.addEventListener("click", (e) => {
  const el = e.target.closest("[data-token]");
  if (!el || !main.contains(el)) return;
  const name = el.dataset.token;
  const value = el.dataset.value || "";
  const text = value ? `${name}: ${value};` : `${name}: ;`;
  navigator.clipboard?.writeText(text).then(
    () => { flash(el); showToast(`${name} copied`, "ok"); },
    () => { showToast("Copy failed", "err"); },
  );
});
function flash(el) {
  el.classList.add("copied");
  setTimeout(() => el.classList.remove("copied"), 700);
}

// ─────────────────────────────────────────────── inline edit (double-click)
let editing = false;
main.addEventListener("dblclick", (e) => {
  if (schemaMode) return;
  const el = e.target.closest("[data-token]");
  if (!el || !main.contains(el)) return;
  e.preventDefault();
  window.getSelection?.()?.removeAllRanges();
  const name = el.dataset.token;
  const cur = el.dataset.value || "";
  if (editing) return;
  editing = true;

  const inp = document.createElement("input");
  inp.className = "tok-edit";
  inp.value = cur;
  inp.spellcheck = false;
  const r = el.getBoundingClientRect();
  inp.style.cssText =
    `position:fixed;z-index:99;left:${Math.round(r.left)}px;top:${Math.round(r.bottom + 4)}px;width:${Math.max(200, Math.round(r.width))}px`;
  document.body.appendChild(inp);
  inp.focus();
  inp.select();

  const close = (save) => {
    if (!editing) return;
    editing = false;
    const v = inp.value.trim();
    inp.remove();
    if (save && v && v !== cur) patchToken(name, v);
  };
  inp.addEventListener("keydown", (ev) => {
    if (ev.key === "Enter") { ev.preventDefault(); close(true); }
    else if (ev.key === "Escape") { ev.preventDefault(); close(false); }
  });
  inp.addEventListener("blur", () => close(true));
});

// Reuse the merge endpoint: a one-line :root block, last-write-wins.
async function patchToken(name, value) {
  try {
    await postSystem({ mode: "merge", slug: active, css: `:root { ${name}: ${value}; }` });
    showToast(`${name} updated`, "ok");
  } catch (err) {
    showToast(`Save failed: ${err.message || err}`, "err");
  }
}

// ─────────────────────────────────────────────── contrast (WCAG)
// The browser resolves var()/color-mix()/oklch on a hidden probe inside the
// gallery wrap (which carries every token as a custom property) → we read rgb.
function appendContrast(sys, wrap) {
  const have = valueMap(sys);
  const pairs = CONTRAST_PAIRS.filter(([fg, bg]) => have.has(fg) && have.has(bg));
  if (!pairs.length) return;

  const probe = document.createElement("span");
  probe.setAttribute("aria-hidden", "true");
  probe.style.cssText = "position:fixed;left:-9999px;top:0;width:1px;height:1px;overflow:hidden";
  wrap.appendChild(probe);
  const cs = getComputedStyle(probe);

  const sec = document.createElement("section");
  sec.className = "group";
  sec.innerHTML = `<h2>Accessibility / Contrast<span>WCAG AA · 4.5</span></h2>`;
  const list = document.createElement("div");
  list.className = "rows";

  for (const [fg, bg, label] of pairs) {
    probe.style.color = `var(${fg})`;
    probe.style.backgroundColor = `var(${bg})`;
    const ratio = contrastRatio(cs.color, cs.backgroundColor);
    const rt = rating(ratio);
    const cls = rt.pass === true ? "yes" : rt.pass === "large" ? "mid" : "no";
    const row = document.createElement("div");
    row.className = "row";
    const num = ratio == null ? "—" : ratio.toFixed(2);
    const title = ratio == null ? "could not calculate — color unresolved" : `ratio ${num}`;
    row.innerHTML =
      `<div class="label"><b>${esc(label)}</b>${esc(fg)} / ${esc(bg)}</div>` +
      `<div class="demo contrast-demo">` +
      `<span class="contrast-chip" style="color:var(${fg});background:var(${bg})">Aa</span>` +
      `<span class="contrast-num" title="${esc(title)}">${num}</span>` +
      `<span class="contrast-badge ${cls}">${esc(rt.label)}</span></div>`;
    list.appendChild(row);
  }

  probe.remove();
  sec.appendChild(list);
  wrap.appendChild(sec);
}

function systemToCss(sys) {
  const groups = sys.groups ?? categorize(parseTokens(sys.css));
  const blocks = groups
    .filter((g) => g.tokens.length)
    .map((g) => `  /* ${g.label} */\n` + g.tokens.map((t) => `  ${t.name}: ${t.value};`).join("\n"));
  return `/* ${sys.name} — ${sys.slug} */\n:root {\n${blocks.join("\n\n")}\n}\n`;
}
function download(filename, text, type) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type: `${type};charset=utf-8` }));
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

// ─────────────────────────────────────────────── modal
// Which token names a template button should scaffold for the current mode.
function templateNames() {
  if (dlgMode !== "merge") return undefined; // full reference
  const cov = activeSystem()?.coverage ?? coverage(parseTokens(activeSystem()?.css ?? "").map((t) => t.name));
  return cov.groups.flatMap((g) => g.missing);
}

function openDialog(mode) {
  dlgMode = mode;
  $("dlgForm").reset();
  const _de = $("dlgErr"); if (_de) _de.hidden = true;
  const _dth = $("dlgTplHint"); if (_dth) _dth.textContent = "";
  const merge = mode === "merge";
  $("dlgTitle").textContent = merge ? `Add Tokens — ${activeSystem()?.name ?? ""}` : "Add System";
  const _dnw = $("dlgNameWrap"); if (_dnw) _dnw.hidden = merge;
  const n = merge ? templateNames().length : REFERENCE.reduce((s, g) => s + g.tokens.length, 0);
  const _dtf = $("dlgTplFill"); if (_dtf) _dtf.textContent = merge ? `Fill missing template (${n})` : `Fill full template (${n})`;
  const _dtc = $("dlgTplCopy"); if (_dtc) _dtc.textContent = "Copy template";
  updatePreview();
  dlg.showModal();
}

function tplHint(msg, ok) {
  const el = $("dlgTplHint");
  el.textContent = msg;
  el.classList.toggle("flash", !!ok);
}

$("dlgTplFill")?.addEventListener("click", () => {
  const _dc1 = $("dlgCss"); if (_dc1) _dc1.value = templateCss(templateNames());
  tplHint("template inserted — fill values, empty lines are ignored");
  updatePreview();
});
$("dlgTplCopy")?.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(templateCss(templateNames()));
    tplHint("copied to clipboard ✓", true);
  } catch {
    tplHint("copy failed — use Fill template button");
  }
});

$("dlgCancel")?.addEventListener("click", () => dlg.close());
$("dlgCss").addEventListener("input", updatePreview);

// ── unified manage dialog
const manageDlg = $("manageDlg");
function openManage(tab = "create") {
  if (!manageDlg) return openDialog("add");
  // update dynamic parts
  const sys = activeSystem();
  $("manageTokensName") && ($("manageTokensName").textContent = sys ? sys.name : "—");
  $("manageDeleteSlug") && ($("manageDeleteSlug").textContent = sys ? sys.slug : "—");
  $("manageExportName") && ($("manageExportName").textContent = sys ? sys.name : "No system");
  $("manageExportMeta") && ($("manageExportMeta").textContent = sys ? `${sys.tokenCount} tokens · ${sys.coverage.present}/${sys.coverage.expected} coverage` : "");
  // schema body
  if (sys) {
    const cov = sys.coverage;
    const have = valueMap(sys);
    let html = "";
    for (const g of cov.groups) {
      const names = REFERENCE.find(r=>r.id===g.id).tokens;
      html += `<div style="margin:12px 0 6px; font-size:12px; font-weight:600; color:var(--ui-text);">${esc(g.label)} <span style="font-weight:400; color:var(--ui-dim);">${g.present.length}/${g.expected}</span></div>`;
      html += `<div style="display:flex; flex-wrap:wrap; gap:6px;">` + names.map(n=> have.has(n) ? `<span style="font-family: ui-monospace, monospace; font-size:11px; background: color-mix(in srgb, var(--ui-ok) 12%, transparent); color: var(--ui-ok); border:1px solid color-mix(in srgb, var(--ui-ok) 20%, transparent); padding:2px 6px; border-radius:4px;">✓ ${esc(n)}</span>` : `<span style="font-family: ui-monospace, monospace; font-size:11px; background: var(--ui-bg-2); color: var(--ui-dim); border:1px solid var(--ui-line); padding:2px 6px; border-radius:4px;">✗ ${esc(n)}</span>`).join("") + `</div>`;
    }
    if (cov.extra.length) html += `<div style="margin:12px 0 6px; font-size:12px; font-weight:600;">Outside Schema <span style="font-weight:400; color:var(--ui-dim);">${cov.extra.length}</span></div><div style="display:flex; flex-wrap:wrap; gap:6px;">${cov.extra.map(n=>`<span style="font-family: ui-monospace, monospace; font-size:11px; background: var(--ui-bg-2); padding:2px 6px; border-radius:4px; border:1px solid var(--ui-line);">${esc(n)}</span>`).join("")}</div>`;
    $("manageSchemaBody") && ($("manageSchemaBody").innerHTML = html);
  }
  // switch tab
  switchManageTab(tab);
  manageDlg.showModal();
}
function switchManageTab(tab) {
  for (const id of ["manageCreate","manageTokens","manageSchema","manageExport","manageDanger"]) {
    const el = $(id);
    if (el) el.hidden = !id.toLowerCase().includes(tab);
  }
  for (const b of document.querySelectorAll("[data-manage-tab]")) {
    b.classList.toggle("active", b.dataset.manageTab === tab);
  }
}
document.querySelectorAll("[data-manage-tab]").forEach(b=> b.addEventListener("click", ()=> switchManageTab(b.dataset.manageTab)));
$("manageBtn")?.addEventListener("click", ()=> openManage(activeSystem() ? "tokens" : "create"));
// keep old buttons as aliases to unified flow (for backward compat, hidden in DOM but still work if present)
$("addBtn")?.addEventListener("click", ()=> openManage("create"));
$("mergeBtn")?.addEventListener("click", ()=> openManage("tokens"));
$("schemaBtn")?.addEventListener("click", ()=> openManage("schema"));
$("expCss")?.addEventListener("click", ()=> openManage("export"));
$("expJson")?.addEventListener("click", ()=> openManage("export"));
$("deleteBtn")?.addEventListener("click", ()=> openManage("danger"));

// ── manage dialog inner wiring
$("manageTplFill")?.addEventListener("click", ()=> { $("manageCss").value = templateCss(); updateManagePreview("create"); });
$("manageTplCopy")?.addEventListener("click", async ()=> {
  try { await navigator.clipboard.writeText(templateCss()); showToast("Template copied", "ok"); } catch { showToast("Copy failed", "err"); }
});
$("manageCreateCancel")?.addEventListener("click", ()=> $("manageDlg")?.close());
$("manageTokensTplFill")?.addEventListener("click", ()=> {
  const names = templateNames();
  $("manageTokensCss").value = templateCss(names);
  updateManagePreview("tokens");
});
$("manageTokensTplCopy")?.addEventListener("click", async ()=> {
  try { await navigator.clipboard.writeText(templateCss(templateNames())); showToast("Template copied", "ok"); } catch { showToast("Copy failed", "err"); }
});
$("manageTokensCancel")?.addEventListener("click", ()=> $("manageDlg")?.close());
$("manageCss")?.addEventListener("input", ()=> updateManagePreview("create"));
$("manageTokensCss")?.addEventListener("input", ()=> updateManagePreview("tokens"));

$("manageCreateSave")?.addEventListener("click", async ()=> {
  const css = $("manageCss").value;
  const name = $("manageName").value.trim() || "Untitled";
  const err = $("manageCreateErr");
  if (!css.trim()) { err.textContent = "CSS block is empty."; err.hidden = false; return; }
  err.hidden = true;
  $("manageCreateSave").disabled = true;
  try { await postSystem({ name, css }); showToast("System added", "ok"); $("manageDlg")?.close(); } catch(ex){ err.textContent = String(ex.message||ex); err.hidden=false; showToast(String(ex.message||ex),"err"); } finally { $("manageCreateSave").disabled = false; }
});
$("manageTokensSave")?.addEventListener("click", async ()=> {
  const css = $("manageTokensCss").value;
  const err = $("manageTokensErr");
  if (!css.trim()) { err.textContent = "CSS block is empty."; err.hidden = false; return; }
  err.hidden = true;
  $("manageTokensSave").disabled = true;
  try { await postSystem({ mode:"merge", slug:active, css }); showToast("Tokens added","ok"); $("manageDlg")?.close(); } catch(ex){ err.textContent = String(ex.message||ex); err.hidden=false; showToast(String(ex.message||ex),"err"); } finally { $("manageTokensSave").disabled = false; }
});
$("manageExpCss")?.addEventListener("click", ()=> { const sys=activeSystem(); if(sys) { download(`${sys.slug}.css`, systemToCss(sys), "text/css"); showToast("CSS downloaded","ok"); }});
$("manageExpJson")?.addEventListener("click", ()=> { const sys=activeSystem(); if(sys) { download(`${sys.slug}.json`, JSON.stringify(sys,null,2), "application/json"); showToast("JSON downloaded","ok"); }});
$("manageDeleteBtn")?.addEventListener("click", ()=> {
  const sys = activeSystem();
  if (sys && confirm(`Delete "${sys.name}"? This cannot be undone.`)) { $("manageDlg")?.close(); remove(sys.slug); }
});

function updatePreview() {
  const css = $("dlgCss").value;
  const line = $("dlgPreview");
  if (!css.trim()) {
    line.textContent = "Awaiting CSS block…";
    return;
  }

  // In merge mode, preview coverage of the combined token set.
  const base = dlgMode === "merge" ? parseTokens(activeSystem()?.css ?? "") : [];
  const names = new Set([...base, ...parseTokens(css)].map((t) => t.name));
  const cov = coverage([...names]);
  const added = parseTokens(css).length;

  const missGroups = cov.groups
    .filter((g) => g.missing.length)
    .map(
      (g) =>
        `<div class="grp">${esc(g.label)} — ${g.present.length}/${g.expected}</div>` +
        g.missing.map((n) => `<code>${esc(n)}</code>`).join("  "),
    )
    .join("");

  const lint = lintTokens(parseTokens(css));

  line.innerHTML =
    `<b>${added}</b> tokens pasted · coverage <b class="${cov.missing ? "" : "ok"}">${cov.present}/${cov.expected}</b>` +
    (cov.missing ? ` · <span class="warn">${cov.missing} missing</span>` : ' · <span class="ok">complete</span>') +
    (cov.extraCount ? ` · <span class="warn">${cov.extraCount} extra</span>` : "") +
    (lint.length ? ` · <span class="warn">${lint.length} value warnings</span>` : "") +
    (lint.length
      ? `<details class="miss-detail" open><summary class="warn">value warnings</summary>${lint
          .map((w) => `<div><code>${esc(w.name)}: ${esc(w.value)}</code> — ${esc(w.msg)}</div>`)
          .join("")}</details>`
      : "") +
    (missGroups
      ? `<details class="miss-detail"><summary>missing token list</summary>${missGroups}</details>`
      : "");
}
function updateManagePreview(which) {
  const isCreate = which === "create";
  const cssEl = isCreate ? $("manageCss") : $("manageTokensCss");
  const previewEl = isCreate ? $("manageCreatePreview") : $("manageTokensPreview");
  if (!cssEl || !previewEl) return;
  const css = cssEl.value;
  if (!css.trim()) { previewEl.textContent = "Awaiting CSS block…"; return; }
  const base = !isCreate ? parseTokens(activeSystem()?.css ?? "") : [];
  const names = new Set([...base, ...parseTokens(css)].map(t=>t.name));
  const cov = coverage([...names]);
  const added = parseTokens(css).length;
  const lint = lintTokens(parseTokens(css));
  previewEl.innerHTML = `<b>${added}</b> tokens pasted · coverage <b class="${cov.missing ? "" : "ok"}">${cov.present}/${cov.expected}</b>` + (cov.missing ? ` · <span class="warn">${cov.missing} missing</span>` : ' · <span class="ok">complete</span>') + (lint.length ? ` · <span class="warn">${lint.length} warnings</span>` : "");
}

$("dlgForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const css = $("dlgCss").value;
  const err = $("dlgErr");
  if (!css.trim()) {
    err.textContent = "CSS block is empty.";
    err.hidden = false;
    return;
  }
  $("dlgSave").disabled = true;
  try {
    if (dlgMode === "merge") {
      await postSystem({ mode: "merge", slug: active, css });
      showToast("Tokens added", "ok");
    } else {
      await postSystem({ name: $("dlgName").value.trim() || "Untitled", css });
      showToast("System added", "ok");
    }
    dlg.close();
  } catch (ex) {
    err.textContent = String(ex.message || ex);
    err.hidden = false;
    showToast(String(ex.message || ex), "err");
  } finally {
    $("dlgSave").disabled = false;
  }
});

// ─────────────────────────────────────────────── toasts
function showToast(msg, type = "ok") {
  const wrap = $("toasts");
  if (!wrap) return;
  const el = document.createElement("div");
  el.className = `toast toast-${type}`;
  el.textContent = msg;
  wrap.appendChild(el);
  requestAnimationFrame(() => el.classList.add("show"));
  setTimeout(() => {
    el.classList.remove("show");
    setTimeout(() => el.remove(), 220);
  }, 2600);
}

// ─────────────────────────────────────────────── header controls
picker.addEventListener("change", () => {
  active = picker.value;
  schemaMode = false;
  filter = "";
  render();
  syncPreview();
  syncUrl();
});
$("tabSystem")?.addEventListener("click", () => activateTab("system"));
$("tabPreview")?.addEventListener("click", () => activateTab("preview"));
$("tabCompare")?.addEventListener("click", () => activateTab("compare"));
$("schemaBtn")?.addEventListener("click", () => {
  schemaMode = !schemaMode;
  render();
  closeMenu();
});
$("deleteBtn")?.addEventListener("click", () => {
  const sys = activeSystem();
  closeMenu();
  if (sys && confirm(`"${sys.name}" delete?`)) remove(sys.slug);
});
$("expCss")?.addEventListener("click", () => {
  const sys = activeSystem();
  if (sys) download(`${sys.slug}.css`, systemToCss(sys), "text/css");
});
$("expJson")?.addEventListener("click", () => {
  const sys = activeSystem();
  if (sys) download(`${sys.slug}.json`, JSON.stringify(sys, null, 2), "application/json");
});

// theme toggle removed — viewer stays in default dark, systems use their own --color-bg

// ── system actions dropdown
function closeMenu() {
  const m = $("actionsMenu");
  if (m) m.hidden = true;
}
$("menuBtn")?.addEventListener("click", (e) => {
  e.stopPropagation();
  const m = $("actionsMenu");
  if (!m) return;
  m.hidden = !m.hidden;
});
document.addEventListener("click", (e) => {
  const wrap = $("sysActionsWrap");
  const menu = $("actionsMenu");
  if (!wrap || !menu || menu.hidden) return;
  if (!wrap.contains(e.target)) menu.hidden = true;
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeMenu();
});

// ── dlg: import from URL
$("dlgFetch")?.addEventListener("click", async () => {
  const url = $("dlgUrl")?.value.trim();
  if (!url) { showToast("Please enter URL", "warn"); return; }
  const btn = $("dlgFetch");
  btn.disabled = true;
  const prev = btn.textContent;
  btn.textContent = "…";
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    const text = await res.text();
    const _dc2 = $("dlgCss"); if (_dc2) _dc2.value = text;
    updatePreview();
    showToast("CSS fetched", "ok");
  } catch (err) {
    showToast(`Fetch failed: ${err.message || err}`, "err");
  } finally {
    btn.disabled = false;
    btn.textContent = prev;
  }
});

// ── drag & drop + file input
const dropOverlay = $("dropOverlay");
let dragDepth = 0;
function showDrop(v) { if (dropOverlay) dropOverlay.hidden = !v; }
document.addEventListener("dragenter", (e) => {
  if ([...e.dataTransfer.types].includes("Files")) { dragDepth++; showDrop(true); }
});
document.addEventListener("dragleave", (e) => {
  if ([...e.dataTransfer.types].includes("Files")) { dragDepth = Math.max(0, dragDepth - 1); if (!dragDepth) showDrop(false); }
});
document.addEventListener("dragover", (e) => e.preventDefault());
document.addEventListener("drop", async (e) => {
  e.preventDefault();
  dragDepth = 0; showDrop(false);
  const file = [...(e.dataTransfer.files || [])].find((f) => f.name.endsWith(".css"));
  if (!file) { showToast("Only .css files", "warn"); return; }
  const text = await file.text();
  // if no active system or user drops on empty state → open add dialog with content, else merge
  if (!activeSystem()) {
    openDialog("add");
    const _dc2 = $("dlgCss"); if (_dc2) _dc2.value = text;
    updatePreview();
  } else {
    try { await postSystem({ mode: "merge", slug: active, css: text }); showToast("File imported", "ok"); } catch (err) { showToast(String(err.message || err), "err"); }
  }
});
$("fileInput")?.addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const text = await file.text();
  if (!activeSystem()) { openDialog("add"); const _dc2 = $("dlgCss"); if (_dc2) _dc2.value = text; updatePreview(); }
  else { try { await postSystem({ mode: "merge", slug: active, css: text }); showToast("File imported", "ok"); } catch (err) { showToast(String(err.message || err), "err"); } }
  e.target.value = "";
});
// double-click overlay to open file picker as alternative
dropOverlay?.addEventListener("click", () => $("fileInput")?.click());

// ── help flow (replaces shortcuts)
$("kbdBtn")?.addEventListener("click", () => $("kbdDlg")?.showModal());

activateTab(tab);
load();
