import type { ReactNode } from "react";
import * as Toggle from "@radix-ui/react-toggle";

export interface IconToggleButtonProps {
  pressed: boolean;
  onPressedChange: (pressed: boolean) => void;
  icon: ReactNode;
  labelWhenOn: string;
  labelWhenOff: string;
}

/** Topbar icon button that shows/hides a panel (Rail/Props). A Radix Toggle
   instead of a hand-rolled `<button data-active>` — pressed state,
   `aria-pressed` and `data-state` all come from Radix, not duplicated at
   each call site. */
export default function IconToggleButton({ pressed, onPressedChange, icon, labelWhenOn, labelWhenOff }: IconToggleButtonProps) {
  const label = pressed ? labelWhenOn : labelWhenOff;
  return (
    <Toggle.Root className="app-iconbtn" pressed={pressed} onPressedChange={onPressedChange} title={label} aria-label={label}>
      {icon}
    </Toggle.Root>
  );
}
