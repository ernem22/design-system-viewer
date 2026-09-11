import { useState } from "react";
import * as Tabs from "@radix-ui/react-tabs";
import * as Switch from "@radix-ui/react-switch";
import * as Select from "@radix-ui/react-select";
import * as Slider from "@radix-ui/react-slider";
import * as RadioGroup from "@radix-ui/react-radio-group";
import * as Checkbox from "@radix-ui/react-checkbox";
import * as Progress from "@radix-ui/react-progress";
import * as Avatar from "@radix-ui/react-avatar";
import * as HoverCard from "@radix-ui/react-hover-card";
import * as Dialog from "@radix-ui/react-dialog";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Separator } from "@radix-ui/react-separator";
import { Button, Field, Icon, usePortalContainer } from "./ui.jsx";

const Screen = ({ id, title, desc, children, pad = true }) => (
  <section className="dsv-section" id={id}>
    <h2>{title}</h2>
    <p>{desc}</p>
    <div className="dsv-screen-frame" style={pad ? undefined : { padding: 0 }}>{children}</div>
  </section>
);

// size: token scale name (xs/sm/md/lg/xl) — resolves to --size-avatar-*
const Avat = ({ n, size = "md" }) => (
  <span className={`dsv-avatar dsv-avatar--${size}`}>
    <Avatar.Root style={{ width: "100%", height: "100%", display: "flex" }}>
      <Avatar.Image src={`https://i.pravatar.cc/80?img=${n}`} alt="" />
      <Avatar.Fallback className="dsv-avatar-fallback">{String(n).slice(0, 2)}</Avatar.Fallback>
    </Avatar.Root>
  </span>
);

// ─────────────────────────────────────────── Login
function LoginScreen() {
  return (
    <div style={{ maxWidth: 360, margin: "0 auto" }}>
      <div className="dsv-card dsv-card--raised">
        <h3 style={{ margin: "0 0 var(--space-1)", fontSize: "var(--font-size-xl)" }}>Welcome back</h3>
        <p className="dsv-muted" style={{ margin: "0 0 var(--space-5)", fontSize: "var(--font-size-sm)" }}>Sign in to your account</p>
        <div className="dsv-stack">
          <Field label="Email" id="l-email"><input id="l-email" className="dsv-input" type="email" placeholder="ada@example.com" /></Field>
          <Field label="Password" id="l-pass"><input id="l-pass" className="dsv-input" type="password" placeholder="••••••••" /></Field>
          <label className="dsv-control-label">
            <Checkbox.Root className="dsv-check" defaultChecked><Checkbox.Indicator><Icon name="check" size={14} /></Checkbox.Indicator></Checkbox.Root>
            Remember me
          </label>
          <Button size="lg" style={{ width: "100%" }}>Sign in</Button>
          <Sep>or</Sep>
          <Button variant="outline" style={{ width: "100%" }}>Continue with GitHub</Button>
        </div>
      </div>
      <p className="dsv-muted" style={{ textAlign: "center", fontSize: "var(--font-size-sm)", marginTop: "var(--space-4)" }}>
        No account? <Link to="#screen-signup">Sign up</Link>
      </p>
    </div>
  );
}
const Sep = ({ children }) => (
  <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
    <Separator className="dsv-sep" style={{ flex: 1, margin: 0 }} />
    <span className="dsv-muted" style={{ fontSize: "var(--font-size-xs)" }}>{children}</span>
    <Separator className="dsv-sep" style={{ flex: 1, margin: 0 }} />
  </div>
);
const Link = ({ children, to = "#screen-login" }) => <a href={to} className="dsv-link" style={{ display: "inline", padding: 0 }}>{children}</a>;

// ─────────────────────────────────────────── Signup (steps)
function SignupScreen() {
  const [step, setStep] = useState(2);
  const labels = ["Account", "Profile", "Team", "Confirm"];
  return (
    <div style={{ maxWidth: 420, margin: "0 auto" }}>
      <div className="dsv-steps dsv-steps--center" style={{ marginBottom: "var(--space-5)" }} role="list" aria-label="Signup progress">
        {labels.map((l, i) => (
          <div key={l} role="listitem" aria-current={i === step ? "step" : undefined} className={`dsv-step ${i < step ? "dsv-step--done" : i === step ? "dsv-step--active" : ""}`}>
            <span className="dot">{i < step ? <Icon name="check" size={12} /> : i + 1}</span><span className="label">{l}</span>
            {i < labels.length - 1 && <span className="bar" aria-hidden="true" />}
          </div>
        ))}
      </div>
      <div className="dsv-card">
        <h3 style={{ margin: "0 0 var(--space-4)", fontSize: "var(--font-size-lg)" }}>{labels[step]}</h3>
        <div className="dsv-stack">
          <Field label="Team name" id="s-team"><input id="s-team" className="dsv-input" defaultValue="Acme" /></Field>
          <Field label="Invite emails" id="s-inv" hint="comma separated"><input id="s-inv" className="dsv-input" placeholder="a@x.com, b@x.com" /></Field>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: "var(--space-6)" }}>
          <Button variant="ghost" disabled={step === 0} onClick={() => setStep((s) => s - 1)}>Back</Button>
          <Button onClick={() => setStep((s) => Math.min(labels.length - 1, s + 1))}>{step === labels.length - 1 ? "Finish" : "Continue"}</Button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────── Pricing
function PricingScreen() {
  const [yearly, setYearly] = useState(true);
  const plans = [
    ["Starter", 0, ["1 project", "Community support", "1 GB storage"]],
    ["Pro", yearly ? 12 : 15, ["Unlimited projects", "Priority support", "50 GB storage", "Analytics"]],
    ["Team", yearly ? 32 : 39, ["Everything in Pro", "SSO", "Role management", "Audit log"]],
  ];
  return (
    <div>
      <div style={{ textAlign: "center", marginBottom: "var(--space-6)" }}>
        <h3 style={{ margin: "0 0 var(--space-3)", fontSize: "var(--font-size-2xl)" }}>Simple pricing</h3>
        <label className="dsv-control-label" style={{ justifyContent: "center" }}>
          Monthly
          <Switch.Root className="dsv-switch" checked={yearly} onCheckedChange={setYearly}><Switch.Thumb className="dsv-switch-thumb" /></Switch.Root>
          Yearly <span className="dsv-badge dsv-badge--success">2 months free</span>
        </label>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "var(--space-4)" }}>
        {plans.map(([name, price, feats], i) => (
          <div key={name} className={`dsv-card ${i === 1 ? "dsv-card--raised" : ""}`} style={i === 1 ? { borderColor: "var(--color-accent-border)" } : undefined}>
            {i === 1 && <span className="dsv-badge" style={{ marginBottom: "var(--space-2)" }}>Most popular</span>}
            <div style={{ fontWeight: "var(--font-weight-semibold)" }}>{name}</div>
            <div style={{ margin: "var(--space-2) 0" }}>
              <span style={{ fontSize: "var(--font-size-3xl)", fontWeight: "var(--font-weight-bold)" }}>₺{price}</span>
              <span className="dsv-muted" style={{ fontSize: "var(--font-size-sm)" }}>/mo</span>
            </div>
            <Button variant={i === 1 ? "solid" : "outline"} style={{ width: "100%", marginBottom: "var(--space-3)" }}>Choose</Button>
            <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: "var(--space-2)", fontSize: "var(--font-size-sm)" }}>
              {feats.map((f) => <li key={f} className="dsv-inline"><Icon name="check" size={14} /> {f}</li>)}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────── Settings
const SettingRow = ({ title, desc, children }) => (
  <div className="dsv-setting-row">
    <div>
      <div style={{ fontSize: "var(--font-size-sm)", fontWeight: "var(--font-weight-medium)" }}>{title}</div>
      <div className="dsv-muted" style={{ fontSize: "var(--font-size-xs)" }}>{desc}</div>
    </div>
    {children}
  </div>
);
function SettingsScreen() {
  const portalContainer = usePortalContainer();
  const [vol, setVol] = useState([60]);
  const [density, setDensity] = useState("comfortable");
  const [notif, setNotif] = useState({ email: true, push: true, digest: false });
  const [theme, setTheme] = useState("system");
  return (
    <div style={{ maxWidth: 560, margin: "0 auto" }}>
      <div className="dsv-card">
        <Tabs.Root defaultValue="general">
          <Tabs.List className="dsv-tabs-list">
            <Tabs.Trigger className="dsv-tabs-trigger" value="general">General</Tabs.Trigger>
            <Tabs.Trigger className="dsv-tabs-trigger" value="notif">Notifications</Tabs.Trigger>
            <Tabs.Trigger className="dsv-tabs-trigger" value="appear">Appearance</Tabs.Trigger>
          </Tabs.List>
          <Tabs.Content className="dsv-tabs-content" value="general">
            <div className="dsv-stack" style={{ color: "var(--color-text)" }}>
              <SettingRow title="Auto save" desc="Save instantly">
                <Switch.Root className="dsv-switch" defaultChecked><Switch.Thumb className="dsv-switch-thumb" /></Switch.Root>
              </SettingRow>
              <Separator className="dsv-sep" />
              <SettingRow title="Language" desc="Interface language">
                <Select.Root defaultValue="tr">
                  <Select.Trigger className="dsv-select-trigger" aria-label="Language"><Select.Value /><Select.Icon><Icon name="chevronDown" size={14} /></Select.Icon></Select.Trigger>
                  <Select.Portal container={portalContainer}>
                    <Select.Content className="dsv-select-content" position="popper" sideOffset={6}>
                      <Select.Viewport>
                        {[["tr", "Turkish"], ["en", "English"], ["de", "German"]].map(([v, l]) => (
                          <Select.Item key={v} value={v} className="dsv-select-item">
                            <Select.ItemIndicator className="dsv-select-item-indicator"><Icon name="check" size={14} /></Select.ItemIndicator>
                            <Select.ItemText>{l}</Select.ItemText>
                          </Select.Item>
                        ))}
                      </Select.Viewport>
                    </Select.Content>
                  </Select.Portal>
                </Select.Root>
              </SettingRow>
              <Separator className="dsv-sep" />
              <SettingRow title="Density" desc="Line spacing">
                <RadioGroup.Root className="dsv-inline" value={density} onValueChange={setDensity}>
                  {["compact", "comfortable"].map((v) => (
                    <label key={v} className="dsv-control-label">
                      <RadioGroup.Item className="dsv-radio" value={v}><RadioGroup.Indicator className="dsv-radio-indicator" /></RadioGroup.Item>{v}
                    </label>
                  ))}
                </RadioGroup.Root>
              </SettingRow>
              <Separator className="dsv-sep" />
              <SettingRow title="Volume" desc={`${vol[0]}%`}>
                <Slider.Root className="dsv-slider" value={vol} onValueChange={setVol} max={100}>
                  <Slider.Track className="dsv-slider-track"><Slider.Range className="dsv-slider-range" /></Slider.Track>
                  <Slider.Thumb className="dsv-slider-thumb" aria-label="Volume" />
                </Slider.Root>
              </SettingRow>
              <Separator className="dsv-sep" />
              <SettingRow title="Delete workspace" desc="Permanent, cannot be undone">
                <Button variant="danger" size="sm">Delete…</Button>
              </SettingRow>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "var(--space-3)", marginTop: "var(--space-6)" }}>
              <Button variant="ghost">Reset</Button><Button>Save</Button>
            </div>
          </Tabs.Content>
          <Tabs.Content className="dsv-tabs-content" value="notif">
            <div className="dsv-stack" style={{ color: "var(--color-text)" }}>
              <SettingRow title="Email alerts" desc="Build results and invoices">
                <Switch.Root className="dsv-switch" checked={notif.email} onCheckedChange={(v) => setNotif((n) => ({ ...n, email: v }))}><Switch.Thumb className="dsv-switch-thumb" /></Switch.Root>
              </SettingRow>
              <Separator className="dsv-sep" />
              <SettingRow title="Push notifications" desc="Mentions and comments">
                <Switch.Root className="dsv-switch" checked={notif.push} onCheckedChange={(v) => setNotif((n) => ({ ...n, push: v }))}><Switch.Thumb className="dsv-switch-thumb" /></Switch.Root>
              </SettingRow>
              <Separator className="dsv-sep" />
              <SettingRow title="Weekly digest" desc="Summary every Monday">
                <Switch.Root className="dsv-switch" checked={notif.digest} onCheckedChange={(v) => setNotif((n) => ({ ...n, digest: v }))}><Switch.Thumb className="dsv-switch-thumb" /></Switch.Root>
              </SettingRow>
              <p className="dsv-muted" style={{ fontSize: "var(--font-size-xs)" }}>
                {notif.email || notif.push ? "At least one channel is on." : "All channels off — you will miss updates."}
              </p>
            </div>
          </Tabs.Content>
          <Tabs.Content className="dsv-tabs-content" value="appear">
            <div className="dsv-stack" style={{ color: "var(--color-text)" }}>
              <SettingRow title="Theme" desc="Follows the system's dark variant">
                <RadioGroup.Root className="dsv-inline" value={theme} onValueChange={setTheme}>
                  {["light", "dark", "system"].map((v) => (
                    <label key={v} className="dsv-control-label">
                      <RadioGroup.Item className="dsv-radio" value={v}><RadioGroup.Indicator className="dsv-radio-indicator" /></RadioGroup.Item>{v}
                    </label>
                  ))}
                </RadioGroup.Root>
              </SettingRow>
              <Separator className="dsv-sep" />
              <SettingRow title="Motion" desc="Reduce animations" >
                <Switch.Root className="dsv-switch"><Switch.Thumb className="dsv-switch-thumb" /></Switch.Root>
              </SettingRow>
              <p className="dsv-muted" style={{ fontSize: "var(--font-size-xs)" }}>Type scale and color settings follow the active design system's tokens.</p>
            </div>
          </Tabs.Content>
        </Tabs.Root>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────── Profile
function ProfileScreen() {
  return (
    <div style={{ maxWidth: 620, margin: "0 auto" }}>
      <div className="dsv-card">
        <div className="dsv-inline" style={{ gap: "var(--space-4)", marginBottom: "var(--space-5)" }}>
          <Avat n={31} size="xl" />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: "var(--font-size-lg)", fontWeight: "var(--font-weight-semibold)" }}>Ada Lovelace</div>
            <div className="dsv-muted" style={{ fontSize: "var(--font-size-sm)" }}>@ada · Joined March 2024</div>
          </div>
          <Button variant="outline" size="sm">Edit</Button>
        </div>
        <dl className="dsv-datalist">
          <dt>Email</dt><dd>ada@example.com</dd>
          <dt>Role</dt><dd><span className="dsv-badge">Admin</span></dd>
          <dt>2FA</dt><dd><span className="dsv-badge dsv-badge--success">Enabled</span></dd>
          <dt>Languages</dt><dd className="dsv-inline"><span className="dsv-tag">TR</span><span className="dsv-tag">EN</span><span className="dsv-tag">FR</span></dd>
        </dl>
        <Separator className="dsv-sep" />
        <div style={{ fontSize: "var(--font-size-sm)", fontWeight: "var(--font-weight-medium)", marginBottom: "var(--space-3)" }}>Recent activity</div>
        <ul className="dsv-timeline">
          {[["Invoice paid", "2 hours ago"], ["API key created", "yesterday"], ["Password changed", "3 days ago"]].map(([b, w]) => (
            <li key={b}><span className="node" /><div><div className="body">{b}</div><div className="when">{w}</div></div></li>
          ))}
        </ul>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────── Dashboard
function DashboardScreen() {
  const portalContainer = usePortalContainer();
  return (
    <div className="dsv-stack">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h3 style={{ margin: 0, fontSize: "var(--font-size-lg)" }}>Overview</h3>
          <div className="dsv-muted" style={{ fontSize: "var(--font-size-xs)" }}>Last 30 days</div>
        </div>
        <div className="dsv-inline">
          <span className="dsv-badge dsv-badge--success"><Icon name="check" size={12} /> Live</span>
          <Button size="sm" variant="outline"><Icon name="plus" size={14} /> New</Button>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "var(--space-4)" }}>
        {[["Revenue", "₺48.2k", "up", "▲ 12%"], ["Users", "1.284", "up", "▲ 4%"], ["Error rate", "0.4%", "down", "▼ 0.1%"], ["Uptime", "99.98%", "up", "▲ 0.02%"]].map(([k, v, dir, d]) => (
          <div key={k} className="dsv-stat"><div className="k">{k}</div><div className="v">{v}</div><div className={`d ${dir}`}>{d}</div></div>
        ))}
      </div>
      <div className="dsv-card">
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "var(--space-3)" }}>
          <strong style={{ fontSize: "var(--font-size-sm)" }}>Monthly goal</strong>
          <span className="dsv-mono dsv-muted" style={{ fontSize: "var(--font-size-xs)" }}>66 / 100</span>
        </div>
        <Progress.Root className="dsv-progress" value={66} style={{ width: "100%" }}>
          <Progress.Indicator className="dsv-progress-indicator" style={{ width: "66%" }} />
        </Progress.Root>
        <Separator className="dsv-sep" />
        <div className="dsv-inline" style={{ justifyContent: "space-between", fontSize: "var(--font-size-xs)" }}>
          <span className="dsv-muted">Deploy succeeded · 2m ago</span>
          <span className="dsv-badge dsv-badge--success">Live</span>
        </div>
        <div className="dsv-inline" style={{ justifyContent: "space-between", fontSize: "var(--font-size-xs)" }}>
          <span className="dsv-muted">Quota warning · 3h ago</span>
          <span className="dsv-badge dsv-badge--warning">Pending</span>
        </div>
        <div style={{ display: "flex", gap: "var(--space-2)", marginTop: "var(--space-4)" }}>
          {[13, 5, 47, 22].map((n) => (
            <HoverCard.Root key={n} openDelay={120}>
              <HoverCard.Trigger asChild><span style={{ display: "inline-flex" }}><Avat n={n} /></span></HoverCard.Trigger>
              <HoverCard.Portal container={portalContainer}>
                <HoverCard.Content className="dsv-pop" sideOffset={6}>
                  <div className="dsv-hovercard"><div><div className="name">Contributor #{n}</div><div className="bio">24 commits, 3 PR reviews this month.</div></div></div>
                </HoverCard.Content>
              </HoverCard.Portal>
            </HoverCard.Root>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────── Analytics detail
function AnalyticsScreen() {
  const bars = [40, 65, 52, 80, 72, 95, 60, 88, 74, 92, 68, 100];
  const [range, setRange] = useState("month");
  return (
    <div className="dsv-stack">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h3 style={{ margin: 0, fontSize: "var(--font-size-lg)" }}>Traffic</h3>
        <div className="dsv-segmented">
          {[["day", "Day"], ["week", "Week"], ["month", "Month"]].map(([v, l]) => (
            <button key={v} aria-pressed={range === v} onClick={() => setRange(v)}>{l}</button>
          ))}
        </div>
      </div>
      <div className="dsv-card">
        <div style={{ display: "flex", alignItems: "flex-end", gap: "var(--space-1-5)", height: "var(--space-32)" }}>
          {bars.map((h, i) => (
            <div key={i} title={`${h}%`} style={{ flex: 1, height: `${h}%`, background: i === bars.length - 1 ? "var(--color-accent)" : "var(--color-accent-muted)", borderRadius: "var(--radius-sm) var(--radius-sm) 0 0" }} />
          ))}
        </div>
        <Separator className="dsv-sep" />
        <div className="dsv-inline" style={{ gap: "var(--space-6)", alignItems: "center" }}>
          <svg width="140" height="48" viewBox="0 0 140 48" role="img" aria-label="trend">
            <path d="M0,36 L24,30 L48,33 L72,20 L96,24 L120,10 L140,14" fill="none" stroke="var(--color-accent)" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <svg width="56" height="56" viewBox="0 0 72 72" role="img" aria-label="share">
            <circle cx="36" cy="36" r="28" fill="none" stroke="var(--color-surface-sunken)" strokeWidth="10" />
            <circle cx="36" cy="36" r="28" fill="none" stroke="var(--color-accent)" strokeWidth="10" strokeDasharray="110 176" strokeLinecap="round" transform="rotate(-90 36 36)" />
          </svg>
          <span className="dsv-muted" style={{ fontSize: "var(--font-size-xs)" }}>line + donut share the bar palette</span>
        </div>
        <Separator className="dsv-sep" />
        <dl className="dsv-datalist">
          <dt>Total visits</dt><dd>128.402</dd>
          <dt>Unique visitors</dt><dd>54.190</dd>
          <dt>Avg. duration</dt><dd>2d 41s</dd>
          <dt>Bounce rate</dt><dd>38%</dd>
        </dl>
      </div>
      <div className="dsv-table-wrap">
      <table className="dsv-table dsv-table--zebra">
        <thead><tr><th>Page</th><th>Views</th><th>Change</th></tr></thead>
        <tbody>
          {[["/", "42.1k", "up"], ["/pricing", "18.7k", "up"], ["/docs", "12.3k", "down"], ["/blog", "9.8k", "up"]].map(([p, v, d]) => (
            <tr key={p}><td className="dsv-mono">{p}</td><td>{v}</td><td><span className={`dsv-badge dsv-badge--${d === "up" ? "success" : "danger"}`}>{d === "up" ? "▲ up" : "▼ down"}</span></td></tr>
          ))}
        </tbody>
      </table>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────── Data table
function TableScreen() {
  const portalContainer = usePortalContainer();
  const rows = [
    ["INV-1001", "Ada Lovelace", "Paid", "₺1.200"],
    ["INV-1002", "Grace Hopper", "Pending", "₺840"],
    ["INV-1003", "Alan Turing", "Overdue", "₺2.100"],
    ["INV-1004", "Katherine Johnson", "Paid", "₺560"],
    ["INV-1005", "Edsger Dijkstra", "Pending", "₺1.940"],
    ["INV-1006", "Barbara Liskov", "Paid", "₺720"],
  ];
  const badge = { "Paid": "success", "Pending": "warning", "Overdue": "danger" };
  return (
    <div className="dsv-card" style={{ padding: 0, overflow: "hidden" }}>
      <div className="dsv-toolbar" style={{ border: "none", borderBottom: "var(--border-width-thin) solid var(--color-divider)", borderRadius: 0, padding: "var(--space-3)" }}>
        <div className="dsv-input-wrap dsv-input-wrap--prefix" style={{ minWidth: "min(220px, 100%)", flex: "1 1 180px", maxWidth: 280 }}>
          <span className="dsv-adorn dsv-adorn--prefix"><Icon name="search" size={14} /></span>
          <input className="dsv-input" placeholder="Search invoices…" aria-label="Search invoices" style={{ width: "100%" }} />
        </div>
        <div style={{ flex: 1 }} />
        <Dialog.Root>
          <Dialog.Trigger asChild><Button size="sm"><Icon name="plus" size={14} /> Invoice</Button></Dialog.Trigger>
          <Dialog.Portal container={portalContainer}>
            <Dialog.Overlay className="dsv-overlay" />
            <Dialog.Content className="dsv-modal">
              <Dialog.Title asChild><h3>New invoice</h3></Dialog.Title>
              <Dialog.Description asChild><p>Enter customer and amount.</p></Dialog.Description>
              <div className="dsv-stack">
                <Field label="Customer" id="t-cust"><input id="t-cust" className="dsv-input" /></Field>
                <Field label="Amount" id="t-amt"><input id="t-amt" className="dsv-input" placeholder="₺" /></Field>
              </div>
              <div className="dsv-modal-actions" style={{ marginTop: "var(--space-5)" }}>
                <Dialog.Close asChild><Button variant="ghost">Cancel</Button></Dialog.Close>
                <Dialog.Close asChild><Button>Create</Button></Dialog.Close>
              </div>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      </div>
      <div className="dsv-table-wrap">
      <table className="dsv-table">
        <thead><tr>{["Invoice", "Customer", "Status", "Amount", ""].map((h) => <th key={h}>{h}</th>)}</tr></thead>
        <tbody>
          {rows.map(([id, cust, st, amt]) => (
            <tr key={id}>
              <td className="dsv-mono">{id}</td><td>{cust}</td>
              <td><span className={`dsv-badge dsv-badge--${badge[st]}`}>{st}</span></td>
              <td>{amt}</td>
              <td style={{ textAlign: "right" }}>
                <DropdownMenu.Root>
                  <DropdownMenu.Trigger asChild><Button variant="ghost" size="sm" className="dsv-icon-btn" aria-label="Actions"><Icon name="dots" size={14} /></Button></DropdownMenu.Trigger>
                  <DropdownMenu.Portal container={portalContainer}>
                    <DropdownMenu.Content className="dsv-menu" align="end" sideOffset={4}>
                      <DropdownMenu.Item className="dsv-menu-item">View</DropdownMenu.Item>
                      <DropdownMenu.Item className="dsv-menu-item">Copy</DropdownMenu.Item>
                      <DropdownMenu.Separator className="dsv-menu-sep" />
                      <DropdownMenu.Item className="dsv-menu-item dsv-menu-item--danger">Delete</DropdownMenu.Item>
                    </DropdownMenu.Content>
                  </DropdownMenu.Portal>
                </DropdownMenu.Root>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────── Kanban
function KanbanScreen() {
  const cols = {
    "To do": ["Parser bug", "Update docs", "Add lint to CI"],
    "In progress": ["Preview tab", "Token bridge"],
    "Done": ["Schema view", "409 guard", "Tests"],
  };
  return (
    <div className="dsv-kanban">
      {Object.entries(cols).map(([col, cards]) => (
        <div key={col} className="dsv-kanban-col">
          <h4>{col} · {cards.length}</h4>
          {cards.map((c) => (
            <div key={c} className="dsv-kanban-card">
              {c}
              <div className="dsv-inline" style={{ marginTop: "var(--space-2)", justifyContent: "space-between" }}>
                <span className="dsv-tag">{col === "Done" ? "done" : "dev"}</span>
                <Avat n={c.length + 5} size="xs" />
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────── Chat
function ChatScreen() {
  return (
    <div style={{ maxWidth: 460, margin: "0 auto" }}>
      <div className="dsv-card" style={{ padding: 0, overflow: "hidden" }}>
        <div className="dsv-inline" style={{ padding: "var(--space-3) var(--space-4)", borderBottom: "var(--border-width-thin) solid var(--color-divider)" }}>
          <Avat n={12} /><div><div style={{ fontSize: "var(--font-size-sm)", fontWeight: "var(--font-weight-medium)" }}>Grace Hopper</div><div className="dsv-muted" style={{ fontSize: "var(--font-size-xs)" }}>online</div></div>
        </div>
        <div className="dsv-chat" style={{ padding: "var(--space-4)" }}>
          <div className="dsv-muted" style={{ textAlign: "center", fontSize: "var(--font-size-xs)" }}>Today</div>
          <div className="dsv-bubble dsv-bubble--them">Is token bridge working?</div>
          <div className="dsv-bubble dsv-bubble--me">Yes, live via postMessage.</div>
          <div className="dsv-bubble dsv-bubble--them">Great. Let's add more screens.</div>
          <div className="dsv-bubble dsv-bubble--me">This screen is one of them 😄</div>
          <div className="dsv-bubble dsv-bubble--them"><span className="dsv-spinner dsv-spinner--xs" /> typing…</div>
        </div>
        <div className="dsv-inline" style={{ padding: "var(--space-3)", borderTop: "var(--border-width-thin) solid var(--color-divider)", gap: "var(--space-2)" }}>
          <input className="dsv-input" placeholder="Write a message…" style={{ flex: 1 }} />
          <Button className="dsv-icon-btn" aria-label="Send"><Icon name="chevronRight" size={16} /></Button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────── Notifications / activity
function NotificationsScreen() {
  const items = [
    ["check", "success", "Deploy succeeded", "v0.2.0 live", "2m"],
    ["user", "info", "New member", "@turing joined the team", "1h"],
    ["bell", "warning", "Quota warning", "Storage 85% full", "3h"],
    ["x", "danger", "Payment failed", "Card declined — update", "yesterday"],
  ];
  return (
    <div style={{ maxWidth: 480, margin: "0 auto" }}>
      <div className="dsv-card" style={{ padding: 0, overflow: "hidden" }}>
        <div className="dsv-inline" style={{ justifyContent: "space-between", padding: "var(--space-3) var(--space-4)", borderBottom: "var(--border-width-thin) solid var(--color-divider)" }}>
          <strong style={{ fontSize: "var(--font-size-sm)" }}>Notifications</strong>
          <Button variant="ghost" size="sm">Mark all as read</Button>
        </div>
        {items.map(([ic, tone, title, body, when], i) => (
          <div key={i} className="dsv-inline" style={{ alignItems: "flex-start", gap: "var(--space-3)", padding: "var(--space-3) var(--space-4)", borderBottom: i < items.length - 1 ? "var(--border-width-thin) solid var(--color-border-subtle)" : "none" }}>
            <span className={`dsv-badge dsv-badge--${tone}`} style={{ borderRadius: "var(--radius-full)", padding: "var(--space-1)" }}><Icon name={ic} size={12} /></span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: "var(--font-size-sm)", fontWeight: "var(--font-weight-medium)" }}>{title}</div>
              <div className="dsv-muted" style={{ fontSize: "var(--font-size-xs)" }}>{body}</div>
            </div>
            <span className="dsv-muted" style={{ fontSize: "var(--font-size-xs)" }}>{when}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────── Checkout
function CheckoutScreen() {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "var(--space-5)", maxWidth: 720, margin: "0 auto" }}>
      <div className="dsv-card" style={{ minWidth: 0 }}>
        <h3 style={{ margin: "0 0 var(--space-4)", fontSize: "var(--font-size-lg)" }}>Payment</h3>
        <div className="dsv-stack">
          <Field label="Name on card" id="c-name"><input id="c-name" className="dsv-input" defaultValue="Ada Lovelace" /></Field>
          <Field label="Card number" id="c-num"><input id="c-num" className="dsv-input" placeholder="•••• •••• •••• ••••" inputMode="numeric" /></Field>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "var(--space-3)" }}>
            <Field label="Expiry" id="c-exp"><input id="c-exp" className="dsv-input" placeholder="MM/YY" inputMode="numeric" autoComplete="cc-exp" /></Field>
            <Field label="CVC" id="c-cvc"><input id="c-cvc" className="dsv-input" placeholder="•••" inputMode="numeric" autoComplete="cc-csc" /></Field>
          </div>
          <label className="dsv-control-label">
            <Checkbox.Root className="dsv-check" defaultChecked><Checkbox.Indicator><Icon name="check" size={14} /></Checkbox.Indicator></Checkbox.Root>
            Billing address same as shipping
          </label>
        </div>
      </div>
      <div>
        <div className="dsv-card">
          <div style={{ fontSize: "var(--font-size-sm)", fontWeight: "var(--font-weight-medium)", marginBottom: "var(--space-3)" }}>Order summary</div>
          <dl className="dsv-datalist" style={{ gridTemplateColumns: "1fr max-content" }}>
            <dt>Pro (yearly)</dt><dd>₺144</dd>
            <dt>Extra seats × 3</dt><dd>₺108</dd>
            <dt>VAT 20%</dt><dd>₺50.40</dd>
          </dl>
          <Separator className="dsv-sep" />
          <div className="dsv-inline" style={{ justifyContent: "space-between", fontWeight: "var(--font-weight-semibold)" }}>
            <span>Total</span><span>₺302.40</span>
          </div>
          <Button size="lg" style={{ width: "100%", marginTop: "var(--space-4)" }}>Pay</Button>
          <p className="dsv-muted" style={{ fontSize: "var(--font-size-xs)", textAlign: "center", marginTop: "var(--space-2)" }}>Secure with 256-bit SSL</p>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────── Empty state screen
function EmptyStateScreen() {
  return (
    <div style={{ maxWidth: 520, margin: "0 auto" }}>
      <div className="dsv-breadcrumb" style={{ marginBottom: "var(--space-4)" }}>
        <a className="dsv-link" href="#screen-empty" style={{ textDecoration: "none" }}>Workspace</a><Icon name="chevronRight" size={12} /><span aria-current="page">Projects</span>
      </div>
      <div className="dsv-card">
        <div className="dsv-empty">
          <span className="glyph"><Icon name="plus" size={24} /></span>
          <h4>No projects yet</h4>
          <p>Create your first project or import a repository.</p>
          <div className="dsv-inline" style={{ justifyContent: "center" }}>
            <Button>Create project</Button>
            <Button variant="outline">Import repository</Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────── Command palette
function CommandPaletteScreen() {
  const groups = [
    ["Go", ["Go to homepage", "Go to settings", "Go to invoices"]],
    ["Action", ["New project", "Invite member", "Create API key"]],
  ];
  return (
    <div style={{ maxWidth: 480, margin: "0 auto" }}>
      <div className="dsv-menu" style={{ position: "static", padding: 0, animation: "none", minWidth: 0 }}>
        <div className="dsv-inline" style={{ gap: "var(--space-2)", padding: "var(--space-3) var(--space-4)", borderBottom: "var(--border-width-thin) solid var(--color-divider)" }}>
          <Icon name="search" size={16} />
          <input className="dsv-input" placeholder="Search commands or pages…" aria-label="Search commands" style={{ border: "none", padding: 0, height: "auto", background: "transparent", flex: 1, minWidth: 0 }} autoFocus={false} />
          <kbd className="dsv-kbd">Esc</kbd>
        </div>
        <div style={{ padding: "var(--space-1-5)" }}>
          {groups.map(([g, items], gi) => (
            <div key={g}>
              <div className="dsv-menu-label">{g}</div>
              {items.map((it, i) => (
                <div key={it} className="dsv-menu-item" data-highlighted={gi === 0 && i === 0 ? "" : undefined}>
                  <Icon name={gi === 0 ? "chevronRight" : "plus"} size={14} /> {it}
                  {gi === 0 && i === 0 && <span className="dsv-menu-shortcut">↵</span>}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────── File upload
function UploadScreen() {
  const files = [["report.pdf", "2.4 MB", 100], ["data.csv", "812 KB", 100], ["presentation.key", "18 MB", 46]];
  return (
    <div style={{ maxWidth: 520, margin: "0 auto" }}>
      <div className="dsv-card">
        <div style={{ border: "var(--border-width-thick) dashed var(--color-border-strong)", borderRadius: "var(--radius-lg)", padding: "var(--space-8)", textAlign: "center", color: "var(--color-text-muted)" }}>
          <span className="glyph" style={{ display: "inline-flex", width: "var(--space-12)", height: "var(--space-12)", borderRadius: "var(--radius-full)", background: "var(--color-surface-sunken)", alignItems: "center", justifyContent: "center", marginBottom: "var(--space-3)" }}>
            <Icon name="plus" size={20} />
          </span>
          <div style={{ fontSize: "var(--font-size-sm)" }}>Drag files here or <Link to="#screen-upload">browse</Link></div>
        </div>
        <div className="dsv-stack" style={{ marginTop: "var(--space-4)", gap: "var(--space-3)" }}>
          {files.map(([name, size, pct]) => (
            <div key={name}>
              <div className="dsv-inline" style={{ justifyContent: "space-between", fontSize: "var(--font-size-sm)" }}>
                <span className="dsv-inline"><Icon name="file" size={14} /> {name}</span>
                <span className="dsv-muted" style={{ fontSize: "var(--font-size-xs)" }}>{pct === 100 ? size : `${pct}%`}</span>
              </div>
              <Progress.Root className="dsv-progress" value={pct} style={{ width: "100%", marginTop: "var(--space-1)" }}>
                <Progress.Indicator className="dsv-progress-indicator" style={{ width: `${pct}%`, background: pct === 100 ? "var(--color-success)" : "var(--color-accent)" }} />
              </Progress.Root>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────── 404 / error
function NotFoundScreen() {
  return (
    <div style={{ textAlign: "center", padding: "var(--space-12) var(--space-6)" }}>
      <div className="dsv-display" style={{ color: "var(--color-text)" }}>404</div>
      <p className="dsv-lede" style={{ margin: "var(--space-4) 0" }}>This page wandered off the grid.</p>
      <p className="dsv-muted" style={{ fontSize: "var(--font-size-sm)", margin: "0 0 var(--space-6)" }}>
        The link may be broken — or the page was moved. <a className="dsv-link" href="#screen-dashboard">Back to dashboard</a>
      </p>
      <div className="dsv-inline" style={{ justifyContent: "center" }}>
        <Button>Go home</Button><Button variant="outline">Contact support</Button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────── Marketing hero
function MarketingScreen() {
  return (
    <div>
      <div className="dsv-hero-panel" style={{ marginBottom: "var(--section-space-md)" }}>
        <span className="dsv-hero-orb dsv-hero-orb--a" aria-hidden="true" />
        <span className="dsv-hero-orb dsv-hero-orb--b" aria-hidden="true" />
        <span className="dsv-hero-grid" aria-hidden="true" />
        <span className="dsv-badge dsv-badge--on-dark"><span className="dsv-pulse-dot" aria-hidden="true" />New · v2.0 — compare mode</span>
        <h3 className="dsv-display dsv-display--dlg" style={{ margin: "var(--space-4) 0 var(--space-3)" }}>Design systems,<br />visualized</h3>
        <p className="dsv-lede" style={{ margin: "0 auto var(--space-6)", maxWidth: "var(--text-measure-md)" }}>Paste tokens, get a gallery, a live preview and a diff. One link per view — light and dark.</p>
        <div className="dsv-inline" style={{ justifyContent: "center", gap: "var(--space-3)", flexWrap: "wrap" }}>
          <Button size="lg" className="dsv-hero-cta">Start free <Icon name="chevronRight" size={16} /></Button><Button size="lg" variant="outline" className="dsv-hero-ghost">Live demo</Button>
        </div>
        <div className="dsv-hero-stats">
          <span><strong>192+</strong> tokens covered</span>
          <span className="dsv-hero-stats-sep" aria-hidden="true" />
          <span><strong>4.9/5</strong> designer rating</span>
          <span className="dsv-hero-stats-sep" aria-hidden="true" />
          <span><strong>60s</strong> to first preview</span>
        </div>
      </div>
      <div className="dsv-hero-img" style={{ marginBottom: "var(--space-8)" }}>
        <img src="https://images.unsplash.com/photo-1503264116251-35a269479413?w=900&q=60" alt="Product preview" loading="lazy" />
        <span className="dsv-hero-img-cap"><span className="dsv-badge dsv-badge--on-dark">Live preview</span><span>Tokens → gallery in one paste</span></span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "var(--space-4)", marginBottom: "var(--space-8)" }}>
        {[["file", "Tokens", "Full-schema coverage, linted on paste"], ["eye", "Preview", "Radix primitives in your tokens"], ["copy", "Compare", "Side by side diff, shareable links"]].map(([ic, h, b]) => (
          <div key={h} className="dsv-card dsv-card--lift dsv-feature-card">
            <span className="dsv-feature-ico"><Icon name={ic} size={18} /></span>
            <div style={{ fontWeight: "var(--font-weight-semibold)", marginTop: "var(--space-3)" }}>{h}</div>
            <div className="dsv-muted" style={{ fontSize: "var(--font-size-sm)", marginTop: "var(--space-1)" }}>{b}</div>
          </div>
        ))}
      </div>
      <div className="dsv-inline" style={{ justifyContent: "center", gap: "var(--space-6)", flexWrap: "wrap", marginBottom: "var(--space-8)" }} aria-label="Trusted by">
        {["ACME", "GLOBEX", "INITECH", "UMBRELLA"].map((w) => (
          <span key={w} className="dsv-muted" style={{ fontSize: "var(--font-size-xs)", fontWeight: "var(--font-weight-bold)", letterSpacing: "var(--letter-spacing-wider)" }}>{w}</span>
        ))}
      </div>
      <blockquote className="dsv-quote" style={{ marginBottom: "var(--space-8)" }}>
        “We finally see every token in context.”
        <cite>
          <span className="dsv-inline" style={{ gap: "var(--space-2)", marginTop: "var(--space-2)" }}>
            <span className="dsv-avatar dsv-avatar--sm"><span className="dsv-avatar-fallback" style={{ fontSize: "var(--font-size-xs)" }}>PL</span></span>
            <span>Platform team lead · Acme</span>
          </span>
        </cite>
      </blockquote>
      <div className="dsv-banner dsv-banner--on-dark" style={{ justifyContent: "center", flexWrap: "wrap", gap: "var(--space-3)" }}>
        <span>Ready when you are</span>
        <Button size="sm" className="dsv-btn--on-dark-solid" style={{ marginLeft: "var(--space-3)" }}>Get started</Button>
        <Button size="sm" variant="ghost" className="dsv-btn--on-dark-ghost">Talk to sales</Button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────── Onboarding wizard
function OnboardingScreen() {
  const [step, setStep] = useState(1);
  const labels = ["Workspace", "Invite", "Connect", "Done"];
  return (
    <div style={{ maxWidth: 480, margin: "0 auto" }}>
      <div className="dsv-steps dsv-steps--center" style={{ marginBottom: "var(--space-5)" }} role="list" aria-label="Onboarding progress">
        {labels.map((l, i) => (
          <div key={l} role="listitem" aria-current={i === step ? "step" : undefined} className={`dsv-step ${i < step ? "dsv-step--done" : i === step ? "dsv-step--active" : ""}`}>
            <span className="dot">{i < step ? <Icon name="check" size={12} /> : i + 1}</span><span className="label">{l}</span>
            {i < labels.length - 1 && <span className="bar" aria-hidden="true" />}
          </div>
        ))}
      </div>
      <Progress.Root className="dsv-progress" value={(step + 1) * 25} style={{ width: "100%", marginBottom: "var(--space-5)" }}>
        <Progress.Indicator className="dsv-progress-indicator" style={{ width: `${(step + 1) * 25}%` }} />
      </Progress.Root>
      <div className="dsv-card">
        <h3 style={{ margin: "0 0 var(--space-2)", fontSize: "var(--font-size-lg)" }}>{labels[step]}</h3>
        <p className="dsv-muted" style={{ fontSize: "var(--font-size-sm)", margin: "0 0 var(--space-4)" }}>Step {step + 1} of {labels.length}</p>
        <Field label="Value" id="ob-v"><input id="ob-v" className="dsv-input" placeholder={`Your ${labels[step].toLowerCase()}…`} /></Field>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: "var(--space-5)" }}>
          <Button variant="ghost" disabled={step === 0} onClick={() => setStep((s) => s - 1)}>Back</Button>
          <Button onClick={() => setStep((s) => Math.min(labels.length - 1, s + 1))}>{step === labels.length - 1 ? "Finish" : "Next"}</Button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────── Inbox
function InboxScreen() {
  const [sel, setSel] = useState(1);
  const mails = [
    ["Ada Lovelace", "Token bridge is live", "Preview updates via postMessage…", "9:41"],
    ["CI Bot", "Build passed", "preview/dist ready in 41s…", "8:15"],
    ["Grace Hopper", "Review request", "Can you check the diff table?…", "Yesterday"],
    ["Figma", "3 new comments", "On the hero exploration…", "Mon"],
  ];
  return (
    <div className="dsv-inbox">
      <div style={{ borderRight: "var(--border-width-thin) solid var(--color-divider)", background: "var(--color-surface)" }}>
        <div className="dsv-inline" style={{ padding: "var(--space-3)", borderBottom: "var(--border-width-thin) solid var(--color-divider)" }}>
          <input className="dsv-input" placeholder="Search mail…" aria-label="Search mail" style={{ flex: 1, minWidth: 0 }} />
        </div>
        {mails.map(([from, subj, body, when], i) => (
          <div key={subj} role="option" aria-selected={sel === i} tabIndex={0} className={`dsv-list-item ${sel === i ? "is-selected" : ""}`} style={{ borderRadius: 0, padding: "var(--space-3)" }} onClick={() => setSel(i)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSel(i); } }}>
            <div style={{ minWidth: 0 }}>
              <div className="dsv-inline" style={{ justifyContent: "space-between" }}>
                <strong style={{ fontSize: "var(--font-size-sm)" }}>{from}</strong>
                <span className="dsv-muted" style={{ fontSize: "var(--font-size-xs)" }}>{when}</span>
              </div>
              <div style={{ fontSize: "var(--font-size-sm)" }}>{subj}</div>
              <div className="dsv-muted" style={{ fontSize: "var(--font-size-xs)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{body}</div>
            </div>
          </div>
        ))}
      </div>
      <div style={{ padding: "var(--space-5)", background: "var(--color-bg)", minWidth: 0 }}>
        <div className="dsv-inline" style={{ marginBottom: "var(--space-3)" }}>
          <Button variant="ghost" size="sm">Archive</Button><Button variant="ghost" size="sm">Snooze</Button><Button variant="ghost" size="sm">Delete</Button>
        </div>
        <h3 style={{ margin: "0 0 var(--space-1)", fontSize: "var(--font-size-lg)" }}>{mails[sel][1]}</h3>
        <div className="dsv-muted" style={{ fontSize: "var(--font-size-xs)", marginBottom: "var(--space-4)" }}>{mails[sel][0]} · {mails[sel][3]}</div>
        <p className="dsv-prose" style={{ margin: 0 }}>Hi team — {mails[sel][2]} Full thread renders here with <a className="dsv-link" href="#screen-inbox">inline links</a> and attachments.</p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────── Schedule
function ScheduleScreen() {
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri"];
  const events = { Tue: [["9:30", "Standup", "success"], ["14:00", "Design review", "info"]], Wed: [["11:00", "1:1 Ada", "warning"]], Thu: [["10:00", "Sprint planning", "info"], ["16:00", "Demo", "success"]] };
  return (
    <div>
      <div className="dsv-screen-subnav dsv-inline" style={{ padding: "var(--space-2) var(--space-3)", marginBottom: "var(--space-4)", borderRadius: "var(--radius-md)" }}>
        <strong style={{ fontSize: "var(--font-size-sm)" }}>June 2026</strong>
        <span className="dsv-muted" style={{ fontSize: "var(--font-size-xs)" }}>Week 24</span>
        <span style={{ flex: 1 }} />
        <Button size="sm" variant="ghost">Today</Button><Button size="sm"><Icon name="plus" size={14} /> Event</Button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: "var(--space-3)" }}>
        {days.map((d) => (
          <div key={d} className="dsv-card" style={{ padding: "var(--space-3)", minWidth: 0 }}>
            <div className="dsv-muted" style={{ fontSize: "var(--font-size-xs)", marginBottom: "var(--space-2)" }}>{d}</div>
            {(events[d] || []).map(([t, label, tone]) => (
              <div key={label} className={`dsv-badge dsv-badge--${tone}`} style={{ display: "flex", marginBottom: "var(--space-1)" }}>{t} · {label}</div>
            ))}
            {!(events[d] || []).length && <span className="dsv-muted" style={{ fontSize: "var(--font-size-xs)" }}>—</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────── Billing
function BillingScreen() {
  const rows = [["Pro plan · yearly", "1", "₺144.00"], ["Extra seats", "3", "₺108.00"], ["Overage", "1", "₺12.00"]];
  return (
    <div style={{ maxWidth: 560, margin: "0 auto" }}>
      <div className="dsv-screen-subnav dsv-inline" style={{ padding: "var(--space-2) var(--space-3)", marginBottom: "var(--space-4)", borderRadius: "var(--radius-md)" }}>
        <strong style={{ fontSize: "var(--font-size-sm)" }}>INV-2026-041</strong>
        <span className="dsv-badge dsv-badge--warning">Due Jun 30</span>
        <span style={{ flex: 1 }} /><Button size="sm" variant="ghost">Print</Button>
      </div>
      <div className="dsv-table-wrap">
        <table className="dsv-table">
          <thead><tr><th>Description</th><th>Qty</th><th style={{ textAlign: "right" }}>Amount</th></tr></thead>
          <tbody>
            {rows.map(([d, q, a]) => <tr key={d}><td>{d}</td><td>{q}</td><td style={{ textAlign: "right" }}>{a}</td></tr>)}
          </tbody>
        </table>
      </div>
      <dl className="dsv-datalist" style={{ gridTemplateColumns: "1fr max-content", marginTop: "var(--space-4)" }}>
        <dt>Subtotal</dt><dd>₺264.00</dd>
        <dt>VAT 20%</dt><dd>₺52.80</dd>
        <dt><strong>Total</strong></dt><dd><strong>₺316.80</strong></dd>
      </dl>
      <div className="dsv-inline" style={{ marginTop: "var(--space-5)" }}>
        <Button>Pay now</Button><Button variant="outline">Download PDF</Button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────── Search results
function SearchScreen() {
  const [page, setPage] = useState(2);
  const [facet, setFacet] = useState("All");
  return (
    <div style={{ maxWidth: 600, margin: "0 auto" }}>
      <div className="dsv-input-wrap dsv-input-wrap--prefix" style={{ marginBottom: "var(--space-3)" }}>
        <span className="dsv-adorn dsv-adorn--prefix"><Icon name="search" size={14} /></span>
        <input className="dsv-input" defaultValue="design tokens" aria-label="Search" />
      </div>
      <div className="dsv-segmented" style={{ marginBottom: "var(--space-4)" }}>
        {["All", "Docs", "Components", "People"].map((f) => (
          <button key={f} aria-pressed={facet === f} onClick={() => setFacet(f)}>{f}</button>
        ))}
      </div>
      <div className="dsv-stack" style={{ gap: "var(--space-4)" }}>
        {[["Token reference", "Schema of 192 tokens with coverage…", "#patterns"], ["Preview app", "Radix primitives styled by tokens…", "#screen-dashboard"], ["Compare mode", "Diff two systems side by side…", "#screen-table"]].map(([t, b, href]) => (
          <div key={t}>
            <a className="dsv-link" href={href} style={{ fontSize: "var(--font-size-base)", fontWeight: "var(--font-weight-medium)" }}>{t}</a>
            <p className="dsv-muted" style={{ fontSize: "var(--font-size-sm)", margin: "var(--space-1) 0 0" }}>{b}</p>
          </div>
        ))}
      </div>
      <div className="dsv-pagination" style={{ marginTop: "var(--space-5)" }}>
        {[1, 2, 3, 4].map((n) => <button key={n} aria-current={n === page ? "page" : undefined} onClick={() => setPage(n)}>{n}</button>)}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────── Team
function TeamScreen() {
  const portalContainer = usePortalContainer();
  const rows = [["Ada Lovelace", "Admin", "success"], ["Grace Hopper", "Editor", "info"], ["Alan Turing", "Viewer", "warning"]];
  return (
    <div style={{ maxWidth: 640, margin: "0 auto" }}>
      <div className="dsv-inline" style={{ justifyContent: "space-between", marginBottom: "var(--space-4)" }}>
        <div className="dsv-avatar-group">
          {[13, 22, 31].map((n) => <Avat key={n} n={n} size="sm" />)}
          <span className="dsv-avatar dsv-avatar-more dsv-avatar--sm">+5</span>
        </div>
        <Dialog.Root>
          <Dialog.Trigger asChild><Button size="sm"><Icon name="plus" size={14} /> Invite</Button></Dialog.Trigger>
          <Dialog.Portal container={portalContainer}>
            <Dialog.Overlay className="dsv-overlay" />
            <Dialog.Content className="dsv-modal">
              <Dialog.Title asChild><h3>Invite member</h3></Dialog.Title>
              <Dialog.Description asChild><p>They get an email with a join link.</p></Dialog.Description>
              <Field label="Email" id="tm-e"><input id="tm-e" className="dsv-input" placeholder="turing@example.com" /></Field>
              <div className="dsv-modal-actions" style={{ marginTop: "var(--space-5)" }}>
                <Dialog.Close asChild><Button variant="ghost">Cancel</Button></Dialog.Close>
                <Dialog.Close asChild><Button>Send invite</Button></Dialog.Close>
              </div>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      </div>
      <div className="dsv-table-wrap">
        <table className="dsv-table">
          <thead><tr><th>Member</th><th>Role</th><th>Status</th></tr></thead>
          <tbody>
            {rows.map(([name, role, tone]) => (
              <tr key={name}><td><span className="dsv-inline"><Avat n={name.length + 10} size="sm" /> {name}</span></td><td>{role}</td><td><span className={`dsv-badge dsv-badge--${tone}`}>Active</span></td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────── Report (document)
function ReportScreen() {
  return (
    <div style={{ maxWidth: 560, margin: "0 auto", fontFamily: "var(--font-serif)", lineHeight: "var(--line-height-relaxed)" }}>
      <div className="dsv-muted" style={{ fontSize: "var(--font-size-xs)", fontFamily: "var(--font-sans)" }}>Q2 · Design systems report</div>
      <h3 className="dsv-display dsv-display--3xl" style={{ margin: "var(--space-3) 0", fontFamily: "var(--font-serif)" }}>Coverage is up, drift is down</h3>
      <p className="dsv-prose" style={{ fontFamily: "var(--font-serif)", fontSize: "var(--font-size-base)" }}>
        Token adoption rose from 61% to 84% this quarter. The preview now exercises every scale —
        color, type, spacing, radius, shadow and motion — so drift surfaces before it ships.
      </p>
      <blockquote className="dsv-quote">“One link per view changed how we review.”<cite>— design ops</cite></blockquote>
      <p className="dsv-prose" style={{ fontFamily: "var(--font-serif)" }}>Next: dark-variant review and print styles for invoices.</p>
    </div>
  );
}

// ─────────────────────────────────────────── Files
function FilesScreen() {
  const files = [["report.pdf", "2.4 MB", "Ada", 100], ["data.csv", "812 KB", "Grace", 100], ["video.mp4", "1.2 GB", "Alan", 46]];
  return (
    <div style={{ maxWidth: 640, margin: "0 auto" }}>
      <div className="dsv-inline" style={{ justifyContent: "space-between", marginBottom: "var(--space-4)" }}>
        <div>
          <strong style={{ fontSize: "var(--font-size-sm)" }}>Storage</strong>
          <div className="dsv-muted" style={{ fontSize: "var(--font-size-xs)" }}>6.1 of 10 GB used</div>
        </div>
        <Button size="sm"><Icon name="plus" size={14} /> Upload</Button>
      </div>
      <Progress.Root className="dsv-progress" value={61} style={{ width: "100%", marginBottom: "var(--space-5)" }}>
        <Progress.Indicator className="dsv-progress-indicator" style={{ width: "61%" }} />
      </Progress.Root>
      <div className="dsv-card" style={{ padding: 0, overflow: "hidden" }}>
        {files.map(([name, size, who, pct]) => (
          <div key={name} className="dsv-inline" style={{ padding: "var(--space-3) var(--space-4)", borderBottom: "var(--border-width-thin) solid var(--color-border-subtle)", gap: "var(--space-3)" }}>
            <Icon name="file" size={16} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: "var(--font-size-sm)", fontWeight: "var(--font-weight-medium)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</div>
              <div className="dsv-muted" style={{ fontSize: "var(--font-size-xs)" }}>{size} · {who} · {pct === 100 ? "done" : `${pct}%`}</div>
            </div>
            {pct === 100 ? <span className="dsv-badge dsv-badge--success">Synced</span> : <span className="dsv-spinner dsv-spinner--sm" />}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────── Activity / audit log
function ActivityScreen() {
  const [f, setF] = useState("All");
  const items = [
    ["Deploy succeeded", "v0.2.0 live · CI Bot", "2m", "success", "Deploys"],
    ["Member joined", "@turing joined the team", "1h", "info", "Members"],
    ["Quota warning", "Storage 85% full", "3h", "warning", "Billing"],
    ["Payment failed", "Card declined — update", "yesterday", "danger", "Billing"],
    ["API key created", "by @ada · read-only", "2d", "info", "Deploys"],
  ];
  return (
    <div style={{ maxWidth: 560, margin: "0 auto" }}>
      <div className="dsv-segmented" style={{ marginBottom: "var(--space-4)" }}>
        {["All", "Deploys", "Members", "Billing"].map((x) => (
          <button key={x} aria-pressed={f === x} onClick={() => setF(x)}>{x}</button>
        ))}
      </div>
      <ul className="dsv-timeline">
        {(f === "All" ? items : items.filter((it) => it[4] === f)).map(([b, w, when, tone]) => (
          <li key={b}>
            <span className="node" style={tone === "success" ? undefined : tone === "danger" ? { background: "var(--color-danger-subtle)", borderColor: "var(--color-danger)" } : tone === "warning" ? { background: "var(--color-warning-subtle)", borderColor: "var(--color-warning)" } : { background: "var(--color-info-subtle)", borderColor: "var(--color-info)" }} />
            <div><div className="body">{b}</div><div className="when">{w} · {when}</div></div>
          </li>
        ))}
      </ul>
      <p className="dsv-muted" style={{ fontSize: "var(--font-size-xs)" }}>Filter: {f} · <a className="dsv-link" href="#screen-activity">view all</a></p>
    </div>
  );
}

// ─────────────────────────────────────────── Data viz (chart theme)
function VizScreen() {
  // tokenUsage: var(--color-chart-1) var(--color-chart-2) var(--color-chart-3) var(--color-chart-4) var(--color-chart-5) var(--color-chart-6) var(--color-chart-7) var(--color-chart-8)
  const bars = [42, 68, 55, 88, 60, 96, 74, 80];
  return (
    <div className="dsv-stack">
      <div className="dsv-inline" style={{ justifyContent: "space-between" }}>
        <h3 style={{ margin: 0, fontSize: "var(--font-size-lg)" }}>Channel mix</h3>
        <span className="dsv-chart-tip">Q2 · all channels</span>
      </div>
      <div className="dsv-card">
        <div className="dsv-inline" style={{ alignItems: "flex-end", gap: "var(--space-2)", height: 150 }}>
          {bars.map((h, i) => (
            <div key={i} title={`${h}%`} style={{ flex: 1, height: `${h}%`, background: `var(--color-chart-${i + 1})`, borderRadius: "var(--radius-sm) var(--radius-sm) 0 0" }} />
          ))}
        </div>
        <div className="dsv-chart-grid" style={{ height: "var(--space-5)" }} />
        <div className="dsv-chart-axis" />
        <div className="dsv-inline" style={{ gap: "var(--space-3)", marginTop: "var(--space-3)", flexWrap: "wrap" }}>
          {["Organic", "Paid", "Referral", "Social", "Email", "Direct", "Partner", "Other"].map((l, i) => (
            <span key={l} className="dsv-inline" style={{ fontSize: "var(--font-size-xs)" }}>
              <span style={{ width: "var(--space-2-5)", height: "var(--space-2-5)", borderRadius: "var(--radius-sm)", background: `var(--color-chart-${i + 1})` }} />{l}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

export const SCREEN_SECTIONS = [
  ["screen-viz", "Data viz", VizScreen, "Chart theme tokens + grid + axis + tooltip."],
  ["screen-files", "Files", FilesScreen, "Storage meter + file rows with sync states."],
  ["screen-activity", "Activity log", ActivityScreen, "Filter + tinted timeline with footer link."],
  ["screen-404", "404 / error", NotFoundScreen, "Display number, muted body, recovery actions."],
  ["screen-marketing", "Marketing hero", MarketingScreen, "Display type, 2xl image, feature grid, CTA."],
  ["screen-onboarding", "Onboarding wizard", OnboardingScreen, "Steps + progress + back/next."],
  ["screen-inbox", "Inbox", InboxScreen, "List + reading pane, selected row, toolbar."],
  ["screen-schedule", "Calendar / schedule", ScheduleScreen, "Sticky sub-nav + week grid with events."],
  ["screen-billing", "Billing / invoice", BillingScreen, "Line-item table, totals, print actions."],
  ["screen-search", "Search results", SearchScreen, "Query bar, facets, results, pagination."],
  ["screen-team", "Team management", TeamScreen, "Avatar group, role table, invite dialog."],
  ["screen-report", "Report / print", ReportScreen, "Serif document layout, no chrome."],
  ["screen-login", "Login", LoginScreen, "Form + checkbox + separator + button variants."],
  ["screen-signup", "Signup", SignupScreen, "Step indicator + form + next/back."],
  ["screen-pricing", "Pricing", PricingScreen, "Monthly/yearly switch + plan cards + badge."],
  ["screen-settings", "Settings", SettingsScreen, "Tabs + switch + select + radio + slider."],
  ["screen-profile", "Profile", ProfileScreen, "Avatar + data list + tag + timeline."],
  ["screen-dashboard", "Dashboard", DashboardScreen, "Stat cards + progress + avatar + hover-card."],
  ["screen-analytics", "Analytics", AnalyticsScreen, "Bar chart + segmented control + data list + table."],
  ["screen-table", "Data table", TableScreen, "Toolbar + search + dialog + row dropdown."],
  ["screen-kanban", "Kanban", KanbanScreen, "Columns + cards + tag + avatar."],
  ["screen-chat", "Chat", ChatScreen, "Chat bubbles + input bar."],
  ["screen-notifications", "Notifications", NotificationsScreen, "Tinted icons + list + timestamp."],
  ["screen-checkout", "Checkout", CheckoutScreen, "Payment form + order summary."],
  ["screen-upload", "File upload", UploadScreen, "Drag-and-drop area + upload progress."],
  ["screen-empty", "Empty state", EmptyStateScreen, "Breadcrumb + empty state + CTA."],
  ["screen-command", "Command palette", CommandPaletteScreen, "Search + grouped command list + kbd."],
].map(([id, label, Body, desc]) => ({
  id, label,
  Comp: () => <Screen id={id} title={label} desc={desc}><Body /></Screen>,
}));
