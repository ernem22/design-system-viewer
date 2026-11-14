import { systemCoveragePercent } from "../systems/store.ts";
import { REFERENCE_TOKEN_COUNT } from "../../../src/core/schema.js";
import type { CompareViewModel } from "./useCompareView.ts";

/** Compare tab's right rail: a read-only *reference* summary, not a second
   selection surface and not a third copy of the picked-system list. The rail
   already owns the selected set (removable chips) and the catalogue; the
   content header owns the system count. This panel adds the one fact those
   surfaces do not state together: which system is the baseline and what
   "changed" means against it. */
export function CompareProps({ view }: { view: CompareViewModel }) {
  const { cols } = view;
  const reference = cols[0];
  const pct = reference ? systemCoveragePercent(reference) : null;

  return (
    <div className="cmp-props">
      <div className="cmp-props-block">
        <h3>Reference</h3>
        {reference ? (
          <div className="cmp-props-reference">
            <p className="cmp-props-ref-name">{reference.name}</p>
            {pct != null && pct < 100 && (
              <span
                className="cmp-props-pct"
                title={`${pct}% of the ${REFERENCE_TOKEN_COUNT} schema tokens`}
                aria-label={`${pct}% of ${REFERENCE_TOKEN_COUNT} schema tokens`}
              >
                {pct}%
              </span>
            )}
            <p className="cmp-props-note">
              Every column and diff cell is compared against this system. In Token diff, only
              values that differ from it are marked changed.
            </p>
          </div>
        ) : (
          <p className="cmp-props-empty">Select systems in the rail to compare them.</p>
        )}
      </div>
    </div>
  );
}
