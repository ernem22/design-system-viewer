import { useRef } from "react";
import { Icon } from "../lib/icons.tsx";

export interface SectionSearchProps {
  value: string;
  onChange: (value: string) => void;
}

/** Narrows the Rail's visible links by label (see Rail's `searching` prop —
   the caller filters, Rail just force-opens every group that survives).
   Native input, not Radix — nothing here needs a primitive. */
export function SectionSearch({ value, onChange }: SectionSearchProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div className="app-topbar-search">
      <Icon name="search" size={14} />
      <input
        ref={inputRef}
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search components…"
        aria-label="Search components"
      />
      {value && (
        <button
          type="button"
          onClick={() => {
            onChange("");
            inputRef.current?.focus();
          }}
          aria-label="Clear search"
        >
          <Icon name="x" size={13} />
        </button>
      )}
    </div>
  );
}
