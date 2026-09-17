import { useState } from "react";
import * as RadioGroup from "@radix-ui/react-radio-group";
import * as Select from "@radix-ui/react-select";
import * as Slider from "@radix-ui/react-slider";
import * as Switch from "@radix-ui/react-switch";
import * as Tabs from "@radix-ui/react-tabs";
import * as Separator from "@radix-ui/react-separator";
import type { ReactNode } from "react";
import { Button } from "../../ui.tsx";
import { Icon } from "../../../lib/icons.tsx";
import "./screens.css";

function SettingRow({ title, desc, children }: { title: string; desc: string; children: ReactNode }) {
  return (
    <div className="dsv-setting-row">
      <div>
        <div style={{ fontSize: "var(--font-size-sm)", fontWeight: "var(--font-weight-medium)" }}>
          {title}
        </div>
        <div className="dsv-muted" style={{ fontSize: "var(--font-size-xs)" }}>
          {desc}
        </div>
      </div>
      {children}
    </div>
  );
}

const LANGUAGES: [string, string][] = [
  ["tr", "Turkish"],
  ["en", "English"],
  ["de", "German"],
];

export default function SettingsBody() {
  const [vol, setVol] = useState([60]);
  const [density, setDensity] = useState("comfortable");
  const [notif, setNotif] = useState({ email: true, push: true, digest: false });
  const [theme, setTheme] = useState("system");
  return (
    <div style={{ maxWidth: 560, margin: "0 auto" }}>
      <div className="dsv-card">
        <Tabs.Root defaultValue="general">
          <Tabs.List className="dsv-tabs-list">
            <Tabs.Trigger className="dsv-tabs-trigger" value="general">
              General
            </Tabs.Trigger>
            <Tabs.Trigger className="dsv-tabs-trigger" value="notif">
              Notifications
            </Tabs.Trigger>
            <Tabs.Trigger className="dsv-tabs-trigger" value="appear">
              Appearance
            </Tabs.Trigger>
          </Tabs.List>
          <Tabs.Content className="dsv-tabs-content" value="general">
            <div className="dsv-stack" style={{ color: "var(--color-text)" }}>
              <SettingRow title="Auto save" desc="Save instantly">
                <Switch.Root className="dsv-switch" defaultChecked>
                  <Switch.Thumb className="dsv-switch-thumb" />
                </Switch.Root>
              </SettingRow>
              <Separator.Root className="dsv-sep" />
              <SettingRow title="Language" desc="Interface language">
                <Select.Root defaultValue="tr">
                  <Select.Trigger className="dsv-select-trigger" aria-label="Language">
                    <Select.Value />
                    <Select.Icon>
                      <Icon name="chevronDown" size={14} />
                    </Select.Icon>
                  </Select.Trigger>
                  <Select.Portal>
                    <Select.Content className="dsv-select-content" position="popper" sideOffset={6}>
                      <Select.Viewport>
                        {LANGUAGES.map(([v, l]) => (
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
              </SettingRow>
              <Separator.Root className="dsv-sep" />
              <SettingRow title="Density" desc="Line spacing">
                <RadioGroup.Root className="dsv-inline" value={density} onValueChange={setDensity}>
                  {["compact", "comfortable"].map((v) => (
                    <label key={v} className="dsv-control-label">
                      <RadioGroup.Item className="dsv-radio" value={v}>
                        <RadioGroup.Indicator className="dsv-radio-indicator" />
                      </RadioGroup.Item>
                      {v}
                    </label>
                  ))}
                </RadioGroup.Root>
              </SettingRow>
              <Separator.Root className="dsv-sep" />
              <SettingRow title="Volume" desc={`${vol[0]}%`}>
                <Slider.Root className="dsv-slider" value={vol} onValueChange={setVol} max={100}>
                  <Slider.Track className="dsv-slider-track">
                    <Slider.Range className="dsv-slider-range" />
                  </Slider.Track>
                  <Slider.Thumb className="dsv-slider-thumb" aria-label="Volume" />
                </Slider.Root>
              </SettingRow>
              <Separator.Root className="dsv-sep" />
              <SettingRow title="Delete workspace" desc="Permanent, cannot be undone">
                <Button variant="danger" size="sm">
                  Delete…
                </Button>
              </SettingRow>
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: "var(--space-3)",
                marginTop: "var(--space-6)",
              }}
            >
              <Button variant="ghost">Reset</Button>
              <Button>Save</Button>
            </div>
          </Tabs.Content>
          <Tabs.Content className="dsv-tabs-content" value="notif">
            <div className="dsv-stack" style={{ color: "var(--color-text)" }}>
              <SettingRow title="Email alerts" desc="Build results and invoices">
                <Switch.Root
                  className="dsv-switch"
                  checked={notif.email}
                  onCheckedChange={(v) => setNotif((n) => ({ ...n, email: v }))}
                >
                  <Switch.Thumb className="dsv-switch-thumb" />
                </Switch.Root>
              </SettingRow>
              <Separator.Root className="dsv-sep" />
              <SettingRow title="Push notifications" desc="Mentions and comments">
                <Switch.Root
                  className="dsv-switch"
                  checked={notif.push}
                  onCheckedChange={(v) => setNotif((n) => ({ ...n, push: v }))}
                >
                  <Switch.Thumb className="dsv-switch-thumb" />
                </Switch.Root>
              </SettingRow>
              <Separator.Root className="dsv-sep" />
              <SettingRow title="Weekly digest" desc="Summary every Monday">
                <Switch.Root
                  className="dsv-switch"
                  checked={notif.digest}
                  onCheckedChange={(v) => setNotif((n) => ({ ...n, digest: v }))}
                >
                  <Switch.Thumb className="dsv-switch-thumb" />
                </Switch.Root>
              </SettingRow>
              <p className="dsv-muted" style={{ fontSize: "var(--font-size-xs)" }}>
                {notif.email || notif.push
                  ? "At least one channel is on."
                  : "All channels off — you will miss updates."}
              </p>
            </div>
          </Tabs.Content>
          <Tabs.Content className="dsv-tabs-content" value="appear">
            <div className="dsv-stack" style={{ color: "var(--color-text)" }}>
              <SettingRow title="Theme" desc="Follows the system's dark variant">
                <RadioGroup.Root className="dsv-inline" value={theme} onValueChange={setTheme}>
                  {["light", "dark", "system"].map((v) => (
                    <label key={v} className="dsv-control-label">
                      <RadioGroup.Item className="dsv-radio" value={v}>
                        <RadioGroup.Indicator className="dsv-radio-indicator" />
                      </RadioGroup.Item>
                      {v}
                    </label>
                  ))}
                </RadioGroup.Root>
              </SettingRow>
              <Separator.Root className="dsv-sep" />
              <SettingRow title="Motion" desc="Reduce animations">
                <Switch.Root className="dsv-switch">
                  <Switch.Thumb className="dsv-switch-thumb" />
                </Switch.Root>
              </SettingRow>
              <p className="dsv-muted" style={{ fontSize: "var(--font-size-xs)" }}>
                Type scale and color settings follow the active design system's tokens.
              </p>
            </div>
          </Tabs.Content>
        </Tabs.Root>
      </div>
    </div>
  );
}
