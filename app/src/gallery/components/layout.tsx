import { useState } from "react";
import { AspectRatio } from "@radix-ui/react-aspect-ratio";
import * as Accordion from "@radix-ui/react-accordion";
import * as Avatar from "@radix-ui/react-avatar";
import * as Collapsible from "@radix-ui/react-collapsible";
import * as ScrollArea from "@radix-ui/react-scroll-area";
import { Separator } from "@radix-ui/react-separator";
import { Button, Demo } from "../ui.tsx";
import { Icon } from "../../lib/icons.tsx";
import "./layout.css";

interface FaqItem {
  id: string;
  question: string;
  answer: string;
}

const FAQ: FaqItem[] = [
  { id: "a", question: "How long is shipping?", answer: "Standard shipping 2–4 business days." },
  { id: "b", question: "What is the return policy?", answer: "Free returns within 30 days." },
  { id: "c", question: "Can I get an invoice?", answer: "Yes, emailed after ordering." },
];

interface PresenceSpec {
  size: "sm" | "md" | "lg";
  tone: "success" | "warning";
  label: string;
}

const PRESENCE: PresenceSpec[] = [
  { size: "sm", tone: "success", label: "online" },
  { size: "md", tone: "success", label: "online" },
  { size: "lg", tone: "warning", label: "busy" },
];

interface ShellNavItem {
  label: string;
  active: boolean;
}

const SHELL_NAV: ShellNavItem[] = [
  { label: "Overview", active: true },
  { label: "Projects", active: false },
  { label: "Team", active: false },
  { label: "Settings", active: false },
];

const SHELL_STATUS_TONES = ["danger", "warning", "success"] as const;

export default function LayoutBody() {
  const [collapsibleOpen, setCollapsibleOpen] = useState(false);

  return (
    <>
      <Demo title="Accordion">
        <Accordion.Root type="single" collapsible className="dsv-accordion" defaultValue="a">
          {FAQ.map((item) => (
            <Accordion.Item key={item.id} value={item.id} className="dsv-accordion-item">
              <Accordion.Header>
                <Accordion.Trigger className="dsv-accordion-trigger">
                  {item.question}
                  <span className="chev">
                    <Icon name="chevronDown" size={16} />
                  </span>
                </Accordion.Trigger>
              </Accordion.Header>
              <Accordion.Content className="dsv-accordion-content">{item.answer}</Accordion.Content>
            </Accordion.Item>
          ))}
        </Accordion.Root>
      </Demo>

      <Demo title="Collapsible">
        <Collapsible.Root className="dsv-collapsible" open={collapsibleOpen} onOpenChange={setCollapsibleOpen}>
          <Collapsible.Trigger asChild>
            <Button variant="ghost" size="sm">
              {collapsibleOpen ? "Hide" : "Show 3 more commits"}
            </Button>
          </Collapsible.Trigger>
          <Collapsible.Content className="dsv-collapsible-content">
            <span className="dsv-mono dsv-muted">a1b2c3 — fix parser</span>
            <span className="dsv-mono dsv-muted">d4e5f6 — add tests</span>
            <span className="dsv-mono dsv-muted">7890ab — bump deps</span>
          </Collapsible.Content>
        </Collapsible.Root>
      </Demo>

      <Demo title="Separator">
        <div className="dsv-sep-demo">
          <div className="dsv-sep-demo-title">Design System Viewer</div>
          <div className="dsv-muted dsv-sep-demo-subtitle">Visualize tokens</div>
          <Separator className="dsv-sep" />
          <div className="dsv-inline dsv-sep-demo-links">
            <span>Blog</span>
            <Separator className="dsv-sep" orientation="vertical" decorative />
            <span>Docs</span>
            <Separator className="dsv-sep" orientation="vertical" decorative />
            <span>Source</span>
          </div>
          <div className="dsv-inline dsv-sep-demo-ramp">
            <span>--divider-width ramp:</span>
            <span className="dsv-divider-demo dsv-divider-demo--none">none</span>
            <span className="dsv-divider-demo dsv-divider-demo--thin">thin</span>
            <span className="dsv-divider-demo dsv-divider-demo--medium">medium</span>
            <span className="dsv-divider-demo dsv-divider-demo--thick">thick</span>
          </div>
        </div>
      </Demo>

      <Demo title="Avatar">
        <span className="dsv-avatar">
          <Avatar.Root className="dsv-avatar-root">
            <Avatar.Image src="https://i.pravatar.cc/80?img=13" alt="" />
            <Avatar.Fallback className="dsv-avatar-fallback" delayMs={600}>
              AL
            </Avatar.Fallback>
          </Avatar.Root>
        </span>
        <span className="dsv-avatar" title="no image → initials">
          <Avatar.Root className="dsv-avatar-root">
            <Avatar.Fallback className="dsv-avatar-fallback">GK</Avatar.Fallback>
          </Avatar.Root>
        </span>
      </Demo>

      <Demo title="Avatar — sizes & presence">
        <span className="dsv-inline dsv-avatar-presence-row">
          {PRESENCE.map((spec) => (
            <span key={`${spec.size}-${spec.label}`} className="dsv-stack dsv-avatar-presence-item">
              <span className={`dsv-avatar-presence-badge-wrap dsv-avatar-presence-badge-wrap--${spec.size}`}>
                <span className="dsv-avatar dsv-avatar-presence-avatar">
                  <span className={`dsv-avatar-fallback dsv-avatar-presence-fallback--${spec.size}`}>AL</span>
                </span>
                <span
                  title={spec.label}
                  className="dsv-avatar-presence-dot"
                  data-tone={spec.tone}
                />
              </span>
              <span className="dsv-muted dsv-avatar-presence-label">{spec.label}</span>
            </span>
          ))}
        </span>
        <span className="dsv-muted dsv-avatar-presence-note">presence via semantic fills</span>
      </Demo>

      <Demo title="App shell metrics">
        <div className="dsv-shell-metrics">
          <div className="dsv-shell-metrics-bar dsv-shell-bar dsv-inline">
            <span className="dsv-inline dsv-shell-metrics-dots">
              {SHELL_STATUS_TONES.map((tone) => (
                <span key={tone} className="dsv-shell-metrics-dot" data-tone={tone} />
              ))}
            </span>
            <strong className="dsv-shell-metrics-brand">Acme</strong>
            <span className="dsv-shell-metrics-spacer" />
            <span className="dsv-muted dsv-mono dsv-shell-metrics-caption">--size-header-height</span>
            <span className="dsv-avatar dsv-avatar--sm">
              <span className="dsv-avatar-fallback dsv-shell-metrics-avatar-fallback">AL</span>
            </span>
          </div>
          <div className="dsv-inline dsv-shell-metrics-body">
            <div className="dsv-shell-side dsv-shell-metrics-nav">
              {SHELL_NAV.map((item) => (
                <span
                  key={item.label}
                  className="dsv-shell-metrics-nav-item"
                  data-active={item.active}
                >
                  {item.label}
                </span>
              ))}
              <span className="dsv-muted dsv-mono dsv-shell-metrics-nav-caption">--size-sidebar-width</span>
            </div>
            <div className="dsv-shell-metrics-grid-col">
              <div className="dsv-grid-12 dsv-shell-metrics-grid">
                {Array.from({ length: 12 }, (_, i) => (
                  <div key={i} className="dsv-shell-metrics-grid-cell" data-parity={i % 2 ? "odd" : "even"} />
                ))}
              </div>
              <div className="dsv-muted dsv-shell-metrics-grid-caption">repeat(var(--grid-columns)) · gap var(--grid-gutter)</div>
            </div>
          </div>
          <div className="dsv-inline dsv-shell-metrics-avatars">
            <span className="dsv-avatar dsv-avatar--xs">
              <span className="dsv-avatar-fallback">XS</span>
            </span>
            <span className="dsv-avatar dsv-avatar--sm">
              <span className="dsv-avatar-fallback">SM</span>
            </span>
            <span className="dsv-avatar dsv-avatar--md">
              <span className="dsv-avatar-fallback">MD</span>
            </span>
            <span className="dsv-avatar dsv-avatar--lg">
              <span className="dsv-avatar-fallback">LG</span>
            </span>
            <span className="dsv-avatar dsv-avatar--xl">
              <span className="dsv-avatar-fallback">XL</span>
            </span>
            <Button size="xl">XL control</Button>
          </div>
          <div className="dsv-inline dsv-shell-metrics-mobile-row">
            <div className="dsv-shell-bar--mobile dsv-inline dsv-shell-metrics-mobile-bar">Mobile header (--size-header-height-mobile)</div>
            <div className="dsv-shell-side--collapsed dsv-shell-metrics-mobile-rail">Rail (--size-sidebar-width-collapsed)</div>
          </div>
          <div className="dsv-stack dsv-shell-metrics-containers">
            <div className="dsv-container-sm dsv-shell-metrics-container-chip">container sm</div>
            <div className="dsv-container-md dsv-shell-metrics-container-chip">container md</div>
            <div className="dsv-container-lg dsv-shell-metrics-container-chip">container lg</div>
          </div>
        </div>
      </Demo>

      <Demo title="Scroll Area">
        <ScrollArea.Root className="dsv-scroll">
          <ScrollArea.Viewport className="dsv-scroll-viewport">
            <div className="dsv-stack dsv-scroll-rows">
              {Array.from({ length: 12 }, (_, i) => (
                <div key={i}>Row {i + 1} — scrollable content</div>
              ))}
            </div>
          </ScrollArea.Viewport>
          <ScrollArea.Scrollbar className="dsv-scrollbar" orientation="vertical">
            <ScrollArea.Thumb className="dsv-scroll-thumb" />
          </ScrollArea.Scrollbar>
        </ScrollArea.Root>
      </Demo>

      <Demo title="Aspect Ratio (16:9)">
        <div className="dsv-aspect">
          <AspectRatio ratio={16 / 9}>
            <img
              src="https://images.unsplash.com/photo-1503264116251-35a269479413?w=400&q=60"
              alt=""
              loading="lazy"
              decoding="async"
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
            />
          </AspectRatio>
        </div>
      </Demo>
    </>
  );
}
