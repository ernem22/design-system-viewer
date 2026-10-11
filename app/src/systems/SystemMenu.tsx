import * as AlertDialog from "@radix-ui/react-alert-dialog";
import * as Dialog from "@radix-ui/react-dialog";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { useState } from "react";
import { Icon } from "../lib/icons.tsx";
import type { DesignSystem } from "./store.ts";
import "./SystemMenu.css";

interface SystemMenuProps {
  system: DesignSystem | null;
  onRename: (slug: string, name: string) => void;
  onDuplicate: (slug: string) => void;
  onExportCss: () => void;
  onExportJson: () => void;
  onDelete: (slug: string) => void;
}

/**
 * System actions menu (issue #313): Export and Delete used to sit in the
 * Tokens toolbar next to the filter — acting on the whole active system but
 * reachable only from the Tokens tab, with a filled red Delete one click
 * from Export. They now live here, directly after the system switcher in
 * the topbar, on every tab; Rename and Duplicate (previously impossible)
 * join them. The trigger reuses the topbar icon-button treatment; the red
 * danger style applies only inside the delete confirm dialog.
 */
export function SystemMenu({
  system,
  onRename,
  onDuplicate,
  onExportCss,
  onExportJson,
  onDelete,
}: SystemMenuProps) {
  const [renameOpen, setRenameOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [draft, setDraft] = useState("");
  if (!system) return null;
  const trimmed = draft.trim();
  const saveRename = () => {
    if (!trimmed) return;
    onRename(system.slug, trimmed);
    setRenameOpen(false);
  };

  return (
    <>
      <DropdownMenu.Root>
        <DropdownMenu.Trigger
          className="app-iconbtn"
          aria-label="System actions"
          title="System actions"
        >
          <Icon name="dots" size={15} />
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content className="sys-menu" sideOffset={6} align="start">
            <DropdownMenu.Item
              className="sys-menu-item"
              onSelect={() => {
                setDraft(system.name);
                setRenameOpen(true);
              }}
            >
              Rename…
            </DropdownMenu.Item>
            <DropdownMenu.Item
              className="sys-menu-item"
              onSelect={() => onDuplicate(system.slug)}
            >
              Duplicate
            </DropdownMenu.Item>
            <DropdownMenu.Item className="sys-menu-item" onSelect={onExportCss}>
              Export CSS<code>:root stylesheet</code>
            </DropdownMenu.Item>
            <DropdownMenu.Item className="sys-menu-item" onSelect={onExportJson}>
              Export JSON<code>full system</code>
            </DropdownMenu.Item>
            <DropdownMenu.Separator className="sys-menu-separator" />
            <DropdownMenu.Item
              className="sys-menu-item"
              onSelect={() => setDeleteOpen(true)}
            >
              Delete…
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>

      {/* Rename dialog: name only — the slug is unchanged, so links keep
          working. An empty name cannot be saved (the button stays disabled). */}
      <Dialog.Root open={renameOpen} onOpenChange={setRenameOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="sys-dialog-overlay" />
          <Dialog.Content className="sys-dialog" aria-modal="true">
            <Dialog.Title className="sys-dialog-title">Rename system</Dialog.Title>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                saveRename();
              }}
            >
              <label className="sys-field">
                Name
                <input
                  className="sys-input"
                  value={draft}
                  autoComplete="off"
                  aria-label="System name"
                  ref={(el) => {
                    el?.select?.();
                  }}
                  onChange={(e) => setDraft(e.target.value)}
                />
              </label>
              <div className="sys-dialog-actions">
                <Dialog.Close className="sys-btn">Cancel</Dialog.Close>
                <button
                  type="submit"
                  className="sys-btn sys-btn-primary"
                  disabled={!trimmed}
                >
                  Save
                </button>
              </div>
            </form>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Delete confirm, as it read in the Tokens toolbar — the only place
          the red danger style still appears. */}
      <AlertDialog.Root open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialog.Portal>
          <AlertDialog.Overlay className="sys-dialog-overlay" />
          {/* Radix supplies role="alertdialog" + labelling atomically;
              aria-modal marks the rest of the page inert to AT. */}
          <AlertDialog.Content className="sys-dialog" aria-modal="true">
            <AlertDialog.Title className="sys-dialog-title">
              Delete “{system.name}”?
            </AlertDialog.Title>
            <AlertDialog.Description className="sys-dialog-desc">
              This cannot be undone.
            </AlertDialog.Description>
            <div className="sys-dialog-actions">
              <AlertDialog.Cancel className="sys-btn">Cancel</AlertDialog.Cancel>
              <AlertDialog.Action
                className="sys-btn sys-btn-danger"
                onClick={() => onDelete(system.slug)}
              >
                Delete
              </AlertDialog.Action>
            </div>
          </AlertDialog.Content>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    </>
  );
}
