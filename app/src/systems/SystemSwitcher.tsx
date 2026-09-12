import type { DesignSystem } from "./store.ts";

interface SystemSwitcherProps {
  systems: DesignSystem[];
  activeSlug: string;
  onSelect: (slug: string) => void;
}

/** Header system switcher — native select, no Radix. Fancy menu comes later. */
export default function SystemSwitcher({ systems, activeSlug, onSelect }: SystemSwitcherProps) {
  if (systems.length === 0) return null;
  return (
    <label className="app-sysbtn">
      <span className="app-sysbtn-label">System</span>
      <select
        aria-label="Active design system"
        value={activeSlug}
        onChange={(e) => onSelect(e.target.value)}
      >
        {systems.map((s) => (
          <option key={s.slug} value={s.slug}>
            {s.name}
          </option>
        ))}
      </select>
    </label>
  );
}
