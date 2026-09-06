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
import { Button, Field, Demo, Icon } from "./ui.jsx";

const Section = ({ id, title, desc, children }) => (
  <section className="dsv-section" id={id}>
    <h2>{title}</h2>
    <p>{desc}</p>
    {children}
  </section>
);

// ───────────────────────────────────────────────────────── Forms
export function FormsSection() {
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
          <Select.Portal>
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
  return (
    <Section id="overlays" title="Overlays" desc="Dialog, menu, popover, tooltip — portal + scrim + focus from Radix, appearance from tokens.">
      <Demo title="Dialog">
        <Dialog.Root>
          <Dialog.Trigger asChild><Button variant="outline">Edit profile</Button></Dialog.Trigger>
          <Dialog.Portal>
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
          <AlertDialog.Portal>
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
          <Popover.Portal>
            <Popover.Content className="dsv-pop" sideOffset={6}>
              <div className="dsv-stack">
                <strong style={{ fontSize: "var(--font-size-sm)" }}>Dimensions</strong>
                <Field label="Width" id="p-w"><input id="p-w" className="dsv-input" defaultValue="240px" /></Field>
                <Field label="Height" id="p-h"><input id="p-h" className="dsv-input" defaultValue="auto" /></Field>
              </div>
              <Popover.Arrow style={{ fill: "var(--color-surface-overlay)" }} />
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>
      </Demo>

      <Demo title="Tooltip">
        <Tooltip.Provider delayDuration={200}>
          <Tooltip.Root>
            <Tooltip.Trigger asChild><Button variant="ghost" className="dsv-icon-btn" aria-label="Notifications"><Icon name="bell" /></Button></Tooltip.Trigger>
            <Tooltip.Portal>
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
          <DropdownMenu.Portal>
            <DropdownMenu.Content className="dsv-menu" sideOffset={6} align="start">
              <DropdownMenu.Label className="dsv-menu-label">Account</DropdownMenu.Label>
              <DropdownMenu.Item className="dsv-menu-item"><Icon name="user" size={14} /> Profile <span className="dsv-menu-shortcut">⌘P</span></DropdownMenu.Item>
              <DropdownMenu.Item className="dsv-menu-item"><Icon name="settings" size={14} /> Settings</DropdownMenu.Item>
              <DropdownMenu.Sub>
                <DropdownMenu.SubTrigger className="dsv-menu-subtrigger">Theme <span style={{ marginLeft: "auto" }}><Icon name="chevronRight" size={14} /></span></DropdownMenu.SubTrigger>
                <DropdownMenu.Portal>
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
            <div className="dsv-card" style={{ display: "grid", placeItems: "center", width: 220, height: 90, borderStyle: "dashed" }}>
              Right-click here
            </div>
          </ContextMenu.Trigger>
          <ContextMenu.Portal>
            <ContextMenu.Content className="dsv-menu">
              <ContextMenu.Item className="dsv-menu-item">Undo <span className="dsv-menu-shortcut">⌘Z</span></ContextMenu.Item>
              <ContextMenu.Item className="dsv-menu-item">Redo <span className="dsv-menu-shortcut">⇧⌘Z</span></ContextMenu.Item>
              <ContextMenu.Separator className="dsv-menu-sep" />
              <ContextMenu.CheckboxItem className="dsv-menu-item" checked>Show grid</ContextMenu.CheckboxItem>
              <ContextMenu.Separator className="dsv-menu-sep" />
              <ContextMenu.Item className="dsv-menu-item dsv-menu-item--danger">Delete</ContextMenu.Item>
            </ContextMenu.Content>
          </ContextMenu.Portal>
        </ContextMenu.Root>
      </Demo>

      <Demo title="Hover Card">
        <HoverCard.Root openDelay={150}>
          <HoverCard.Trigger asChild><a className="dsv-nav-link" href="#forms">@ada</a></HoverCard.Trigger>
          <HoverCard.Portal>
            <HoverCard.Content className="dsv-pop" sideOffset={6}>
              <div className="dsv-hovercard">
                <span className="dsv-avatar" style={{ width: 44, height: 44 }}><span className="dsv-avatar-fallback">AL</span></span>
                <div>
                  <div className="name">Ada Lovelace</div>
                  <div className="bio">The first programmer. Analytical Engine notes, 1843.</div>
                </div>
              </div>
              <HoverCard.Arrow style={{ fill: "var(--color-surface-overlay)" }} />
            </HoverCard.Content>
          </HoverCard.Portal>
        </HoverCard.Root>
      </Demo>
    </Section>
  );
}

// ───────────────────────────────────────────────────────── Navigation
export function NavigationSection() {
  return (
    <Section id="navigation" title="Navigation" desc="Menubar, navigation menu, tabs, toolbar.">
      <Demo title="Menubar">
        <Menubar.Root className="dsv-nav">
          {[["File", ["New", "Open…", "Save"]], ["Edit", ["Cut", "Copy", "Paste"]], ["View", ["Zoom in", "Zoom out", "Fullscreen"]]].map(([m, items]) => (
            <Menubar.Menu key={m}>
              <Menubar.Trigger className="dsv-nav-trigger">{m}</Menubar.Trigger>
              <Menubar.Portal>
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
        <Tabs.Root defaultValue="acc" style={{ width: 420 }}>
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
  const [sent, setSent] = useState(false);
  return (
    <Section id="form" title="Form + validation" desc="Radix Form (built-in validation + messages), Password Toggle Field, One-Time Password Field.">
      <Demo title="Radix Form — client validation">
        <Form.Root
          style={{ maxWidth: 360, width: "100%" }}
          onSubmit={(e) => { e.preventDefault(); setSent(true); }}
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
          {sent && <p className="dsv-form-message" data-valid style={{ marginTop: "var(--space-2)" }}>✓ submitted</p>}
        </Form.Root>
      </Demo>

      <Demo title="Password Toggle Field">
        <div className="dsv-field" style={{ maxWidth: 280 }}>
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
        <Toast.Title className="dsv-toast-title">Saved</Toast.Title>
        <Toast.Description className="dsv-toast-desc">Changes uploaded to cloud.</Toast.Description>
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
        <Button size="sm" variant="ghost" onClick={() => setP((v) => (v + 20) % 120)}>+20</Button>
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
      <Demo title="Kbd">
        <span>Save: <kbd className="dsv-kbd">⌘</kbd> <kbd className="dsv-kbd">S</kbd></span>
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
        <div style={{ maxWidth: 300 }}>
          <div style={{ fontSize: "var(--font-size-sm)" }}>Design System Viewer</div>
          <div className="dsv-muted" style={{ fontSize: "var(--font-size-xs)" }}>Visualize tokens</div>
          <Separator className="dsv-sep" />
          <div className="dsv-inline" style={{ fontSize: "var(--font-size-sm)" }}>
            <span>Blog</span><Separator className="dsv-sep" orientation="vertical" decorative /><span>Docs</span><Separator className="dsv-sep" orientation="vertical" decorative /><span>Source</span>
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
