import * as Checkbox from "@radix-ui/react-checkbox";
import * as ToggleGroup from "@radix-ui/react-toggle-group";
import { useRef, type KeyboardEvent } from "react";
import { Icon } from "../lib/icons.tsx";
import type { DesignSystem } from "../systems/store.ts";
import type { TokensViewModel } from "./useTokensView.ts";
import "./TokenToolbar.css";

/**
 * Tokens toolbar (old .toolbar, minus the coverage ring — that lives in the
 * right rail now): filter + clear/Esc, Show missing (gallery only), the
 * Gallery/Schema segmented view switch and Add tokens (which opens the shared
 * import sheet scoped to this system). Whole-system actions (Export, Delete,
 * Rename, Duplicate) live in the system menu beside the topbar switcher (issue
 * #313), not here.
 */
export function TokenToolbar({
  view,
  system,
  onAddTokens,
}: {
  view: TokensViewModel;
  system: DesignSystem;
  onAddTokens: () => void;
}) {
  const {
    filter,
    setFilter,
    showMissing,
    setShowMissing,
    schemaMode,
    setSchemaMode,
  } = view;
  const filterRef = useRef<HTMLInputElement>(null);

  // Roving arrow-key navigation for the toolbar buttons (WAI-APG toolbar
  // pattern): Left/Right/Home/End move focus between the toolbar's buttons.
  // Text entry keeps its caret keys — an arrow inside the filter input must
  // move the caret, never steal focus — so targets that consume arrows
  // (input, textarea, select, contenteditable) are left alone. Tab still
  // reaches every control; arrows are a shortcut between the buttons.
  const onToolbarKeyDown = (e: KeyboardEvent) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft" && e.key !== "Home" && e.key !== "End")
      return;
    const target = e.target as HTMLElement | null;
    if (
      target &&
      (target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.tagName === "SELECT" ||
        target.isContentEditable)
    )
      return;

    // The Gallery/Schema segmented switch owns its arrows and wraps within
    // itself. Handle that before the toolbar roving so ArrowRight from Schema
    // goes back to Gallery instead of jumping out to "Add tokens".
    const switchRoot = target?.closest(".tok-view-switch");
    if (switchRoot) {
      const items = [...switchRoot.querySelectorAll<HTMLElement>("button:not([disabled])")];
      const at = items.indexOf(target as HTMLElement);
      if (at === -1) return;
      e.preventDefault();
      const next =
        e.key === "ArrowRight"
          ? items[(at + 1) % items.length]
          : e.key === "ArrowLeft"
            ? items[(at - 1 + items.length) % items.length]
            : e.key === "Home"
              ? items[0]
              : items[items.length - 1];
      next?.focus();
      return;
    }

    // Any other child composite that already handled the arrow keeps it; do
    // not steal focus back into the toolbar.
    if (e.defaultPrevented) return;
    const bar = e.currentTarget as HTMLElement;
    const items = [...bar.querySelectorAll<HTMLElement>("button:not([disabled])")];
    const at = items.indexOf(target as HTMLElement);
    if (at === -1) return;
    e.preventDefault();
    const next =
      e.key === "ArrowRight"
        ? items[(at + 1) % items.length]
        : e.key === "ArrowLeft"
          ? items[(at - 1 + items.length) % items.length]
          : e.key === "Home"
            ? items[0]
            : items[items.length - 1];
    next?.focus();
  };

  return (
    <div
      className="tok-toolbar"
      role="toolbar"
      aria-label="Token actions"
      onKeyDown={onToolbarKeyDown}
    >
      <div className="tok-search">
        <span className="tok-filter-wrap">
          <Icon name="search" size={14} className="tok-search-ico" />
          <input
            ref={filterRef}
            type="search"
            className="tok-filter"
            name="filter"
            placeholder="Filter tokens…"
            value={filter}
            autoComplete="off"
            aria-label="Filter tokens"
            onChange={(e) => setFilter(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                // Clearing the filter is this field's own Escape; consume it so
                // it never bubbles to a layout-level keydown (the docked
                // Preview inspector, force-mounted on the other tab) and closes
                // a panel the user cannot even see.
                e.preventDefault();
                setFilter("");
              }
            }}
          />
        {filter && (
          <button
            className="tok-filter-clear"
            aria-label="Clear filter"
            title="Clear filter (Esc)"
            onClick={() => {
              setFilter("");
              // Clearing drops the button that had focus; keep the caret in
              // the filter so typing can continue (the SectionSearch pattern).
              filterRef.current?.focus();
            }}
          >
            ×
          </button>
        )}
        </span>
        {!schemaMode && (
          <label className="tok-inline">
            <Checkbox.Root
              className="tok-check"
              checked={showMissing}
              onCheckedChange={(checked) => setShowMissing(checked === true)}
            >
              <Checkbox.Indicator className="tok-check-indicator">
                <Icon name="check" size={12} />
              </Checkbox.Indicator>
            </Checkbox.Root>
            Show missing
          </label>
        )}
      </div>
      <div className="tok-actions">
        {/* Segmented view switch (issue #312): both views are always named,
            the active one reads selected — the old single Toggle renamed
            itself ("Schema" here, "Gallery" there) and read as an action
            button. Drives the same schemaMode/setSchemaMode, so ?tv=schema
            keeps working. The switch is its own roving radio group: it wraps
            ArrowLeft/ArrowRight inside itself and calls preventDefault, which
            the toolbar's roving handler defers to. */}
        <ToggleGroup.Root
          type="single"
          aria-label="View"
          value={schemaMode ? "schema" : "gallery"}
          onValueChange={(v) => {
            // Single-select deselects to "" when the active item is
            // re-clicked — ignore it so one view is always selected.
            if (v === "schema") setSchemaMode(true);
            else if (v === "gallery") setSchemaMode(false);
          }}
          className="tok-view-switch"
        >
          <ToggleGroup.Item value="gallery" aria-label="Gallery" className="tok-view-item">
            Gallery
          </ToggleGroup.Item>
          <ToggleGroup.Item value="schema" aria-label="Schema" className="tok-view-item">
            Schema
          </ToggleGroup.Item>
        </ToggleGroup.Root>
        <button
          type="button"
          className="tok-btn"
          title={`Add tokens to ${system.name}`}
          onClick={onAddTokens}
        >
          Add tokens
        </button>
      </div>
    </div>
  );
}
