import { useState } from "react";
import * as Checkbox from "@radix-ui/react-checkbox";
import * as RadioGroup from "@radix-ui/react-radio-group";
import * as Select from "@radix-ui/react-select";
import * as Slider from "@radix-ui/react-slider";
import * as Switch from "@radix-ui/react-switch";
import { Toggle } from "@radix-ui/react-toggle";
import * as ToggleGroup from "@radix-ui/react-toggle-group";
import { Button, Demo, Field, usePortalContainer } from "../ui.tsx";
import { Icon } from "../../lib/icons.tsx";
import "./forms.css";

interface LanguageOption {
  value: string;
  label: string;
}

const LANGUAGES: LanguageOption[] = [
  { value: "tr", label: "Turkish" },
  { value: "en", label: "English" },
  { value: "de", label: "German" },
  { value: "fr", label: "French" },
];

const RADIO_VALUES = ["compact", "comfortable", "spacious"];

export default function FormsBody() {
  const [checked, setChecked] = useState<Checkbox.CheckedState>(true);
  const [indeterminate, setIndeterminate] = useState<Checkbox.CheckedState>("indeterminate");
  const [radio, setRadio] = useState("comfortable");
  const [switchOn, setSwitchOn] = useState(true);
  const [slider, setSlider] = useState([40]);
  const [range, setRange] = useState([25, 75]);
  const portalContainer = usePortalContainer();

  return (
    <>
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
        <Button className="dsv-icon-btn" aria-label="Add">
          <Icon name="plus" />
        </Button>
      </Demo>
      <Demo title="Button — icons & loading">
        <Button>
          <Icon name="plus" size={14} /> New project
        </Button>
        <Button variant="outline">
          Next <Icon name="chevronRight" size={14} />
        </Button>
        <Button disabled>
          <span className="dsv-spinner dsv-spinner--sm" /> Saving…
        </Button>
        <Button variant="soft" disabled>
          <span className="dsv-spinner dsv-spinner--sm" /> Loading
        </Button>
      </Demo>

      <Demo title="Input / Textarea">
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
            <span className="dsv-adorn dsv-adorn--prefix">
              <Icon name="search" size={14} />
            </span>
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
        <div className="dsv-disabled-box">
          <div className="dsv-inline">
            <Icon name="x" size={14} /> Unavailable
          </div>
          <div className="dsv-disabled-box-note">surface + border + icon tokens</div>
        </div>
        <div className="dsv-disabled-box dsv-disabled-box--dim">
          <div className="dsv-inline">
            <Icon name="x" size={14} /> Dimmed (--opacity-disabled)
          </div>
          <div className="dsv-disabled-box-note">same box at --opacity-disabled</div>
        </div>
      </Demo>

      <Demo title="Checkbox">
        <label className="dsv-control-label">
          <Checkbox.Root className="dsv-check" checked={checked} onCheckedChange={setChecked}>
            <Checkbox.Indicator>
              <Icon name="check" size={14} />
            </Checkbox.Indicator>
          </Checkbox.Root>
          Subscribe to newsletter
        </label>
        <label className="dsv-control-label">
          <Checkbox.Root className="dsv-check" checked={indeterminate} onCheckedChange={setIndeterminate}>
            <Checkbox.Indicator>
              {indeterminate === "indeterminate" ? <Icon name="minus" size={14} /> : <Icon name="check" size={14} />}
            </Checkbox.Indicator>
          </Checkbox.Root>
          Indeterminate state
        </label>
        <label className="dsv-control-label dsv-control-label--disabled">
          <Checkbox.Root className="dsv-check" disabled>
            <Checkbox.Indicator>
              <Icon name="check" size={14} />
            </Checkbox.Indicator>
          </Checkbox.Root>
          Disabled
        </label>
      </Demo>

      <Demo title="Radio Group">
        <RadioGroup.Root className="dsv-stack" value={radio} onValueChange={setRadio}>
          {RADIO_VALUES.map((v) => (
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
          <Switch.Root className="dsv-switch" checked={switchOn} onCheckedChange={setSwitchOn}>
            <Switch.Thumb className="dsv-switch-thumb" />
          </Switch.Root>
          Auto save
        </label>
        <label className="dsv-control-label dsv-control-label--disabled">
          <Switch.Root className="dsv-switch" disabled>
            <Switch.Thumb className="dsv-switch-thumb" />
          </Switch.Root>
          Disabled
        </label>
      </Demo>

      <Demo title="Slider">
        <Slider.Root className="dsv-slider" value={slider} onValueChange={setSlider} max={100} step={1}>
          <Slider.Track className="dsv-slider-track">
            <Slider.Range className="dsv-slider-range" />
          </Slider.Track>
          <Slider.Thumb className="dsv-slider-thumb" aria-label="Value" />
        </Slider.Root>
        <span className="dsv-mono dsv-muted">{slider[0]}</span>
        <Slider.Root className="dsv-slider" value={range} onValueChange={setRange} max={100} step={1}>
          <Slider.Track className="dsv-slider-track">
            <Slider.Range className="dsv-slider-range" />
          </Slider.Track>
          <Slider.Thumb className="dsv-slider-thumb" aria-label="Low" />
          <Slider.Thumb className="dsv-slider-thumb" aria-label="High" />
        </Slider.Root>
        <span className="dsv-mono dsv-muted">{range.join("–")}</span>
      </Demo>

      <Demo title="Select">
        <Select.Root defaultValue="tr">
          <Select.Trigger className="dsv-select-trigger" aria-label="Language">
            <Select.Value />
            <Select.Icon>
              <Icon name="chevronDown" size={14} />
            </Select.Icon>
          </Select.Trigger>
          <Select.Portal container={portalContainer}>
            <Select.Content className="dsv-select-content" position="popper" sideOffset={6}>
              <Select.Viewport>
                <Select.Group>
                  <Select.Label className="dsv-select-label">Languages</Select.Label>
                  {LANGUAGES.map((lang) => (
                    <Select.Item key={lang.value} value={lang.value} className="dsv-select-item">
                      <Select.ItemIndicator className="dsv-select-item-indicator">
                        <Icon name="check" size={14} />
                      </Select.ItemIndicator>
                      <Select.ItemText>{lang.label}</Select.ItemText>
                    </Select.Item>
                  ))}
                </Select.Group>
              </Select.Viewport>
            </Select.Content>
          </Select.Portal>
        </Select.Root>
      </Demo>

      <Demo title="Toggle / Toggle Group">
        <Toggle className="dsv-toggle" aria-label="Bold">
          <Icon name="bold" size={14} />
        </Toggle>
        <ToggleGroup.Root className="dsv-toggle-group" type="single" defaultValue="center" aria-label="Align">
          <ToggleGroup.Item className="dsv-toggle" value="left">
            <Icon name="alignLeft" size={14} />
          </ToggleGroup.Item>
          <ToggleGroup.Item className="dsv-toggle" value="center">
            <Icon name="alignCenter" size={14} />
          </ToggleGroup.Item>
          <ToggleGroup.Item className="dsv-toggle" value="right">
            <Icon name="alignRight" size={14} />
          </ToggleGroup.Item>
        </ToggleGroup.Root>
      </Demo>
    </>
  );
}
