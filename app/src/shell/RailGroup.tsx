import type { ReactNode } from "react";
import * as Accordion from "@radix-ui/react-accordion";
import { Icon } from "../lib/icons.tsx";

export interface RailGroupProps {
  /** Accordion item value — the group label for Rail, "systems" or the option-group label for Compare. */
  value: string;
  /** Visible group heading. */
  label: ReactNode;
  /** Pill count beside the heading. */
  count: ReactNode;
  /** Group body: links for Rail, chips or picker buttons for Compare. */
  children: ReactNode;
  /** Content wrapper class. Rail and Compare option groups use
      "app-rail-group-items"; omit it for a bare Accordion.Content (Compare's
      systems group wraps its own .cmp-rail-systems div). */
  contentClassName?: string;
}

/** Shared rail accordion group shell (issue #17): the label + chevron + count
    header both Rail and CompareRail hand-built before. Presentational only —
    scrollspy tracking and the sliding indicator stay in Rail, picker semantics
    stay in CompareRail. */
export function RailGroup({ value, label, count, children, contentClassName }: RailGroupProps) {
  return (
    <Accordion.Item value={value} className="app-rail-group">
      <Accordion.Header>
        <Accordion.Trigger className="app-rail-group-label">
          <Icon name="chevronDown" size={11} className="app-rail-group-chevron" />
          <span>{label}</span>
          <span className="app-rail-count">{count}</span>
        </Accordion.Trigger>
      </Accordion.Header>
      <Accordion.Content className={contentClassName}>{children}</Accordion.Content>
    </Accordion.Item>
  );
}
