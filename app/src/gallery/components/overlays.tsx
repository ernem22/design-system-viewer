import * as AlertDialog from "@radix-ui/react-alert-dialog";
import * as ContextMenu from "@radix-ui/react-context-menu";
import * as Dialog from "@radix-ui/react-dialog";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import * as HoverCard from "@radix-ui/react-hover-card";
import * as Popover from "@radix-ui/react-popover";
import * as Tooltip from "@radix-ui/react-tooltip";
import { Button, Demo, Field, usePortalContainer } from "../ui.tsx";
import { Icon } from "../../lib/icons.tsx";
import "./overlays.css";

interface MegaMenuGroup {
  heading: string;
  items: string[];
}

const MEGA_MENU: MegaMenuGroup[] = [
  { heading: "Product", items: ["Analytics", "Dashboard", "Automation"] },
  { heading: "Company", items: ["About", "Careers", "Press"] },
  { heading: "Resources", items: ["Docs", "API", "Status"] },
];

export default function OverlaysBody() {
  const portalContainer = usePortalContainer();
  return (
    <>
      <Demo title="Dialog">
        <Dialog.Root>
          <Dialog.Trigger asChild>
            <Button variant="outline">Edit profile</Button>
          </Dialog.Trigger>
          <Dialog.Portal container={portalContainer}>
            <Dialog.Overlay className="dsv-overlay" />
            <Dialog.Content className="dsv-modal">
              <Dialog.Title asChild>
                <h3>Edit profile</h3>
              </Dialog.Title>
              <Dialog.Description asChild>
                <p>Changes apply after saving.</p>
              </Dialog.Description>
              <div className="dsv-stack">
                <Field label="Name" id="d-name">
                  <input id="d-name" className="dsv-input" defaultValue="Ada Lovelace" />
                </Field>
                <Field label="Username" id="d-user">
                  <input id="d-user" className="dsv-input" defaultValue="@ada" />
                </Field>
              </div>
              <div className="dsv-modal-actions dsv-modal-actions--spaced">
                <Dialog.Close asChild>
                  <Button variant="ghost">Cancel</Button>
                </Dialog.Close>
                <Dialog.Close asChild>
                  <Button>Save</Button>
                </Dialog.Close>
              </div>
              <Dialog.Close asChild>
                <button className="dsv-btn dsv-btn--ghost dsv-icon-btn dsv-dialog-close" aria-label="Close">
                  <Icon name="x" size={16} />
                </button>
              </Dialog.Close>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      </Demo>

      <Demo title="Alert Dialog">
        <AlertDialog.Root>
          <AlertDialog.Trigger asChild>
            <Button variant="danger">Delete account</Button>
          </AlertDialog.Trigger>
          <AlertDialog.Portal container={portalContainer}>
            <AlertDialog.Overlay className="dsv-overlay" />
            <AlertDialog.Content className="dsv-modal">
              <AlertDialog.Title asChild>
                <h3>Are you sure?</h3>
              </AlertDialog.Title>
              <AlertDialog.Description asChild>
                <p>This cannot be undone. All data will be permanently deleted.</p>
              </AlertDialog.Description>
              <div className="dsv-modal-actions">
                <AlertDialog.Cancel asChild>
                  <Button variant="ghost">Cancel</Button>
                </AlertDialog.Cancel>
                <AlertDialog.Action asChild>
                  <Button variant="danger">Yes, delete</Button>
                </AlertDialog.Action>
              </div>
            </AlertDialog.Content>
          </AlertDialog.Portal>
        </AlertDialog.Root>
      </Demo>

      <Demo title="Popover">
        <Popover.Root>
          <Popover.Trigger asChild>
            <Button variant="outline">Size settings</Button>
          </Popover.Trigger>
          <Popover.Portal container={portalContainer}>
            <Popover.Content className="dsv-pop" sideOffset={6}>
              <div className="dsv-stack">
                <strong className="dsv-pop-heading">Dimensions</strong>
                <Field label="Width" id="p-w">
                  <input id="p-w" className="dsv-input" defaultValue="240px" />
                </Field>
                <Field label="Height" id="p-h">
                  <input id="p-h" className="dsv-input" defaultValue="auto" />
                </Field>
              </div>
              <Popover.Arrow className="dsv-pop-arrow" />
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>
      </Demo>

      <Demo title="Tooltip">
        <Tooltip.Provider delayDuration={200}>
          <Tooltip.Root>
            <Tooltip.Trigger asChild>
              <Button variant="ghost" className="dsv-icon-btn" aria-label="Notifications">
                <Icon name="bell" />
              </Button>
            </Tooltip.Trigger>
            <Tooltip.Portal container={portalContainer}>
              <Tooltip.Content className="dsv-tooltip" sideOffset={6}>
                Notifications
                <Tooltip.Arrow className="dsv-tooltip-arrow" />
              </Tooltip.Content>
            </Tooltip.Portal>
          </Tooltip.Root>
        </Tooltip.Provider>
      </Demo>

      <Demo title="Dropdown Menu">
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <Button variant="outline">
              <Icon name="dots" size={14} /> Menu
            </Button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal container={portalContainer}>
            <DropdownMenu.Content className="dsv-menu" sideOffset={6} align="start">
              <DropdownMenu.Label className="dsv-menu-label">Account</DropdownMenu.Label>
              <DropdownMenu.Item className="dsv-menu-item">
                <Icon name="user" size={14} /> Profile <span className="dsv-menu-shortcut">⌘P</span>
              </DropdownMenu.Item>
              <DropdownMenu.Item className="dsv-menu-item">
                <Icon name="settings" size={14} /> Settings
              </DropdownMenu.Item>
              <DropdownMenu.Sub>
                <DropdownMenu.SubTrigger className="dsv-menu-subtrigger">
                  Theme <span className="dsv-menu-subtrigger-chevron"><Icon name="chevronRight" size={14} /></span>
                </DropdownMenu.SubTrigger>
                <DropdownMenu.Portal container={portalContainer}>
                  <DropdownMenu.SubContent className="dsv-menu" sideOffset={2} alignOffset={-4}>
                    <DropdownMenu.Item className="dsv-menu-item">Light</DropdownMenu.Item>
                    <DropdownMenu.Item className="dsv-menu-item">Dark</DropdownMenu.Item>
                    <DropdownMenu.Item className="dsv-menu-item">System</DropdownMenu.Item>
                  </DropdownMenu.SubContent>
                </DropdownMenu.Portal>
              </DropdownMenu.Sub>
              <DropdownMenu.Separator className="dsv-menu-sep" />
              <DropdownMenu.Item className="dsv-menu-item dsv-menu-item--danger">
                <Icon name="trash" size={14} /> Sign out
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </Demo>

      <Demo title="Context Menu (right-click)">
        <ContextMenu.Root>
          <ContextMenu.Trigger asChild>
            <div className="dsv-card dsv-card--dashed">Right-click here</div>
          </ContextMenu.Trigger>
          <ContextMenu.Portal container={portalContainer}>
            <ContextMenu.Content className="dsv-menu">
              <ContextMenu.Item className="dsv-menu-item">
                Undo <span className="dsv-menu-shortcut">⌘Z</span>
              </ContextMenu.Item>
              <ContextMenu.Item className="dsv-menu-item">
                Redo <span className="dsv-menu-shortcut">⇧⌘Z</span>
              </ContextMenu.Item>
              <ContextMenu.Separator className="dsv-menu-sep" />
              <ContextMenu.CheckboxItem className="dsv-menu-item dsv-menu-check" defaultChecked>
                <ContextMenu.ItemIndicator className="dsv-menu-item-indicator">
                  <Icon name="check" size={14} />
                </ContextMenu.ItemIndicator>
                Show grid
              </ContextMenu.CheckboxItem>
              <ContextMenu.Separator className="dsv-menu-sep" />
              <ContextMenu.Item className="dsv-menu-item dsv-menu-item--danger">Delete</ContextMenu.Item>
            </ContextMenu.Content>
          </ContextMenu.Portal>
        </ContextMenu.Root>
      </Demo>

      <Demo title="Hover Card">
        <HoverCard.Root openDelay={150}>
          <HoverCard.Trigger asChild>
            <a className="dsv-link" href="#overlays">
              @ada
            </a>
          </HoverCard.Trigger>
          <HoverCard.Portal container={portalContainer}>
            <HoverCard.Content className="dsv-pop" sideOffset={6}>
              <div className="dsv-hovercard">
                <span className="dsv-avatar dsv-avatar--lg">
                  <span className="dsv-avatar-fallback">AL</span>
                </span>
                <div>
                  <div className="name">Ada Lovelace</div>
                  <div className="bio">The first programmer. Analytical Engine notes, 1843.</div>
                </div>
              </div>
              <HoverCard.Arrow className="dsv-pop-arrow" />
            </HoverCard.Content>
          </HoverCard.Portal>
        </HoverCard.Root>
      </Demo>

      <Demo title="Popover — large (shadow-xl)">
        <Popover.Root>
          <Popover.Trigger asChild>
            <Button variant="outline">Mega menu</Button>
          </Popover.Trigger>
          <Popover.Portal container={portalContainer}>
            <Popover.Content className="dsv-pop dsv-pop--lg" sideOffset={6}>
              <div className="dsv-mega-menu-grid">
                {MEGA_MENU.map((group) => (
                  <div key={group.heading}>
                    <div className="dsv-menu-label">{group.heading}</div>
                    {group.items.map((item) => (
                      <a key={item} className="dsv-link dsv-mega-menu-link" href="#navigation">
                        {item}
                      </a>
                    ))}
                  </div>
                ))}
              </div>
              <Popover.Arrow className="dsv-pop-arrow" />
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>
      </Demo>
    </>
  );
}
