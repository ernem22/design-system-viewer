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
// null = never saved here (fall back to the shipped systems/index.json);
// [] = the user deleted everything, which must survive a reload.
function loadFromLS() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw === null ? null : JSON.parse(raw);
  } catch { return null; }
}
function saveToLS(list) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(list)); } catch {}
}
async function load() {
  if (isStaticHost()) {
    try {
      const cached = loadFromLS();
      if (cached) systems = cached;
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
      if (cached) systems = cached;
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
  for (const [id, name] of [["tabSystem", "system"], ["tabPreview", "preview"], ["tabCompare", "compare"]]) {
    const on = tab === name;
    $(id).classList.toggle("active", on);
    $(id).setAttribute("aria-selected", String(on));
  }
  main.hidden = inFrame;
  $("previewFrame").hidden = !inFrame;
  if (inFrame) syncPreview();
  syncUrl();
}

// The single iframe serves both the preview gallery and compare mode. Load the
// right URL when its mode changes; otherwise just message it the active slug.
// Relative to wherever index.html sits — works on /, on /design-system-viewer/,
// and from file:// without a special case per host.
const getPreviewBase = () => new URL("preview/", document.baseURI).href;
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
    frame.contentWindow?.postMessage({ type: "dsv:system", slug: active || "" }, MSG_ORIGIN);
  }
}

const MSG_ORIGIN = location.origin === "null" ? "*" : location.origin;

window.addEventListener("message", (e) => {
  if (e.origin !== location.origin && e.origin !== "null") return;
  if (e.data?.type === "dsv:preview-ready" && tab === "preview") {
    $("previewFrame").contentWindow?.postMessage({ type: "dsv:system", slug: active || "" }, MSG_ORIGIN);
  }
  if (e.data?.type === "dsv:compare-state") {
    cmpState = e.data;
    if (tab === "compare") syncUrl();
  }
});

const isStaticHost = () => location.hostname.includes("github.io") || location.protocol === "file:";

// Persist a create/merge to localStorage — used on static hosts (Pages, file://)
// and as the fallback when no /api backend answers.
async function writeStatic(body) {
  const { buildSystem: bs, mergeSystem: ms } = await import("../core/parse.js");
  let list = loadFromLS();
  if (!list) {
    list = [];
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
}

async function postSystem(body) {
  // On Pages, don't even try the API — go straight to localStorage to avoid 405 console noise
  if (isStaticHost()) return writeStatic(body);
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
  } catch (e) {
    const msg = String(e.message || e);
    const isStatic = msg.includes("Failed to fetch") || msg.includes("404") || msg.includes("405") || msg.includes("HTTP 4");
    if (isStatic) return writeStatic(body);
    throw e;
  }
}

async function remove(slug) {
  const dropLocal = () => {
    const list = (loadFromLS() ?? systems).filter(s => s.slug !== slug);
    saveToLS(list);
    systems = list;
  };
  if (isStaticHost()) {
    dropLocal();
  } else {
    try { await fetch(`/api/systems/${encodeURIComponent(slug)}`, { method: "DELETE" }); }
    catch { dropLocal(); }
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
  if (!picker.hidden) {
    picker.innerHTML = systems.map((s) => `<option value="${s.slug}">${esc(s.name)}</option>`).join("");
    picker.value = active;
  }

  if (!sys) {
    main.innerHTML = `
      <div class="welcome">
        <svg class="welcome-icon" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>
        <h2>No systems yet</h2>
        <p>Paste a block of <code>--token: value;</code> lines and get a categorized gallery, a live component preview, and a side-by-side diff.</p>
        <div class="welcome-actions">
          <div class="welcome-card" id="welcomePaste" role="button" tabindex="0">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/></svg>
            <b>Paste CSS</b><span>Or fetch a stylesheet from a URL</span>
          </div>
          <div class="welcome-card" id="welcomeUpload" role="button" tabindex="0">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            <b>Upload a file</b><span>Pick a .css file, or drop one anywhere</span>
          </div>
        </div>
        <p class="welcome-hint">Nothing is uploaded — systems stay in this browser (or in <code>systems/</code> when the local server runs).</p>
      </div>`;
    const openPaste = () => openDialog("add");
    const openUpload = () => $("fileInput")?.click();
    for (const [id, fn] of [["welcomePaste", openPaste], ["welcomeUpload", openUpload]]) {
      const el = $(id);
      el?.addEventListener("click", fn);
      el?.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fn(); } });
    }
    return;
  }

  // Coverage is always computed live: stored snapshots go stale when the schema
  // grows (139 → 432 tokens) and then report 0 missing, which silently breaks
  // "Show missing", the header counts and every per-group missing row.
  const cov = coverage(parseTokens(sys.css).map((t) => t.name));
  const pct = Math.round((cov.present / cov.expected) * 100);
  const tone = pct >= 80 ? "ok" : pct >= 50 ? "warn" : "bad";

  const warns = sys.warnings ?? lintTokens(parseTokens(sys.css));

  main.innerHTML = `
    ${
      warns.length
        ? `<details class="warn-row"><summary>⚠ ${warns.length} possible value issues</summary>${warns
            .map((w) => `<div><code>${esc(w.name)}: ${esc(w.value)}</code> — ${esc(w.msg)}</div>`)
            .join("")}</details>`
        : ""
    }
    <div class="toolbar">
      <span class="cov tb-cov">
        <span class="cov-ring ${tone}" role="img" aria-label="${pct}% of schema tokens present">
          <svg viewBox="0 0 36 36" aria-hidden="true"><circle class="rr-track" cx="18" cy="18" r="15.5" pathLength="100" /><circle class="rr-val" cx="18" cy="18" r="15.5" pathLength="100" stroke-dasharray="${pct} 100" transform="rotate(-90 18 18)" /></svg>
          <b>${pct}<i>%</i></b>
        </span>
        <span class="cov-text">
          <b>${cov.present}/${cov.expected}</b> tokens · <b class="${cov.missing ? "miss" : "zero"}">${cov.missing}</b> missing · <b class="${cov.extraCount ? "extra" : "zero"}">${cov.extraCount}</b> extra
          ${cov.extraCount ? `<span class="dim" title="Preview only reads the ${cov.expected} schema names shown in the Schema view — a differently-named token renders here but not there.">(≠ Preview)</span>` : ""}
        </span>
      </span>
      <div class="tb-search">
        <span class="tb-filter-wrap">
          <svg class="tb-search-ico" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input type="search" id="tokenFilter" class="tok-filter" placeholder="Filter tokens…" value="${esc(filter)}" autocomplete="off" aria-label="Filter tokens" />
          <button id="filterClear" class="filter-clear" aria-label="Clear filter" title="Clear filter (Esc)" ${filter ? "" : "hidden"}>×</button>
        </span>
        ${
          schemaMode
            ? ""
            : `<label class="inline"><input type="checkbox" id="toggleMissing" ${showMissing ? "checked" : ""}/> Show missing</label>`
        }
      </div>
      <div class="tb-actions" role="toolbar" aria-label="System actions">
        <button id="toolbarAddTokens" class="tiny primary" title="Add tokens to this system (PATCH)"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>Add tokens</button>
        <span class="tb-sep" aria-hidden="true"></span>
        <button id="toolbarSchema" class="tiny" title="Toggle schema view"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>${schemaMode ? "Gallery" : "Schema"}</button>
        <div class="tb-export">
          <button id="expBtn" class="tiny" title="Download active system" aria-haspopup="menu" aria-expanded="false"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>Export<svg class="chev" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg></button>
          <div id="expMenu" class="tb-menu" role="menu" hidden>
            <button id="expCss" role="menuitem"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>CSS<code>:root stylesheet</code></button>
            <button id="expJson" role="menuitem"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>JSON<code>full system</code></button>
          </div>
        </div>
        <span class="tb-sep" aria-hidden="true"></span>
        <button id="toolbarDelete" class="tiny danger icon-only" title="Delete this system" aria-label="Delete ${esc(sys.name)}"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>
      </div>
    </div>
    <div id="body"></div>`;

  if (!schemaMode) {
    $("toggleMissing").addEventListener("change", (e) => {
      showMissing = e.target.checked;
      paint();
    });
  }
  const paint = () => {
    const view = schemaMode ? schemaView(sys, cov) : gallery(sys, cov);
    $("body").replaceChildren(view);
    if (!schemaMode && !filter) appendContrast(sys, view);
    updateFilterMeta();
  };
  // clear-button visibility for the filter — updated on every paint
  const updateFilterMeta = () => {
    const fc = $("filterClear");
    if (fc) fc.hidden = !filter;
  };
  const fi = $("tokenFilter");
  fi.addEventListener("input", (e) => {
    filter = e.target.value.trim().toLowerCase();
    paint();
  });
  fi.addEventListener("keydown", (e) => { if (e.key === "Escape") { fi.value = ""; fi.dispatchEvent(new Event("input")); } });
  $("filterClear")?.addEventListener("click", () => { fi.value = ""; fi.dispatchEvent(new Event("input")); fi.focus(); });
  $("expCss")?.addEventListener("click", () => { closeExpMenu(); download(`${sys.slug}.css`, systemToCss(sys), "text/css"); });
  $("expJson")?.addEventListener("click", () => { closeExpMenu(); download(`${sys.slug}.json`, JSON.stringify(sys, null, 2), "application/json"); });
  // Export dropdown — fixed-positioned (via placeExpMenu) so it is never
  // clipped by the scrollable actions row on narrow screens.
  const expBtn = $("expBtn"), expMenu = $("expMenu");
  const placeExpMenu = () => {
    const r = expBtn.getBoundingClientRect();
    expMenu.hidden = false;
    const h = expMenu.offsetHeight;
    expMenu.style.top = `${Math.max(8, Math.min(r.bottom + 6, window.innerHeight - h - 8))}px`;
    expMenu.style.left = "auto";
    expMenu.style.right = `${Math.max(8, window.innerWidth - r.right)}px`;
  };
  expBtn?.addEventListener("click", (e) => {
    e.stopPropagation();
    if (expMenu.hidden) { placeExpMenu(); expBtn.setAttribute("aria-expanded", "true"); }
    else closeExpMenu();
  });
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

  if (g.kind === "color" || g.id === "gradient") el.appendChild(colorGrid(g.tokens));
  else if (g.id === "font-size" || g.id === "font-display") el.appendChild(rows(g.tokens, typeRow));
  else if (g.id === "font-family") el.appendChild(rows(g.tokens, fontFamilyRow));
  else if (g.id === "font-weight") el.appendChild(rows(g.tokens, fontWeightRow));
  else if (g.id === "line-height") el.appendChild(rows(g.tokens, lineHeightRow));
  else if (g.id === "letter-spacing") el.appendChild(rows(g.tokens, letterSpacingRow));
  else if (g.id === "spacing" || g.id === "size" || g.id === "blur" || g.id === "border-width" ||
    g.id === "text-measure" || g.id === "section-spacing" || g.id === "control-geometry" || g.id === "motion-distance")
    el.appendChild(rows(g.tokens, barRow));
  else if (g.id === "radius") el.appendChild(rows(g.tokens, radiusRow));
  else if (g.kind === "shadow") el.appendChild(rows(g.tokens, shadowRow));
  else if (g.id === "duration") el.appendChild(rows(g.tokens, motionRow));
  else if (g.id === "easing") el.appendChild(rows(g.tokens, easingRow));
  else if (g.id === "opacity") el.appendChild(rows(g.tokens, opacityRow));
  else if (g.id === "z-index") el.appendChild(rows(g.tokens, numberRow));
  else if (g.id === "breakpoint") el.appendChild(rows(g.tokens, breakpointRow));
  else el.appendChild(scrollWrap(rawTable(g.tokens)));

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
        return `<tr data-token="${esc(name)}" data-value="${esc(val)}" title="${hit ? "click to copy — double-click or Update to edit" : "missing — Add to create it"}"><td class="${hit ? "yes" : "no"}">${hit ? "✓" : "✗"} ${esc(name)}</td><td>${esc(val)}${hit ? "" : '<span style="color:var(--ui-dim); font-size:11px; margin-left:6px;">— missing</span>'}</td><td style="text-align:right; white-space:nowrap;"><button class="tiny" data-update="${esc(name)}" title="${hit ? "Update token value" : "Add this missing token"}">${hit ? "Update" : "Add"}</button></td></tr>`;
      })
      .join("");
    wireUpdate(table);
    sec.appendChild(scrollWrap(table));
    wrap.appendChild(sec);
  }
  const extra = cov.extra.filter(matchTok);
  if (extra.length) {
    const sec = document.createElement("section");
    sec.className = "group";
    sec.innerHTML =
      `<h2>Outside Schema<span>${cov.extra.length}</span></h2>` +
      `<div class="missing-row">Preview only ever reads the ${cov.expected} names on this page — these render in the gallery above but not there. Rename to the matching schema name to make them count.</div>` +
      `<div class="missing-row">${extra.map((n) => `<code>${esc(n)}</code>`).join(" ")}</div>`;
    wrap.appendChild(sec);
  }
  if (filter && !shown && !extra.length) wrap.innerHTML = `<div class="empty">No tokens matching "<b>${esc(filter)}</b>".</div>`;
  return wrap;
}

// — shared cell builders
// A value containing var(--…) delegates to another token — badge it so raw
// values and references are visually distinguishable in the gallery.
const isRef = (v) => String(v ?? "").includes("var(--");
const refBadge = (v) =>
  isRef(v)
    ? ' <span style="color:var(--ui-accent);font-size:10.5px;font-weight:700;white-space:nowrap;" title="references another token">→ref</span>'
    : "";
// Wire every [data-update] button inside `scope` to the inline editor.
// stopPropagation keeps the click off the copy-on-click handler on `main`.
function wireUpdate(scope) {
  scope.querySelectorAll("[data-update]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      openInlineEditor(e.target.closest("[data-token]"));
    });
  });
}
function colorGrid(tokens) {
  const w = document.createElement("div");
  w.className = "swatches";
  w.innerHTML = tokens
    .map(
      (t) => `<div class="swatch" data-token="${esc(t.name)}" data-value="${esc(t.value)}" title="click to copy">
        <div class="chip" style="--val: var(${t.name})"></div>
        <div class="n">${esc(t.name)}${refBadge(t.value)}</div><div class="v">${esc(t.value)}</div>
        <button class="tiny" data-update="${esc(t.name)}" title="Update token" style="margin-top:6px; width:100%;">Update</button>
      </div>`,
    )
    .join("");
  // wire update buttons
  wireUpdate(w);
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
  r.innerHTML = `<div class="label"><b>${esc(t.name)}</b>${esc(t.value)}${refBadge(t.value)}</div><div class="demo" style="display:flex; align-items:center; gap:10px;">${demoHtml}<button class="tiny" data-update="${esc(t.name)}" title="Update token value" style="margin-left:auto; flex:none;">Update</button></div>`;
  // update button — stop propagation so copy handler doesn't fire
  r.querySelector("[data-update]")?.addEventListener("click", (e) => {
    e.stopPropagation();
    openInlineEditor(r);
  });
  return r;
}
// Floating one-field editor — shared by the row/swatch "Update" buttons and
// the double-click handler so both entry points behave identically.
let editing = false;
function openInlineEditor(el) {
  if (!el || !main.contains(el) || editing) return;
  const name = el.dataset.token;
  const cur = el.dataset.value || "";
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
function scrollWrap(node) {
  const d = document.createElement("div");
  d.className = "table-wrap";
  d.appendChild(node);
  return d;
}
function rawTable(tokens) {
  const table = document.createElement("table");
  table.className = "raw";
  table.innerHTML = tokens
    .map((t) => `<tr data-token="${esc(t.name)}" data-value="${esc(t.value)}" title="click to copy"><td>${esc(t.name)}</td><td>${esc(t.value)}${refBadge(t.value)}</td><td><button class="tiny" data-update="${esc(t.name)}" title="Update token">Update</button></td></tr>`)
    .join("");
  wireUpdate(table);
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

// Export dropdown — attached once (render() rebuilds the toolbar, so closers
// resolve the live elements on every event instead of holding stale refs).
function closeExpMenu() {
  const m = document.getElementById("expMenu");
  if (m && !m.hidden) {
    m.hidden = true;
    document.getElementById("expBtn")?.setAttribute("aria-expanded", "false");
  }
}
document.addEventListener("click", (e) => {
  if (!e.target.closest(".tb-export")) closeExpMenu();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeExpMenu();
});
window.addEventListener("scroll", () => closeExpMenu(), true);

// ─────────────────────────────────────────────── inline edit (double-click)
main.addEventListener("dblclick", (e) => {
  const el = e.target.closest("[data-token]");
  if (!el || !main.contains(el)) return;
  e.preventDefault();
  window.getSelection?.()?.removeAllRanges();
  openInlineEditor(el);
});

// Reuse the merge endpoint: a one-line bare block, last-write-wins (no :root needed, wrapped on server).
async function patchToken(name, value) {
  try {
    await postSystem({ mode: "merge", slug: active, css: `${name}: ${value};` });
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
    (cov.extraCount
      ? `<details class="miss-detail"><summary class="warn">extra — won't render in Preview</summary><div>Preview only reads the ${cov.expected} schema names (see Schema view). Rename these to match, or they'll just sit unused:</div>${cov.extra
          .map((n) => `<code>${esc(n)}</code>`)
          .join("  ")}</details>`
      : "") +
    (lint.length
      ? `<details class="miss-detail" open><summary class="warn">value warnings</summary>${lint
          .map((w) => `<div><code>${esc(w.name)}: ${esc(w.value)}</code> — ${esc(w.msg)}</div>`)
          .join("")}</details>`
      : "") +
    (missGroups
      ? `<details class="miss-detail"><summary>missing token list</summary>${missGroups}</details>`
      : "");
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
$("addBtn")?.addEventListener("click", () => openDialog("add"));

// ── theme (the light palette lives in index.html; this is what switches it)
const THEME_KEY = "dsv.theme";
const applyTheme = (t) => {
  document.documentElement.dataset.theme = t;
  try { localStorage.setItem(THEME_KEY, t); } catch {}
};
applyTheme(
  localStorage.getItem(THEME_KEY) ||
    (matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark"),
);
$("themeBtn")?.addEventListener("click", () =>
  applyTheme(document.documentElement.dataset.theme === "light" ? "dark" : "light"),
);

// ── dlg: import from URL
// Direct fetch works only for CORS-enabled URLs; most stylesheets send no
// ACAO header and die with "Failed to fetch". On the local server, route
// through /api/fetch-css (no origin restrictions); on static hosts the
// direct fetch is all we have.
async function fetchCss(url) {
  if (!isStaticHost()) {
    const res = await fetch(`/api/fetch-css?url=${encodeURIComponent(url)}`);
    if (!res.ok) {
      const err = await res.json().catch(() => null);
      throw new Error(err?.error || `${res.status} ${res.statusText}`);
    }
    return res.text();
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.text();
}
$("dlgFetch")?.addEventListener("click", async () => {
  const url = $("dlgUrl")?.value.trim();
  if (!url) { showToast("Please enter URL", "warn"); return; }
  const btn = $("dlgFetch");
  btn.disabled = true;
  const prev = btn.textContent;
  btn.textContent = "…";
  try {
    const text = await fetchCss(url);
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
const hasFiles = (e) => !!e.dataTransfer && [...e.dataTransfer.types].includes("Files");
document.addEventListener("dragenter", (e) => {
  if (hasFiles(e)) { dragDepth++; showDrop(true); }
});
document.addEventListener("dragleave", (e) => {
  if (hasFiles(e)) { dragDepth = Math.max(0, dragDepth - 1); if (!dragDepth) showDrop(false); }
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
