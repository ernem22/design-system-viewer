import * as Menubar from "@radix-ui/react-menubar";
import * as NavigationMenu from "@radix-ui/react-navigation-menu";
import * as Tabs from "@radix-ui/react-tabs";
import * as Toolbar from "@radix-ui/react-toolbar";
import { Button, Demo, usePortalContainer } from "../ui.tsx";
import { Icon } from "../../lib/icons.tsx";
import "./navigation.css";

interface MenuBarMenu {
  label: string;
  items: string[];
}

const MENUBAR_MENUS: MenuBarMenu[] = [
  { label: "File", items: ["New", "Open…", "Save"] },
  { label: "Edit", items: ["Cut", "Copy", "Paste"] },
  { label: "View", items: ["Zoom in", "Zoom out", "Fullscreen"] },
];

export default function NavigationBody() {
  const portalContainer = usePortalContainer();
  return (
    <>
      <Demo title="Menubar">
        <Menubar.Root className="dsv-nav">
          {MENUBAR_MENUS.map((menu) => (
            <Menubar.Menu key={menu.label}>
              <Menubar.Trigger className="dsv-nav-trigger">{menu.label}</Menubar.Trigger>
              <Menubar.Portal container={portalContainer}>
                <Menubar.Content className="dsv-menu" sideOffset={6}>
                  {menu.items.map((item) => (
                    <Menubar.Item key={item} className="dsv-menu-item">
                      {item}
                    </Menubar.Item>
                  ))}
                </Menubar.Content>
              </Menubar.Portal>
            </Menubar.Menu>
          ))}
        </Menubar.Root>
      </Demo>

      <Demo title="Navigation Menu">
        <NavigationMenu.Root className="dsv-nav">
          <NavigationMenu.List className="dsv-nav-list">
            <NavigationMenu.Item>
              <NavigationMenu.Trigger className="dsv-nav-trigger">
                Products <Icon name="chevronDown" size={12} />
              </NavigationMenu.Trigger>
              <NavigationMenu.Content className="dsv-nav-content">
                <a className="dsv-nav-link" href="#forms">
                  Analytics
                </a>
                <a className="dsv-nav-link" href="#feedback">
                  Dashboard
                </a>
                <a className="dsv-nav-link" href="#layout">
                  Automation
                </a>
              </NavigationMenu.Content>
            </NavigationMenu.Item>
            <NavigationMenu.Item>
              <NavigationMenu.Link className="dsv-nav-link" href="#overlays">
                Pricing
              </NavigationMenu.Link>
            </NavigationMenu.Item>
            <NavigationMenu.Item>
              <NavigationMenu.Link className="dsv-nav-link" href="#navigation">
                Docs
              </NavigationMenu.Link>
            </NavigationMenu.Item>
          </NavigationMenu.List>
          <div className="dsv-nav-viewport-wrap">
            <NavigationMenu.Viewport className="dsv-nav-viewport" />
          </div>
        </NavigationMenu.Root>
      </Demo>

      <Demo title="Tabs">
        <Tabs.Root defaultValue="acc" className="dsv-tabs-root">
          <Tabs.List className="dsv-tabs-list">
            <Tabs.Trigger className="dsv-tabs-trigger" value="acc">
              Account
            </Tabs.Trigger>
            <Tabs.Trigger className="dsv-tabs-trigger" value="pass">
              Password
            </Tabs.Trigger>
            <Tabs.Trigger className="dsv-tabs-trigger" value="team">
              Team
            </Tabs.Trigger>
          </Tabs.List>
          <Tabs.Content className="dsv-tabs-content" value="acc">
            Change account info here.
          </Tabs.Content>
          <Tabs.Content className="dsv-tabs-content" value="pass">
            Update your password. Choose a strong password.
          </Tabs.Content>
          <Tabs.Content className="dsv-tabs-content" value="team">
            Manage team members and assign roles.
          </Tabs.Content>
        </Tabs.Root>
      </Demo>

      <Demo title="Toolbar">
        <Toolbar.Root className="dsv-toolbar" aria-label="Formatting">
          <Toolbar.ToggleGroup type="multiple" aria-label="Text style">
            <Toolbar.ToggleItem className="dsv-toggle" value="bold">
              <Icon name="bold" size={14} />
            </Toolbar.ToggleItem>
            <Toolbar.ToggleItem className="dsv-toggle" value="italic">
              <Icon name="italic" size={14} />
            </Toolbar.ToggleItem>
            <Toolbar.ToggleItem className="dsv-toggle" value="underline">
              <Icon name="underline" size={14} />
            </Toolbar.ToggleItem>
          </Toolbar.ToggleGroup>
          <Toolbar.Separator className="dsv-toolbar-sep" />
          <Toolbar.Button asChild>
            <Button variant="ghost" size="sm">
              Share
            </Button>
          </Toolbar.Button>
        </Toolbar.Root>
      </Demo>
    </>
  );
}
