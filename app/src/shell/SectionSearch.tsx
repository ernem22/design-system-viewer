import { useRef } from "react";
import { Icon } from "../lib/icons.tsx";

export interface SectionSearchProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  ariaLabel?: string;
  /** Form name for the input (autofill/name hygiene, issue #224). */
  name?: string;
}

/** Narrows the rail's visible rows by label (see Rail's `searching` prop —
    the caller filters, Rail just renders the groups it is handed). Search
    lives in the rail frame, not the topbar. Escape clears the query and is
    consumed here so it never reaches a layout-level keydown. */
export function SectionSearch({
  value,
  onChange,
  placeholder = "Search components...",
  ariaLabel = "Search components",
  name,
}: SectionSearchProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div className="app-rail-search">
      <Icon name="search" size={14} />
      <input
        ref={inputRef}
        type="search"
        name={name}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.preventDefault();
            onChange("");
          }
        }}
        placeholder={placeholder}
        aria-label={ariaLabel}
        autoComplete="off"
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
