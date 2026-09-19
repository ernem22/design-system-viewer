import { forwardRef, type ComponentPropsWithoutRef, type ComponentRef, type ReactNode } from "react";

export interface IconActionButtonProps extends ComponentPropsWithoutRef<"button"> {
  icon: ReactNode;
  label: string;
}

/** Topbar icon button for a one-off action (vs. IconToggleButton's on/off
   panel state, which needs Radix's Toggle to compute aria-pressed/data-state).
   A plain action button has no such computed state for Radix to provide, so
   there's nothing for a Slot to merge — a native <button> covers it fully. */
const IconActionButton = forwardRef<ComponentRef<"button">, IconActionButtonProps>(
  ({ icon, label, className, ...props }, ref) => {
    return (
      <button
        ref={ref}
        type="button"
        className={["app-iconbtn", className].filter(Boolean).join(" ")}
        title={label}
        aria-label={label}
        {...props}
      >
        {icon}
      </button>
    );
  },
);
IconActionButton.displayName = "IconActionButton";

export default IconActionButton;
