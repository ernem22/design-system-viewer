import { useState } from "react";
import * as Accordion from "@radix-ui/react-accordion";
import * as AlertDialog from "@radix-ui/react-alert-dialog";
import { AspectRatio } from "@radix-ui/react-aspect-ratio";
import * as Avatar from "@radix-ui/react-avatar";
import * as Checkbox from "@radix-ui/react-checkbox";
import * as Collapsible from "@radix-ui/react-collapsible";
import * as ContextMenu from "@radix-ui/react-context-menu";
import * as Dialog from "@radix-ui/react-dialog";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import * as HoverCard from "@radix-ui/react-hover-card";
import { Label } from "@radix-ui/react-label";
import * as Menubar from "@radix-ui/react-menubar";
import * as NavigationMenu from "@radix-ui/react-navigation-menu";
import * as Popover from "@radix-ui/react-popover";
import * as Progress from "@radix-ui/react-progress";
import * as RadioGroup from "@radix-ui/react-radio-group";
import * as ScrollArea from "@radix-ui/react-scroll-area";
import * as Select from "@radix-ui/react-select";
import { Separator } from "@radix-ui/react-separator";
import * as Slider from "@radix-ui/react-slider";
import * as Switch from "@radix-ui/react-switch";
import * as Tabs from "@radix-ui/react-tabs";
import * as Toast from "@radix-ui/react-toast";
import { Toggle } from "@radix-ui/react-toggle";
import * as ToggleGroup from "@radix-ui/react-toggle-group";
import * as Toolbar from "@radix-ui/react-toolbar";
import * as Tooltip from "@radix-ui/react-tooltip";
import * as Form from "@radix-ui/react-form";
import * as PasswordToggleField from "@radix-ui/react-password-toggle-field";
import * as OneTimePasswordField from "@radix-ui/react-one-time-password-field";
import { AccessibleIcon } from "@radix-ui/react-accessible-icon";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { DirectionProvider } from "@radix-ui/react-direction";
import { Button, Field, Demo, Icon, usePortalContainer } from "./ui.jsx";

const Section = ({ id, title, desc, children }) => (
  <section className="dsv-section" id={id}>
    <h2>{title}</h2>
    <p>{desc}</p>
    {children}
  </section>
);

// ───────────────────────────────────────────────────────── Forms
export function FormsSection() {
  const portalContainer = usePortalContainer();
  const [checked, setChecked] = useState(true);
  const [ind, setInd] = useState("indeterminate");
  const [radio, setRadio] = useState("comfortable");
  const [sw, setSw] = useState(true);
  const [slider, setSlider] = useState([40]);
  const [range, setRange] = useState([25, 75]);

  return (
    <Section id="forms" title="Forms" desc="Inputs, selection and button primitives — all with the active system's tokens.">
      <Demo title="Button — variants">
        <Button>Solid</Button>
        <Button variant="soft">Soft</Button>
        <Button variant="outline">Outline</Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="danger">Danger</Button>
        <Button disabled>Disabled</Button>
      </Demo>
      <Demo title="Button — sizes">
        <Button size="sm">Small</Button>
        <Button>Medium</Button>
        <Button size="lg">Large</Button>
        <Button className="dsv-icon-btn" aria-label="Add"><Icon name="plus" /></Button>
      </Demo>
      <Demo title="Button — icons & loading">
        <Button><Icon name="plus" size={14} /> New project</Button>
        <Button variant="outline">Next <Icon name="chevronRight" size={14} /></Button>
        <Button disabled><span className="dsv-spinner dsv-spinner--sm" /> Saving…</Button>
        <Button variant="soft" disabled><span className="dsv-spinner dsv-spinner--sm" /> Loading</Button>
      </Demo>

      <Demo title="Input / Textarea (Label primitive)">
        <Field label="Email" id="f-email" hint="Use work address">
          <input id="f-email" className="dsv-input" type="email" placeholder="ada@example.com" />
        </Field>
        <Field label="Password" id="f-pass" error="At least 8 characters">
          <input id="f-pass" className="dsv-input" type="password" aria-invalid="true" defaultValue="123" />
        </Field>
        <Field label="Note" id="f-note">
          <textarea id="f-note" className="dsv-textarea" placeholder="Short description…" />
        </Field>
        <Field label="Disabled" id="f-dis">
          <input id="f-dis" className="dsv-input" disabled defaultValue="read-only" />
        </Field>
      </Demo>
      <Demo title="Input — adornments & counter">
        <Field label="Amount" id="f-amt">
          <div className="dsv-input-wrap dsv-input-wrap--prefix">
            <span className="dsv-adorn dsv-adorn--prefix">₺</span>
            <input id="f-amt" className="dsv-input" inputMode="decimal" placeholder="0.00" />
          </div>
        </Field>
        <Field label="Search" id="f-search">
          <div className="dsv-input-wrap dsv-input-wrap--prefix">
            <span className="dsv-adorn dsv-adorn--prefix"><Icon name="search" size={14} /></span>
            <input id="f-search" className="dsv-input" placeholder="Search…" />
          </div>
        </Field>
        <Field label="Domain" id="f-dom" hint="18 / 30">
          <div className="dsv-input-wrap dsv-input-wrap--suffix">
            <input id="f-dom" className="dsv-input" defaultValue="acme-design-system" maxLength={30} />
            <span className="dsv-adorn dsv-adorn--suffix dsv-counter">18/30</span>
          </div>
        </Field>
      </Demo>
      <Demo title="Input — inset & success">
        <Field label="Inset (sunken well)" id="f-inset">
          <input id="f-inset" className="dsv-input dsv-input--inset" placeholder="Inset variant" />
        </Field>
        <Field label="Username" id="f-ok" hint="Available">
          <input id="f-ok" className="dsv-input dsv-input--success" defaultValue="ada_lovelace" aria-invalid="false" />
        </Field>
      </Demo>
      <Demo title="Input — themed tokens">
        <Field label="Themed" id="f-themed" hint="bg / border / focus / placeholder tokens">
          <input id="f-themed" className="dsv-input dsv-input--themed" placeholder="Type here…" />
        </Field>
      </Demo>
      <Demo title="Disabled treatment">
        <div className="dsv-disabled-box" style={{ minWidth: "var(--space-56)" }}>
          <div className="dsv-inline"><Icon name="x" size={14} /> Unavailable</div>
          <div style={{ fontSize: "var(--font-size-xs)", marginTop: "var(--space-1)" }}>surface + border + icon tokens</div>
        </div>
        <div className="dsv-disabled-box is-dim" style={{ minWidth: "var(--space-56)" }}>
          <div className="dsv-inline"><Icon name="x" size={14} /> Dimmed (--opacity-disabled)</div>
          <div style={{ fontSize: "var(--font-size-xs)", marginTop: "var(--space-1)" }}>same box at --opacity-disabled</div>
        </div>
      </Demo>

      <Demo title="Checkbox">
        <label className="dsv-control-label">
          <Checkbox.Root className="dsv-check" checked={checked} onCheckedChange={setChecked}>
            <Checkbox.Indicator><Icon name="check" size={14} /></Checkbox.Indicator>
          </Checkbox.Root>
          Subscribe to newsletter
        </label>
        <label className="dsv-control-label">
          <Checkbox.Root className="dsv-check" checked={ind} onCheckedChange={(v) => setInd(v === true ? true : v === false ? false : "indeterminate")}>
            <Checkbox.Indicator>{ind === "indeterminate" ? <Icon name="minus" size={14} /> : <Icon name="check" size={14} />}</Checkbox.Indicator>
          </Checkbox.Root>
          Indeterminate state
        </label>
        <label className="dsv-control-label" style={{ opacity: 0.6 }}>
          <Checkbox.Root className="dsv-check" disabled>
            <Checkbox.Indicator><Icon name="check" size={14} /></Checkbox.Indicator>
          </Checkbox.Root>
          Disabled
        </label>
      </Demo>

      <Demo title="Radio Group">
        <RadioGroup.Root className="dsv-stack" value={radio} onValueChange={setRadio}>
          {["compact", "comfortable", "spacious"].map((v) => (
            <label key={v} className="dsv-control-label">
              <RadioGroup.Item className="dsv-radio" value={v}>
                <RadioGroup.Indicator className="dsv-radio-indicator" />
              </RadioGroup.Item>
              {v}
            </label>
          ))}
        </RadioGroup.Root>
      </Demo>

      <Demo title="Switch">
        <label className="dsv-control-label">
          <Switch.Root className="dsv-switch" checked={sw} onCheckedChange={setSw}>
            <Switch.Thumb className="dsv-switch-thumb" />
          </Switch.Root>
          Auto save
        </label>
        <label className="dsv-control-label" style={{ opacity: 0.6 }}>
          <Switch.Root className="dsv-switch" disabled>
            <Switch.Thumb className="dsv-switch-thumb" />
          </Switch.Root>
          Disabled
        </label>
      </Demo>

      <Demo title="Slider">
        <Slider.Root className="dsv-slider" value={slider} onValueChange={setSlider} max={100} step={1}>
          <Slider.Track className="dsv-slider-track"><Slider.Range className="dsv-slider-range" /></Slider.Track>
          <Slider.Thumb className="dsv-slider-thumb" aria-label="Value" />
        </Slider.Root>
        <span className="dsv-mono dsv-muted">{slider[0]}</span>
        <Slider.Root className="dsv-slider" value={range} onValueChange={setRange} max={100} step={1}>
          <Slider.Track className="dsv-slider-track"><Slider.Range className="dsv-slider-range" /></Slider.Track>
          <Slider.Thumb className="dsv-slider-thumb" aria-label="Low" />
          <Slider.Thumb className="dsv-slider-thumb" aria-label="High" />
        </Slider.Root>
        <span className="dsv-mono dsv-muted">{range.join("–")}</span>
      </Demo>

      <Demo title="Select">
        <Select.Root defaultValue="tr">
          <Select.Trigger className="dsv-select-trigger" aria-label="Language">
            <Select.Value />
            <Select.Icon><Icon name="chevronDown" size={14} /></Select.Icon>
          </Select.Trigger>
          <Select.Portal container={portalContainer}>
            <Select.Content className="dsv-select-content" position="popper" sideOffset={6}>
              <Select.Viewport>
                <Select.Group>
                  <Select.Label className="dsv-select-label">Languages</Select.Label>
                  {[["tr", "Turkish"], ["en", "English"], ["de", "German"], ["fr", "French"]].map(([v, l]) => (
                    <Select.Item key={v} value={v} className="dsv-select-item">
                      <Select.ItemIndicator className="dsv-select-item-indicator"><Icon name="check" size={14} /></Select.ItemIndicator>
                      <Select.ItemText>{l}</Select.ItemText>
                    </Select.Item>
                  ))}
                </Select.Group>
              </Select.Viewport>
            </Select.Content>
          </Select.Portal>
        </Select.Root>
      </Demo>

      <Demo title="Toggle / Toggle Group">
        <Toggle className="dsv-toggle" aria-label="Bold"><Icon name="bold" size={14} /></Toggle>
        <ToggleGroup.Root className="dsv-toggle-group" type="single" defaultValue="center" aria-label="Align">
          <ToggleGroup.Item className="dsv-toggle" value="left"><Icon name="alignLeft" size={14} /></ToggleGroup.Item>
          <ToggleGroup.Item className="dsv-toggle" value="center"><Icon name="alignCenter" size={14} /></ToggleGroup.Item>
          <ToggleGroup.Item className="dsv-toggle" value="right"><Icon name="alignRight" size={14} /></ToggleGroup.Item>
        </ToggleGroup.Root>
      </Demo>
    </Section>
  );
}

// ───────────────────────────────────────────────────────── Overlays
export function OverlaysSection() {
  const portalContainer = usePortalContainer();
  return (
    <Section id="overlays" title="Overlays" desc="Dialog, menu, popover, tooltip — portal + scrim + focus from Radix, appearance from tokens.">
      <Demo title="Dialog">
        <Dialog.Root>
          <Dialog.Trigger asChild><Button variant="outline">Edit profile</Button></Dialog.Trigger>
          <Dialog.Portal container={portalContainer}>
            <Dialog.Overlay className="dsv-overlay" />
            <Dialog.Content className="dsv-modal">
              <Dialog.Title asChild><h3>Edit profile</h3></Dialog.Title>
              <Dialog.Description asChild><p>Changes apply after saving.</p></Dialog.Description>
              <div className="dsv-stack">
                <Field label="Name" id="d-name"><input id="d-name" className="dsv-input" defaultValue="Ada Lovelace" /></Field>
                <Field label="Username" id="d-user"><input id="d-user" className="dsv-input" defaultValue="@ada" /></Field>
              </div>
              <div className="dsv-modal-actions" style={{ marginTop: "var(--space-5)" }}>
                <Dialog.Close asChild><Button variant="ghost">Cancel</Button></Dialog.Close>
                <Dialog.Close asChild><Button>Save</Button></Dialog.Close>
              </div>
              <Dialog.Close asChild>
                <button className="dsv-btn dsv-btn--ghost dsv-icon-btn" aria-label="Close" style={{ position: "absolute", top: "var(--space-3)", right: "var(--space-3)" }}><Icon name="x" size={16} /></button>
              </Dialog.Close>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      </Demo>

      <Demo title="Alert Dialog">
        <AlertDialog.Root>
          <AlertDialog.Trigger asChild><Button variant="danger">Delete account</Button></AlertDialog.Trigger>
          <AlertDialog.Portal container={portalContainer}>
            <AlertDialog.Overlay className="dsv-overlay" />
            <AlertDialog.Content className="dsv-modal">
              <AlertDialog.Title asChild><h3>Are you sure?</h3></AlertDialog.Title>
              <AlertDialog.Description asChild><p>This cannot be undone. All data will be permanently deleted.</p></AlertDialog.Description>
              <div className="dsv-modal-actions">
                <AlertDialog.Cancel asChild><Button variant="ghost">Cancel</Button></AlertDialog.Cancel>
                <AlertDialog.Action asChild><Button variant="danger">Yes, delete</Button></AlertDialog.Action>
              </div>
            </AlertDialog.Content>
          </AlertDialog.Portal>
        </AlertDialog.Root>
      </Demo>

      <Demo title="Popover">
        <Popover.Root>
          <Popover.Trigger asChild><Button variant="outline">Size settings</Button></Popover.Trigger>
          <Popover.Portal container={portalContainer}>
            <Popover.Content className="dsv-pop" sideOffset={6}>
              <div className="dsv-stack">
                <strong style={{ fontSize: "var(--font-size-sm)" }}>Dimensions</strong>
                <Field label="Width" id="p-w"><input id="p-w" className="dsv-input" defaultValue="240px" /></Field>
                <Field label="Height" id="p-h"><input id="p-h" className="dsv-input" defaultValue="auto" /></Field>
              </div>
              <Popover.Arrow style={{ fill: "var(--color-surface-raised)" }} />
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>
      </Demo>

      <Demo title="Tooltip">
        <Tooltip.Provider delayDuration={200}>
          <Tooltip.Root>
            <Tooltip.Trigger asChild><Button variant="ghost" className="dsv-icon-btn" aria-label="Notifications"><Icon name="bell" /></Button></Tooltip.Trigger>
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
          <DropdownMenu.Trigger asChild><Button variant="outline"><Icon name="dots" size={14} /> Menu</Button></DropdownMenu.Trigger>
          <DropdownMenu.Portal container={portalContainer}>
            <DropdownMenu.Content className="dsv-menu" sideOffset={6} align="start">
              <DropdownMenu.Label className="dsv-menu-label">Account</DropdownMenu.Label>
              <DropdownMenu.Item className="dsv-menu-item"><Icon name="user" size={14} /> Profile <span className="dsv-menu-shortcut">⌘P</span></DropdownMenu.Item>
              <DropdownMenu.Item className="dsv-menu-item"><Icon name="settings" size={14} /> Settings</DropdownMenu.Item>
              <DropdownMenu.Sub>
                <DropdownMenu.SubTrigger className="dsv-menu-subtrigger">Theme <span style={{ marginLeft: "auto" }}><Icon name="chevronRight" size={14} /></span></DropdownMenu.SubTrigger>
                <DropdownMenu.Portal container={portalContainer}>
                  <DropdownMenu.SubContent className="dsv-menu" sideOffset={2} alignOffset={-4}>
                    <DropdownMenu.Item className="dsv-menu-item">Light</DropdownMenu.Item>
                    <DropdownMenu.Item className="dsv-menu-item">Dark</DropdownMenu.Item>
                    <DropdownMenu.Item className="dsv-menu-item">System</DropdownMenu.Item>
                  </DropdownMenu.SubContent>
                </DropdownMenu.Portal>
              </DropdownMenu.Sub>
              <DropdownMenu.Separator className="dsv-menu-sep" />
              <DropdownMenu.Item className="dsv-menu-item dsv-menu-item--danger"><Icon name="trash" size={14} /> Sign out</DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </Demo>

      <Demo title="Context Menu (right-click)">
        <ContextMenu.Root>
          <ContextMenu.Trigger asChild>
            <div className="dsv-card" style={{ display: "grid", placeItems: "center", width: "var(--space-56)", height: "var(--space-24)", borderStyle: "dashed" }}>
              Right-click here
            </div>
          </ContextMenu.Trigger>
          <ContextMenu.Portal container={portalContainer}>
            <ContextMenu.Content className="dsv-menu">
              <ContextMenu.Item className="dsv-menu-item">Undo <span className="dsv-menu-shortcut">⌘Z</span></ContextMenu.Item>
              <ContextMenu.Item className="dsv-menu-item">Redo <span className="dsv-menu-shortcut">⇧⌘Z</span></ContextMenu.Item>
              <ContextMenu.Separator className="dsv-menu-sep" />
              <ContextMenu.CheckboxItem className="dsv-menu-item dsv-menu-check" defaultChecked>
                <ContextMenu.ItemIndicator className="dsv-menu-item-indicator"><Icon name="check" size={14} /></ContextMenu.ItemIndicator>
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
          <HoverCard.Trigger asChild><a className="dsv-link" href="#forms">@ada</a></HoverCard.Trigger>
          <HoverCard.Portal container={portalContainer}>
            <HoverCard.Content className="dsv-pop" sideOffset={6}>
              <div className="dsv-hovercard">
                <span className="dsv-avatar dsv-avatar--lg"><span className="dsv-avatar-fallback">AL</span></span>
                <div>
                  <div className="name">Ada Lovelace</div>
                  <div className="bio">The first programmer. Analytical Engine notes, 1843.</div>
                </div>
              </div>
              <HoverCard.Arrow style={{ fill: "var(--color-surface-raised)" }} />
            </HoverCard.Content>
          </HoverCard.Portal>
        </HoverCard.Root>
      </Demo>
      <Demo title="Popover — large (shadow-xl)">
        <Popover.Root>
          <Popover.Trigger asChild><Button variant="outline">Mega menu</Button></Popover.Trigger>
          <Popover.Portal container={portalContainer}>
            <Popover.Content className="dsv-pop dsv-pop--lg" sideOffset={6}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "var(--space-4)" }}>
                {[["Product", ["Analytics", "Dashboard", "Automation"]], ["Company", ["About", "Careers", "Press"]], ["Resources", ["Docs", "API", "Status"]]].map(([h, items]) => (
                  <div key={h}>
                    <div className="dsv-menu-label">{h}</div>
                    {items.map((it) => <a key={it} className="dsv-link" href="#navigation" style={{ display: "block", padding: "var(--space-1) 0", textDecoration: "none" }}>{it}</a>)}
                  </div>
                ))}
              </div>
              <Popover.Arrow style={{ fill: "var(--color-surface-raised)" }} />
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>
      </Demo>
    </Section>
  );
}

// ───────────────────────────────────────────────────────── Navigation
export function NavigationSection() {
  const portalContainer = usePortalContainer();
  return (
    <Section id="navigation" title="Navigation" desc="Menubar, navigation menu, tabs, toolbar.">
      <Demo title="Menubar">
        <Menubar.Root className="dsv-nav">
          {[["File", ["New", "Open…", "Save"]], ["Edit", ["Cut", "Copy", "Paste"]], ["View", ["Zoom in", "Zoom out", "Fullscreen"]]].map(([m, items]) => (
            <Menubar.Menu key={m}>
              <Menubar.Trigger className="dsv-nav-trigger">{m}</Menubar.Trigger>
              <Menubar.Portal container={portalContainer}>
                <Menubar.Content className="dsv-menu" sideOffset={6}>
                  {items.map((it) => <Menubar.Item key={it} className="dsv-menu-item">{it}</Menubar.Item>)}
                </Menubar.Content>
              </Menubar.Portal>
            </Menubar.Menu>
          ))}
        </Menubar.Root>
      </Demo>

      <Demo title="Navigation Menu">
        <NavigationMenu.Root className="dsv-nav">
          <NavigationMenu.List style={{ display: "flex", gap: "var(--space-1)", listStyle: "none", margin: 0, padding: 0 }}>
            <NavigationMenu.Item>
              <NavigationMenu.Trigger className="dsv-nav-trigger">Products <Icon name="chevronDown" size={12} /></NavigationMenu.Trigger>
              <NavigationMenu.Content className="dsv-nav-content" style={{ padding: "var(--space-2)" }}>
                <a className="dsv-nav-link" href="#forms">Analytics</a>
                <a className="dsv-nav-link" href="#forms">Dashboard</a>
                <a className="dsv-nav-link" href="#forms">Automation</a>
              </NavigationMenu.Content>
            </NavigationMenu.Item>
            <NavigationMenu.Item><NavigationMenu.Link className="dsv-nav-link" href="#overlays">Pricing</NavigationMenu.Link></NavigationMenu.Item>
            <NavigationMenu.Item><NavigationMenu.Link className="dsv-nav-link" href="#navigation">Docs</NavigationMenu.Link></NavigationMenu.Item>
          </NavigationMenu.List>
          <div className="dsv-nav-viewport-wrap"><NavigationMenu.Viewport className="dsv-nav-viewport" /></div>
        </NavigationMenu.Root>
      </Demo>

      <Demo title="Tabs">
        <Tabs.Root defaultValue="acc" style={{ width: "var(--space-96)", maxWidth: "100%" }}>
          <Tabs.List className="dsv-tabs-list">
            <Tabs.Trigger className="dsv-tabs-trigger" value="acc">Account</Tabs.Trigger>
            <Tabs.Trigger className="dsv-tabs-trigger" value="pass">Password</Tabs.Trigger>
            <Tabs.Trigger className="dsv-tabs-trigger" value="team">Team</Tabs.Trigger>
          </Tabs.List>
          <Tabs.Content className="dsv-tabs-content" value="acc">Change account info here.</Tabs.Content>
          <Tabs.Content className="dsv-tabs-content" value="pass">Update your password. Choose a strong password.</Tabs.Content>
          <Tabs.Content className="dsv-tabs-content" value="team">Manage team members and assign roles.</Tabs.Content>
        </Tabs.Root>
      </Demo>

      <Demo title="Toolbar">
        <Toolbar.Root className="dsv-toolbar" aria-label="Formatting">
          <Toolbar.ToggleGroup type="multiple" aria-label="Text style">
            <Toolbar.ToggleItem className="dsv-toggle" value="bold"><Icon name="bold" size={14} /></Toolbar.ToggleItem>
            <Toolbar.ToggleItem className="dsv-toggle" value="italic"><Icon name="italic" size={14} /></Toolbar.ToggleItem>
            <Toolbar.ToggleItem className="dsv-toggle" value="underline"><Icon name="underline" size={14} /></Toolbar.ToggleItem>
          </Toolbar.ToggleGroup>
          <Toolbar.Separator className="dsv-toolbar-sep" />
          <Toolbar.Button asChild><Button variant="ghost" size="sm">Share</Button></Toolbar.Button>
        </Toolbar.Root>
      </Demo>
    </Section>
  );
}

// ───────────────────────────────────────────────────────── Form + validation
function OtpDemo() {
  const [val, setVal] = useState("");
  return (
    <OneTimePasswordField.Root className="dsv-otp" value={val} onValueChange={setVal}>
      {Array.from({ length: 6 }, (_, i) => <OneTimePasswordField.Input key={i} />)}
      <OneTimePasswordField.HiddenInput />
    </OneTimePasswordField.Root>
  );
}

export function FormSection() {
  const [sent, setSent] = useState(0);
  return (
    <Section id="form" title="Form + validation" desc="Radix Form (built-in validation + messages), Password Toggle Field, One-Time Password Field.">
      <Demo title="Radix Form — client validation">
        {/* key: successful submit rebuilds the tree → native form reset behavior */}
        <Form.Root
          key={sent}
          style={{ maxWidth: "var(--space-80)", width: "100%" }}
          onSubmit={(e) => { e.preventDefault(); setSent((n) => n + 1); }}
        >
          <Form.Field name="email" className="dsv-form-field">
            <div className="dsv-form-row">
              <Form.Label className="dsv-label">Email</Form.Label>
              <Form.Message className="dsv-form-message" match="valueMissing">required</Form.Message>
              <Form.Message className="dsv-form-message" match="typeMismatch">invalid email</Form.Message>
            </div>
            <Form.Control asChild><input className="dsv-input" type="email" required placeholder="ada@example.com" /></Form.Control>
          </Form.Field>
          <Form.Field name="msg" className="dsv-form-field">
            <div className="dsv-form-row">
              <Form.Label className="dsv-label">Message</Form.Label>
              <Form.Message className="dsv-form-message" match="valueMissing">required</Form.Message>
              <Form.Message className="dsv-form-message" match={(v) => v.length < 10}>at least 10 characters</Form.Message>
            </div>
            <Form.Control asChild><textarea className="dsv-textarea" required /></Form.Control>
          </Form.Field>
          <Form.Submit asChild><Button style={{ width: "100%" }}>Submit</Button></Form.Submit>
          {sent > 0 && <p className="dsv-form-message" data-valid style={{ marginTop: "var(--space-2)" }}>✓ submitted</p>}
        </Form.Root>
      </Demo>

      <Demo title="Password Toggle Field">
        <div className="dsv-field" style={{ maxWidth: "var(--space-72)" }}>
          <span className="dsv-label">Password</span>
          <PasswordToggleField.Root>
            <div className="dsv-pwd">
              <PasswordToggleField.Input className="dsv-input" defaultValue="hunter2" />
              <PasswordToggleField.Toggle aria-label="Show/hide password">
                <PasswordToggleField.Icon visible={<Icon name="eyeOff" size={15} />} hidden={<Icon name="eye" size={15} />} />
              </PasswordToggleField.Toggle>
            </div>
          </PasswordToggleField.Root>
        </div>
      </Demo>

      <Demo title="One-Time Password Field (6 digits, paste supported)">
        <OtpDemo />
      </Demo>
    </Section>
  );
}

// ───────────────────────────────────────────────────────── Utilities
export function UtilitiesSection() {
  return (
    <Section id="utilities" title="Utilities" desc="Invisible but important: Accessible Icon, Visually Hidden, Direction Provider.">
      <Demo title="Accessible Icon — icon button screen reader label">
        <Button className="dsv-icon-btn">
          <AccessibleIcon label="Delete item"><Icon name="trash" /></AccessibleIcon>
        </Button>
        <span className="dsv-muted" style={{ fontSize: "var(--font-size-sm)" }}>
          visually same, screen reader says "Delete item"
        </span>
      </Demo>

      <Demo title="Visually Hidden — not visible, but in accessibility tree">
        <Button variant="outline">
          Save
          <VisuallyHidden> and return to editor</VisuallyHidden>
        </Button>
      </Demo>

      <Demo title="Direction Provider — RTL">
        <DirectionProvider dir="rtl">
          <div className="dsv-toolbar" dir="rtl">
            <Button size="sm" variant="ghost">قص</Button>
            <Button size="sm" variant="ghost">نسخ</Button>
            <span className="dsv-toolbar-sep" />
            <Button size="sm">حفظ</Button>
          </div>
        </DirectionProvider>
      </Demo>
    </Section>
  );
}

// ───────────────────────────────────────────────────────── Feedback
function ToastDemo() {
  const [open, setOpen] = useState(false);
  const show = () => { setOpen(false); requestAnimationFrame(() => setOpen(true)); };
  return (
    <Toast.Provider swipeDirection="right">
      <Button variant="outline" onClick={show}>Show notification</Button>
      <Toast.Root className="dsv-toast" open={open} onOpenChange={setOpen} duration={4000}>
        <div className="dsv-toast-body">
          <Toast.Title className="dsv-toast-title">Saved</Toast.Title>
          <Toast.Description className="dsv-toast-desc">Changes uploaded to cloud.</Toast.Description>
        </div>
        <Toast.Close asChild>
          <Button variant="ghost" size="sm" className="dsv-icon-btn" aria-label="Dismiss notification"><Icon name="x" size={14} /></Button>
        </Toast.Close>
      </Toast.Root>
      <Toast.Viewport className="dsv-toast-viewport" />
    </Toast.Provider>
  );
}

export function FeedbackSection() {
  const [p, setP] = useState(66);
  return (
    <Section id="feedback" title="Feedback" desc="Progress, toast, badge, tooltip states.">
      <Demo title="Progress">
        <Progress.Root className="dsv-progress" value={p}>
          <Progress.Indicator className="dsv-progress-indicator" style={{ width: `${p}%` }} />
        </Progress.Root>
        <Button size="sm" variant="ghost" onClick={() => setP((v) => (v >= 100 ? 0 : v + 20))}>+20</Button>
        <span className="dsv-mono dsv-muted">{p}%</span>
      </Demo>
      <Demo title="Toast"><ToastDemo /></Demo>
      <Demo title="Badge">
        <span className="dsv-badge">Default</span>
        <span className="dsv-badge dsv-badge--success"><Icon name="check" size={12} /> Active</span>
        <span className="dsv-badge dsv-badge--warning">Pending</span>
        <span className="dsv-badge dsv-badge--danger">Failed</span>
        <span className="dsv-badge dsv-badge--info">Beta</span>
      </Demo>
      <Demo title="Badge (solid)">
        <span className="dsv-badge dsv-badge--success-solid">Active</span>
        <span className="dsv-badge dsv-badge--warning-solid">Pending</span>
        <span className="dsv-badge dsv-badge--danger-solid">Failed</span>
        <span className="dsv-badge dsv-badge--info-solid">Beta</span>
      </Demo>
      <Demo title="Kbd">
        <span>Save: <kbd className="dsv-kbd">⌘</kbd> <kbd className="dsv-kbd">S</kbd></span>
      </Demo>
      <Demo title="State trio — empty / loading / error">
        <div className="dsv-card" style={{ minWidth: "var(--space-48)" }}>
          <div className="dsv-empty" style={{ padding: "var(--space-6)" }}>
            <span className="glyph"><Icon name="search" size={20} /></span>
            <h4>No projects</h4>
            <p>Create one to get started.</p>
          </div>
        </div>
        <div className="dsv-card dsv-inline" style={{ minWidth: "var(--space-40)", justifyContent: "center" }}>
          <span className="dsv-spinner dsv-spinner--sm" /> <span className="dsv-muted" style={{ fontSize: "var(--font-size-sm)" }}>Loading…</span>
        </div>
        <div className="dsv-callout dsv-callout--danger" style={{ minWidth: "var(--space-48)" }}>
          <span className="ico"><Icon name="x" size={16} /></span>
          <div>Sync failed. <a className="dsv-link" href="#feedback">Retry</a></div>
        </div>
      </Demo>
    </Section>
  );
}

// ───────────────────────────────────────────────────────── Layout
export function LayoutSection() {
  const [open, setOpen] = useState(false);
  return (
    <Section id="layout" title="Layout" desc="Accordion, collapsible, separator, avatar, scroll-area, aspect-ratio.">
      <Demo title="Accordion">
        <Accordion.Root type="single" collapsible className="dsv-accordion" defaultValue="a">
          {[["a", "How long is shipping?", "Standard shipping 2–4 business days."], ["b", "What is the return policy?", "Free returns within 30 days."], ["c", "Can I get an invoice?", "Yes, emailed after ordering."]].map(([v, q, ans]) => (
            <Accordion.Item key={v} value={v} className="dsv-accordion-item">
              <Accordion.Header>
                <Accordion.Trigger className="dsv-accordion-trigger">{q}<span className="chev"><Icon name="chevronDown" size={16} /></span></Accordion.Trigger>
              </Accordion.Header>
              <Accordion.Content className="dsv-accordion-content">{ans}</Accordion.Content>
            </Accordion.Item>
          ))}
        </Accordion.Root>
      </Demo>

      <Demo title="Collapsible">
        <Collapsible.Root className="dsv-collapsible" open={open} onOpenChange={setOpen}>
          <Collapsible.Trigger asChild><Button variant="ghost" size="sm">{open ? "Hide" : "Show 3 more commits"}</Button></Collapsible.Trigger>
          <Collapsible.Content className="dsv-collapsible-content">
            <span className="dsv-mono dsv-muted">a1b2c3 — fix parser</span>
            <span className="dsv-mono dsv-muted">d4e5f6 — add tests</span>
            <span className="dsv-mono dsv-muted">7890ab — bump deps</span>
          </Collapsible.Content>
        </Collapsible.Root>
      </Demo>

      <Demo title="Separator">
        <div style={{ maxWidth: "var(--space-72)" }}>
          <div style={{ fontSize: "var(--font-size-sm)" }}>Design System Viewer</div>
          <div className="dsv-muted" style={{ fontSize: "var(--font-size-xs)" }}>Visualize tokens</div>
          <Separator className="dsv-sep" />
          <div className="dsv-inline" style={{ fontSize: "var(--font-size-sm)" }}>
            <span>Blog</span><Separator className="dsv-sep" orientation="vertical" decorative /><span>Docs</span><Separator className="dsv-sep" orientation="vertical" decorative /><span>Source</span>
          </div>
          <div className="dsv-inline" style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)" }}>
            <span>--divider-width ramp:</span>
            <span className="dsv-divider-demo" style={{ borderTop: "var(--border-width-none) solid var(--color-divider)" }}>none</span>
            <span className="dsv-divider-demo" style={{ borderTop: "var(--border-width-thin) solid var(--color-divider)" }}>thin</span>
            <span className="dsv-divider-demo" style={{ borderTop: "var(--border-width-medium) solid var(--color-divider)" }}>medium</span>
            <span className="dsv-divider-demo" style={{ borderTop: "var(--border-width-thick) solid var(--color-divider)" }}>thick</span>
          </div>
        </div>
      </Demo>

      <Demo title="Avatar">
        <span className="dsv-avatar">
          <Avatar.Root style={{ width: "100%", height: "100%", display: "flex" }}>
            <Avatar.Image src="https://i.pravatar.cc/80?img=13" alt="" />
            <Avatar.Fallback className="dsv-avatar-fallback" delayMs={600}>AL</Avatar.Fallback>
          </Avatar.Root>
        </span>
        <span className="dsv-avatar" title="no image → initials">
          <Avatar.Root style={{ width: "100%", height: "100%", display: "flex" }}>
            <Avatar.Fallback className="dsv-avatar-fallback">GK</Avatar.Fallback>
          </Avatar.Root>
        </span>
      </Demo>

      <Demo title="Avatar — sizes & presence">
        <span className="dsv-inline" style={{ gap: "var(--space-4)" }}>
          {[["var(--size-avatar-sm)", "var(--font-size-xs)", "var(--color-success)", "online"], ["var(--size-avatar-md)", "var(--font-size-sm)", "var(--color-success)", "online"], ["var(--size-avatar-lg)", "var(--font-size-base)", "var(--color-warning)", "busy"]].map(([sz, fs, fill, label]) => (
            <span key={sz} className="dsv-stack" style={{ gap: "var(--space-1)", alignItems: "center" }}>
              <span style={{ position: "relative", width: sz, height: sz, display: "inline-flex", flex: "none" }}>
                <span className="dsv-avatar" style={{ width: "100%", height: "100%" }}>
                  <span className="dsv-avatar-fallback" style={{ fontSize: fs }}>AL</span>
                </span>
                <span title={label} style={{ position: "absolute", right: -2, bottom: -2, width: "max(10px, 30%)", height: "max(10px, 30%)", maxWidth: "var(--space-3-5)", maxHeight: "var(--space-3-5)", borderRadius: "var(--radius-full)", background: fill, border: "var(--border-width-thick) solid var(--color-surface)", boxShadow: "var(--shadow-xs)" }} />
              </span>
              <span className="dsv-muted" style={{ fontSize: "var(--font-size-xs)" }}>{label}</span>
            </span>
          ))}
        </span>
        <span className="dsv-muted" style={{ fontSize: "var(--font-size-xs)" }}>presence via semantic fills</span>
      </Demo>

      <Demo title="App shell metrics">
        <div style={{ width: "100%", maxWidth: "var(--space-96)" }}>
          <div className="dsv-shell-bar dsv-inline" style={{ background: "var(--color-surface)", border: "var(--border-width-thin) solid var(--color-border-subtle)", borderRadius: "var(--radius-md)", padding: "0 var(--space-3)", marginBottom: "var(--space-2)" }}>
            <span className="dsv-inline" style={{ gap: "var(--space-1-5)" }}>
              {[0, 1, 2].map((i) => <span key={i} style={{ width: "var(--space-2-5)", height: "var(--space-2-5)", borderRadius: "var(--radius-full)", background: ["var(--color-danger-muted)", "var(--color-warning-muted)", "var(--color-success-muted)"][i] }} />)}
            </span>
            <strong style={{ fontSize: "var(--font-size-sm)" }}>Acme</strong>
            <span style={{ flex: 1 }} />
            <span className="dsv-muted" style={{ fontSize: "var(--font-size-xs)", fontFamily: "var(--font-mono)" }}>--size-header-height</span>
            <span className="dsv-avatar dsv-avatar--sm"><span className="dsv-avatar-fallback" style={{ fontSize: "var(--font-size-xs)" }}>AL</span></span>
          </div>
          <div className="dsv-inline" style={{ alignItems: "stretch", gap: "var(--space-2)", flexWrap: "wrap" }}>
            <div className="dsv-shell-side" style={{ background: "var(--color-surface-sunken)", borderRadius: "var(--radius-md)", padding: "var(--space-2)", fontSize: "var(--font-size-xs)", display: "flex", flexDirection: "column", gap: 2 }}>
              {[["Overview", true], ["Projects", false], ["Team", false], ["Settings", false]].map(([label, on]) => (
                <span key={label} style={{ padding: "var(--space-1) var(--space-2)", borderRadius: "var(--radius-sm)", background: on ? "var(--color-selected)" : "transparent", color: on ? "var(--color-accent-text)" : "var(--color-text-secondary)", fontWeight: on ? "var(--font-weight-semibold)" : "var(--font-weight-regular)" }}>{label}</span>
              ))}
              <span className="dsv-muted" style={{ fontSize: "var(--font-size-xs)", fontFamily: "var(--font-mono)", padding: "var(--space-1) var(--space-2)" }}>--size-sidebar-width</span>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="dsv-grid-12" style={{ marginBottom: "var(--space-2)" }}>
                {Array.from({ length: 12 }, (_, i) => (
                  <div key={i} style={{ height: "var(--space-4)", background: i % 2 ? "var(--color-accent-muted)" : "var(--color-accent-subtle)", borderRadius: "var(--radius-sm)" }} />
                ))}
              </div>
              <div className="dsv-muted" style={{ fontSize: "var(--font-size-xs)" }}>repeat(var(--grid-columns)) · gap var(--grid-gutter)</div>
            </div>
          </div>
          <div className="dsv-inline" style={{ marginTop: "var(--space-3)", gap: "var(--space-2)", flexWrap: "wrap" }}>
            <span className="dsv-avatar dsv-avatar--xs"><span className="dsv-avatar-fallback">XS</span></span>
            <span className="dsv-avatar dsv-avatar--sm"><span className="dsv-avatar-fallback">SM</span></span>
            <span className="dsv-avatar dsv-avatar--md"><span className="dsv-avatar-fallback">MD</span></span>
            <span className="dsv-avatar dsv-avatar--lg"><span className="dsv-avatar-fallback">LG</span></span>
            <span className="dsv-avatar dsv-avatar--xl"><span className="dsv-avatar-fallback">XL</span></span>
            <Button size="xl">XL control</Button>
          </div>
          <div className="dsv-inline" style={{ marginTop: "var(--space-3)", gap: "var(--space-2)" }}>
            <div className="dsv-shell-bar--mobile dsv-inline" style={{ flex: 1, background: "var(--color-surface)", border: "var(--border-width-thin) solid var(--color-border-subtle)", borderRadius: "var(--radius-md)", padding: "0 var(--space-3)", fontSize: "var(--font-size-xs)" }}>
              Mobile header (--size-header-height-mobile)
            </div>
            <div className="dsv-shell-side--collapsed" style={{ background: "var(--color-surface-sunken)", borderRadius: "var(--radius-md)", padding: "var(--space-2)", fontSize: "var(--font-size-xs)" }}>
              Rail (--size-sidebar-width-collapsed)
            </div>
          </div>
          <div className="dsv-stack" style={{ marginTop: "var(--space-3)", gap: "var(--space-1)" }}>
            <div className="dsv-container-sm" style={{ background: "var(--color-tint-subtle)", borderRadius: "var(--radius-sm)", fontSize: "var(--font-size-xs)", padding: "var(--space-1) var(--space-2)" }}>container sm</div>
            <div className="dsv-container-md" style={{ background: "var(--color-tint-subtle)", borderRadius: "var(--radius-sm)", fontSize: "var(--font-size-xs)", padding: "var(--space-1) var(--space-2)" }}>container md</div>
            <div className="dsv-container-lg" style={{ background: "var(--color-tint-subtle)", borderRadius: "var(--radius-sm)", fontSize: "var(--font-size-xs)", padding: "var(--space-1) var(--space-2)" }}>container lg</div>
          </div>
        </div>
      </Demo>

      <Demo title="Scroll Area">
        <ScrollArea.Root className="dsv-scroll">
          <ScrollArea.Viewport className="dsv-scroll-viewport">
            <div className="dsv-stack" style={{ fontSize: "var(--font-size-sm)" }}>
              {Array.from({ length: 12 }, (_, i) => <div key={i}>Row {i + 1} — scrollable content</div>)}
            </div>
          </ScrollArea.Viewport>
          <ScrollArea.Scrollbar className="dsv-scrollbar" orientation="vertical"><ScrollArea.Thumb className="dsv-scroll-thumb" /></ScrollArea.Scrollbar>
        </ScrollArea.Root>
      </Demo>

      <Demo title="Aspect Ratio (16:9)">
        <div className="dsv-aspect">
          <AspectRatio ratio={16 / 9}>
            <img src="https://images.unsplash.com/photo-1503264116251-35a269479413?w=400&q=60" alt="" loading="lazy" decoding="async" />
          </AspectRatio>
        </div>
      </Demo>
    </Section>
  );
}

export const COMPONENT_SECTIONS = [
  { id: "forms", label: "Forms", Comp: FormsSection },
  { id: "form", label: "Form + validation", Comp: FormSection },
  { id: "overlays", label: "Overlays", Comp: OverlaysSection },
  { id: "navigation", label: "Navigation", Comp: NavigationSection },
  { id: "feedback", label: "Feedback", Comp: FeedbackSection },
  { id: "layout", label: "Layout", Comp: LayoutSection },
  { id: "utilities", label: "Utilities", Comp: UtilitiesSection },
];
