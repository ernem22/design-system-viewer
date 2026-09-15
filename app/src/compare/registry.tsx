// "Basics" comparable renderers — ported from preview/src/compare.jsx's
// local REGISTRY entries (Buttons/Inputs/Controls/.../LoginCard). Unlike the
// gallery's whole-section demos, each of these is small and single-purpose,
// so several fit side by side in a narrow compare column.
import { useState } from "react";
import type { ComponentType } from "react";
import * as Checkbox from "@radix-ui/react-checkbox";
import * as RadioGroup from "@radix-ui/react-radio-group";
import * as Switch from "@radix-ui/react-switch";
import * as Slider from "@radix-ui/react-slider";
import * as Select from "@radix-ui/react-select";
import * as Tabs from "@radix-ui/react-tabs";
import * as Accordion from "@radix-ui/react-accordion";
import * as Progress from "@radix-ui/react-progress";
import { Button, Field, usePortalContainer } from "../gallery/ui.tsx";
import { COMPONENT_ENTRIES } from "../gallery/components/index.ts";
import type { GalleryEntry } from "../gallery/registry.ts";
import { Icon } from "../lib/icons.tsx";

const Buttons = () => (
  <div className="cmp-stack">
    <div className="dsv-row">
      <Button>Solid</Button>
      <Button variant="soft">Soft</Button>
      <Button variant="outline">Outline</Button>
    </div>
    <div className="dsv-row">
      <Button variant="ghost">Ghost</Button>
      <Button variant="danger">Danger</Button>
      <Button disabled>Disabled</Button>
    </div>
    <div className="dsv-row">
      <Button size="sm">Small</Button>
      <Button>Medium</Button>
      <Button size="lg">Large</Button>
    </div>
  </div>
);

const Inputs = () => (
  <div className="cmp-stack">
    <Field label="Email" id="c-e">
      <input id="c-e" className="dsv-input" placeholder="ada@example.com" />
    </Field>
    <Field label="Password" id="c-p" error="At least 8 characters">
      <input id="c-p" className="dsv-input" aria-invalid="true" defaultValue="123" type="password" />
    </Field>
    <Field label="Note" id="c-n">
      <textarea id="c-n" className="dsv-textarea" placeholder="…" />
    </Field>
    <Field label="Disabled" id="c-d">
      <input id="c-d" className="dsv-input" disabled defaultValue="read-only" />
    </Field>
  </div>
);

function Controls() {
  const [cb, setCb] = useState<Checkbox.CheckedState>(true);
  const [rg, setRg] = useState("b");
  const [sw, setSw] = useState(true);
  return (
    <div className="cmp-stack">
      <label className="dsv-control-label">
        <Checkbox.Root className="dsv-check" checked={cb} onCheckedChange={setCb}>
          <Checkbox.Indicator>
            <Icon name="check" size={14} />
          </Checkbox.Indicator>
        </Checkbox.Root>
        Checkbox
      </label>
      <RadioGroup.Root className="dsv-stack" value={rg} onValueChange={setRg}>
        {[
          ["a", "Option A"],
          ["b", "Option B"],
        ].map(([v, l]) => (
          <label key={v} className="dsv-control-label">
            <RadioGroup.Item className="dsv-radio" value={v}>
              <RadioGroup.Indicator className="dsv-radio-indicator" />
            </RadioGroup.Item>
            {l}
          </label>
        ))}
      </RadioGroup.Root>
      <label className="dsv-control-label">
        <Switch.Root className="dsv-switch" checked={sw} onCheckedChange={setSw}>
          <Switch.Thumb className="dsv-switch-thumb" />
        </Switch.Root>
        Switch
      </label>
    </div>
  );
}

function Sliders() {
  const [v, setV] = useState([45]);
  return (
    <Slider.Root className="dsv-slider" value={v} onValueChange={setV} max={100} style={{ width: "100%" }}>
      <Slider.Track className="dsv-slider-track">
        <Slider.Range className="dsv-slider-range" />
      </Slider.Track>
      <Slider.Thumb className="dsv-slider-thumb" aria-label="Value" />
    </Slider.Root>
  );
}

const Selects = () => {
  const portalContainer = usePortalContainer();
  return (
    <Select.Root defaultValue="tr">
      <Select.Trigger className="dsv-select-trigger" aria-label="Language" style={{ width: "100%" }}>
        <Select.Value />
        <Select.Icon>
          <Icon name="chevronDown" size={14} />
        </Select.Icon>
      </Select.Trigger>
      <Select.Portal container={portalContainer}>
        <Select.Content className="dsv-select-content" position="popper" sideOffset={6}>
          <Select.Viewport>
            {[
              ["tr", "Turkish"],
              ["en", "English"],
              ["de", "German"],
            ].map(([v, l]) => (
              <Select.Item key={v} value={v} className="dsv-select-item">
                <Select.ItemIndicator className="dsv-select-item-indicator">
                  <Icon name="check" size={14} />
                </Select.ItemIndicator>
                <Select.ItemText>{l}</Select.ItemText>
              </Select.Item>
            ))}
          </Select.Viewport>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  );
};

const Cards = () => (
  <div className="cmp-stack">
    <div className="dsv-card">
      <div style={{ fontWeight: "var(--font-weight-semibold)", marginBottom: "var(--space-1)" }}>Card title</div>
      <div className="dsv-muted" style={{ fontSize: "var(--font-size-sm)" }}>
        Shadow, border, radius tokens.
      </div>
    </div>
    <div className="dsv-card dsv-card--raised">
      <div className="dsv-inline" style={{ justifyContent: "space-between" }}>
        <span style={{ fontWeight: "var(--font-weight-medium)" }}>Elevated</span>
        <span className="dsv-badge dsv-badge--success">Active</span>
      </div>
    </div>
  </div>
);

const Badges = () => (
  <div className="cmp-stack">
    <div className="dsv-row">
      <span className="dsv-badge">Default</span>
      <span className="dsv-badge dsv-badge--success">Success</span>
      <span className="dsv-badge dsv-badge--warning">Warning</span>
      <span className="dsv-badge dsv-badge--danger">Error</span>
      <span className="dsv-badge dsv-badge--info">Info</span>
    </div>
    <div className="dsv-callout dsv-callout--info">
      <span className="ico">
        <Icon name="bell" size={16} />
      </span>
      <div>Info message.</div>
    </div>
    <div className="dsv-callout dsv-callout--danger">
      <span className="ico">
        <Icon name="x" size={16} />
      </span>
      <div>Error message.</div>
    </div>
  </div>
);

const Tabbed = () => (
  <Tabs.Root defaultValue="a">
    <Tabs.List className="dsv-tabs-list">
      <Tabs.Trigger className="dsv-tabs-trigger" value="a">
        Account
      </Tabs.Trigger>
      <Tabs.Trigger className="dsv-tabs-trigger" value="b">
        Password
      </Tabs.Trigger>
    </Tabs.List>
    <Tabs.Content className="dsv-tabs-content" value="a">
      Account tab content.
    </Tabs.Content>
    <Tabs.Content className="dsv-tabs-content" value="b">
      Password tab content.
    </Tabs.Content>
  </Tabs.Root>
);

const Accord = () => (
  <Accordion.Root type="single" collapsible className="dsv-accordion" defaultValue="1" style={{ maxWidth: "none" }}>
    {[
      ["1", "First question"],
      ["2", "Second question"],
    ].map(([v, q]) => (
      <Accordion.Item key={v} value={v} className="dsv-accordion-item">
        <Accordion.Header>
          <Accordion.Trigger className="dsv-accordion-trigger">
            {q}
            <span className="chev">
              <Icon name="chevronDown" size={16} />
            </span>
          </Accordion.Trigger>
        </Accordion.Header>
        <Accordion.Content className="dsv-accordion-content">Short answer text.</Accordion.Content>
      </Accordion.Item>
    ))}
  </Accordion.Root>
);

const Progressy = () => (
  <div className="cmp-stack">
    <Progress.Root className="dsv-progress" value={66} style={{ width: "100%" }}>
      <Progress.Indicator className="dsv-progress-indicator" style={{ width: "66%" }} />
    </Progress.Root>
    <div className="dsv-inline">
      <span className="dsv-spinner" /> <span className="dsv-muted" style={{ fontSize: "var(--font-size-sm)" }}>Loading</span>
    </div>
  </div>
);

const LoginCard = () => (
  <div className="dsv-card dsv-card--raised">
    <div style={{ fontSize: "var(--font-size-lg)", fontWeight: "var(--font-weight-semibold)", marginBottom: "var(--space-1)" }}>
      Sign in
    </div>
    <div className="dsv-muted" style={{ fontSize: "var(--font-size-sm)", marginBottom: "var(--space-4)" }}>
      Access your account
    </div>
    <div className="cmp-stack">
      <Field label="Email" id="lc-e">
        <input id="lc-e" className="dsv-input" placeholder="ada@example.com" />
      </Field>
      <Field label="Password" id="lc-p">
        <input id="lc-p" className="dsv-input" type="password" placeholder="••••••••" />
      </Field>
      <Button style={{ width: "100%" }}>Continue</Button>
    </div>
  </div>
);

/** One entry in the component picker: an id (kept stable — legacy's `?c=`
   querystring values matched these), a label, and the demo it renders. */
export interface ComparableOption {
  id: string;
  label: string;
  Render: ComponentType;
}

export const BASIC_OPTIONS: ComparableOption[] = [
  { id: "button", label: "Button", Render: Buttons },
  { id: "input", label: "Input", Render: Inputs },
  { id: "controls", label: "Checkbox / Radio / Switch", Render: Controls },
  { id: "slider", label: "Slider", Render: Sliders },
  { id: "select", label: "Select", Render: Selects },
  { id: "card", label: "Card", Render: Cards },
  { id: "badge", label: "Badge / Callout", Render: Badges },
  { id: "tabs", label: "Tabs", Render: Tabbed },
  { id: "accordion", label: "Accordion", Render: Accord },
  { id: "progress", label: "Progress / Spinner", Render: Progressy },
  { id: "login", label: "Login card", Render: LoginCard },
];

/** One gallery section as a picker option: stable `gallery-<id>` values (the
   same scheme legacy's REGISTRY used, so `?c=` links keep working) with the
   section's own Body as the renderer. Section components only read canonical
   tokens via var(--x), which resolve against each column's inline token
   scope — no :root dependency, so the whole gallery is comparable
   system-by-system. */
function toComparable(e: GalleryEntry): ComparableOption {
  return { id: `gallery-${e.id}`, label: e.label, Render: e.Body };
}

const isScreenEntry = (e: GalleryEntry) => e.id.startsWith("screen-");

/** The issue-2 Extras port: these sections live in COMPONENT_ENTRIES next to
   the original components but get their own picker group, mirroring legacy
   OPT_GROUPS' Components / Extras / Screens split. */
const EXTRA_IDS = new Set(["foundation", "patterns", "data-display", "status", "nav-extras"]);

/** Original component sections (Forms … Utilities). */
export const COMPONENT_OPTIONS: ComparableOption[] = COMPONENT_ENTRIES.filter(
  (e) => !isScreenEntry(e) && !EXTRA_IDS.has(e.id),
).map(toComparable);

/** Extras sections (Foundation … Navigation extras). */
export const EXTRA_OPTIONS: ComparableOption[] = COMPONENT_ENTRIES.filter(
  (e) => !isScreenEntry(e) && EXTRA_IDS.has(e.id),
).map(toComparable);

/** Whole-page screen mockups (Data viz … Command palette). */
export const SCREEN_OPTIONS: ComparableOption[] = COMPONENT_ENTRIES.filter(isScreenEntry).map(toComparable);
