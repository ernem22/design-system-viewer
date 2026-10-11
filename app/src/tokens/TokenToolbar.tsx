import * as AlertDialog from "@radix-ui/react-alert-dialog";
import * as Checkbox from "@radix-ui/react-checkbox";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import * as ToggleGroup from "@radix-ui/react-toggle-group";
import type { KeyboardEvent } from "react";
import { Icon } from "../lib/icons.tsx";
import type { DesignSystem } from "../systems/store.ts";
import { TokenDialog } from "./TokenDialog.tsx";
import "./TokenDialog.css";
import type { TokensViewModel } from "./useTokensView.ts";
import "./TokenToolbar.css";

/**
 * Tokens toolbar (old .toolbar, minus the coverage ring — that lives in the
 * right rail now): filter + clear/Esc, Show missing (gallery only), the
 * Gallery/Schema segmented view switch, Add tokens (Radix dialog with live
 * coverage preview), Export (Radix menu instead of the old fixed-position
 * div) and Delete (Radix AlertDialog instead of confirm()).
 */
export function TokenToolbar({
  view,
  system,
  onMerge,
  onExportCss,
  onExportJson,
  onDelete,
}: {
  view: TokensViewModel;
  system: DesignSystem;
  onMerge: (css: string) => void;
  onExportCss: () => void;
  onExportJson: () => void;
  onDelete: () => void;
}) {
  const {
    filter,
    setFilter,
    showMissing,
    setShowMissing,
    schemaMode,
    setSchemaMode,
  } = view;

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
              onClick={() => setFilter("")}
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
            keeps working. Its items are plain buttons, so the toolbar's
            roving arrow-key navigation crosses them untouched. */}
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
        <TokenDialog system={system} onMerge={onMerge} onToast={view.pushToast} />
        <DropdownMenu.Root>
          <DropdownMenu.Trigger className="tok-btn" title="Download active system">
            Export
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content className="tok-menu" sideOffset={6} align="end">
              <DropdownMenu.Item className="tok-menu-item" onSelect={onExportCss}>
                CSS<code>:root stylesheet</code>
              </DropdownMenu.Item>
              <DropdownMenu.Item className="tok-menu-item" onSelect={onExportJson}>
                JSON<code>full system</code>
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
        <AlertDialog.Root>
          <AlertDialog.Trigger
            className="tok-btn tok-btn-danger"
            title={`Delete ${system.name}`}
            aria-label={`Delete ${system.name}`}
          >
            Delete
          </AlertDialog.Trigger>
          <AlertDialog.Portal>
            <AlertDialog.Overlay className="tok-dialog-overlay" />
            {/* Radix supplies role="alertdialog" + labelling atomically;
                aria-modal marks the rest of the page inert to AT. */}
            <AlertDialog.Content className="tok-dialog" aria-modal="true">
              <AlertDialog.Title className="tok-dialog-title">Delete “{system.name}”?</AlertDialog.Title>
              <AlertDialog.Description className="tok-dialog-desc">
                This cannot be undone.
              </AlertDialog.Description>
              <div className="tok-dialog-actions">
                <AlertDialog.Cancel className="tok-btn">Cancel</AlertDialog.Cancel>
                <AlertDialog.Action className="tok-btn tok-btn-danger" onClick={onDelete}>
                  Delete
                </AlertDialog.Action>
              </div>
            </AlertDialog.Content>
          </AlertDialog.Portal>
        </AlertDialog.Root>
      </div>
    </div>
  );
}
