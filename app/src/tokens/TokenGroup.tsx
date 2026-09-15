import { memo } from "react";
import type { Token, TokenGroup as TokenGroupData } from "../systems/store.ts";
import {
  BarRow,
  BreakpointRow,
  ColorGrid,
  EasingRow,
  FontFamilyRow,
  FontWeightRow,
  LetterSpacingRow,
  LineHeightRow,
  MotionRow,
  NumberRow,
  OpacityRow,
  RadiusRow,
  RawTable,
  ShadowRow,
  TypeRow,
  type RowCallbacks,
} from "./rows.tsx";
import { groupAnchor, type VisibleGroup } from "./useTokensView.ts";
import "./TokenGroup.css";

/**
 * One token category: heading + the renderer the old renderGroup dispatch
 * picked by g.id with a kind fallback (app.js:487-503, kept 1:1) + the
 * per-group missing row when showMissing is on.
 */
export const TokenGroup = memo(function TokenGroup({
  visible,
  showMissing,
  selectedName,
  onPick,
}: {
  visible: VisibleGroup;
  showMissing: boolean;
} & RowCallbacks) {
  const { group, tokens, missing } = visible;
  return (
    <section className="tok-group" id={groupAnchor(group.id)}>
      <h2>
        {group.label}
        <span>{tokens.length}</span>
      </h2>
      <GroupBody group={group} tokens={tokens} selectedName={selectedName} onPick={onPick} />
      {showMissing && missing.length > 0 && (
        <div className="tok-missing">
          missing ({missing.length}): {missing.map((n) => <code key={n}>{n}</code>)}
        </div>
      )}
    </section>
  );
});

function GroupBody({
  group,
  tokens,
  selectedName,
  onPick,
}: {
  group: TokenGroupData;
  tokens: Token[];
} & RowCallbacks) {
  const cb = { selectedName, onPick };
  const { id, kind } = group;
  if (kind === "color" || id === "gradient") return <ColorGrid tokens={tokens} {...cb} />;
  if (id === "font-size" || id === "font-display") return <TypeRow tokens={tokens} {...cb} />;
  if (id === "font-family") return <FontFamilyRow tokens={tokens} {...cb} />;
  if (id === "font-weight") return <FontWeightRow tokens={tokens} {...cb} />;
  if (id === "line-height") return <LineHeightRow tokens={tokens} {...cb} />;
  if (id === "letter-spacing") return <LetterSpacingRow tokens={tokens} {...cb} />;
  if (
    id === "spacing" ||
    id === "size" ||
    id === "blur" ||
    id === "border-width" ||
    id === "text-measure" ||
    id === "section-spacing" ||
    id === "control-geometry" ||
    id === "motion-distance"
  )
    return <BarRow tokens={tokens} {...cb} />;
  if (id === "radius") return <RadiusRow tokens={tokens} {...cb} />;
  if (kind === "shadow") return <ShadowRow tokens={tokens} {...cb} />;
  if (id === "duration") return <MotionRow tokens={tokens} {...cb} />;
  if (id === "easing") return <EasingRow tokens={tokens} {...cb} />;
  if (id === "opacity") return <OpacityRow tokens={tokens} {...cb} />;
  if (id === "z-index") return <NumberRow tokens={tokens} {...cb} />;
  if (id === "breakpoint") return <BreakpointRow tokens={tokens} {...cb} />;
  return <RawTable tokens={tokens} {...cb} />;
}
