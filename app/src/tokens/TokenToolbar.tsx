import * as AlertDialog from "@radix-ui/react-alert-dialog";
import * as Checkbox from "@radix-ui/react-checkbox";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import * as Toggle from "@radix-ui/react-toggle";
import { Icon } from "../lib/icons.tsx";
import type { DesignSystem } from "../systems/store.ts";
import { TokenDialog } from "./TokenDialog.tsx";
import "./TokenDialog.css";
import type { TokensViewModel } from "./useTokensView.ts";
import "./TokenToolbar.css";

/**
 * Tokens toolbar (old .toolbar, minus the coverage ring — that lives in the
 * right rail now): filter + clear/Esc, Show missing (gallery only),
 * Schema/Gallery toggle, Add tokens (Radix dialog with live coverage
 * preview), Export (Radix menu instead of the old fixed-position div) and
 * Delete (Radix AlertDialog instead of confirm()).
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

  return (
    <div className="tok-toolbar" role="toolbar" aria-label="Token actions">
      <div className="tok-search">
        <span className="tok-filter-wrap">
          <Icon name="search" size={14} className="tok-search-ico" />
          <input
            type="search"
            className="tok-filter"
            placeholder="Filter tokens…"
            value={filter}
            autoComplete="off"
            aria-label="Filter tokens"
            onChange={(e) => setFilter(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") setFilter("");
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
        <TokenDialog system={system} onMerge={onMerge} onToast={view.pushToast} />
        <Toggle.Root
          className="tok-btn"
          title="Toggle schema view"
          pressed={schemaMode}
          onPressedChange={setSchemaMode}
        >
          {schemaMode ? "Gallery" : "Schema"}
        </Toggle.Root>
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
            <AlertDialog.Content className="tok-dialog">
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
