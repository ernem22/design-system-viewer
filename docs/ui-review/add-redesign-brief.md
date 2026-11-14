# "Add" (import) redesign — brief (from scratch)

## Evidence (screenshots)
Current: a near-fullscreen Add System modal with two live editors (schema checklist +
CSS textarea) over one buffer, source buttons that duplicate the panes, a stepper,
write-mode + name + filter controls — no single primary action, overwhelming. The
Confirm step is a mostly-empty screen of 4 counts + a "Preview" dropdown. "Add tokens"
is a separate, differently-shaped dialog. Verdict: dense, no hierarchy, inconsistent.

## Direction: one surface, paste-first, one primary action
A single `ImportSheet` used for BOTH "Add a system" and "Add tokens" (the latter scoped
to the active system). No stepper. Visual world stays the app's token-driven chrome.

Layout (top → bottom):
1. **Header**: title ("Add a system" | "Add tokens — <system>") + close; subline
   "Paste CSS or a JSON export — nothing is saved until you save."
2. **Editor**: one large CSS textarea (paste-first). A compact source line beside/below:
   Upload · From URL · Paste JSON export. These feed the same buffer; they do NOT open
   parallel panes.
3. **Live summary strip** (one line): `N tokens · X/Y schema · W warnings` + a
   "warnings" expander. Compact, muted.
4. **Schema helper (secondary, collapsed)**: a "Fill missing from schema" disclosure that
   expands the filterable checklist (reuse `SchemaFill`) — never dominating the sheet.
5. **Identity / target**: for a new system, a name field; for add-to-active, the target
   (active system or "Merge into…"). One control, chosen here (not a separate step).
6. **Footer**: one primary action (Save / Add) + Cancel. A "Review changes" expander shows
   the real diff (added / overridden / unchanged) inline in the same sheet before saving —
   no separate empty confirm screen.
7. **Collision** (name exists): inline choice (rename / merge / replace) with a danger-
   styled replace and a second confirm; never a silent overwrite.

Rules:
- One primary button. Secondary/muted everything else.
- Reuse existing logic: `tokenCss` parsing, `SchemaFill`, `CssPreview`, store build/merge.
- Keep: import race guard, dirty-state Cancel guard, inline errors, focus, `--app-font-size-*`.
- Dialog: max-width ~720px, max-height 90vh, fixed head/foot, only the body scrolls.
- Add tokens = same sheet, title + primary "Add tokens", identity hidden (always active).
- Remove the separate `TokenDialog` and the stepper.

## States
empty paste · parsed · warnings · schema-partial · collision · fetch loading/error ·
narrow (single column, schema disclosure collapses first) · active-system vs new target.

## Open decisions
- Reference/diff exact wording in "Review changes".
- Whether "Fill missing from schema" is a disclosure or a button that expands a section.
- Keep "Preview" (open in a tab) on save? (Probably drop from the sheet footer.)
