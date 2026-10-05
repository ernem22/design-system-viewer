// Preview tab's rail systems section: the single-select list of which design
// system the gallery below is rendered against. It supplements the topbar
// SystemSwitcher — both read and write the same activeSlug from useSystems()
// (lifted in App.tsx), so the two controls can never drift apart. Rendered
// alongside <Rail> in the Preview tab's rail slot; Tokens and Compare tabs
// keep their own rail content untouched.
import * as Accordion from "@radix-ui/react-accordion";
import { Icon } from "../lib/icons.tsx";
import type { DesignSystem } from "../systems/store.ts";

interface PreviewSystemsProps {
  systems: DesignSystem[];
  activeSlug: string;
  onSelect: (slug: string) => void;
}

export function PreviewSystems({ systems, activeSlug, onSelect }: PreviewSystemsProps) {
  // No systems yet (first boot / all deleted) — the Preview content shows the
  // Welcome empty state, so there is nothing to pick here either.
  if (systems.length === 0) return null;
  return (
    <Accordion.Root type="multiple" defaultValue={["preview-systems"]}>
      <Accordion.Item value="preview-systems" className="app-rail-group">
        <Accordion.Header>
          <Accordion.Trigger className="app-rail-group-label">
            <Icon name="chevronDown" size={11} className="app-rail-group-chevron" />
            <span>Systems</span>
            <span className="app-rail-count">{systems.length}</span>
          </Accordion.Trigger>
        </Accordion.Header>
        <Accordion.Content className="app-rail-group-items">
          {systems.map((s) => (
            <button
              key={s.slug}
              type="button"
              className="app-rail-link"
              aria-current={s.slug === activeSlug ? "true" : undefined}
              onClick={() => onSelect(s.slug)}
            >
              {s.name}
            </button>
          ))}
        </Accordion.Content>
      </Accordion.Item>
    </Accordion.Root>
  );
}
