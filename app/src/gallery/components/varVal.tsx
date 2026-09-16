import { useEffect, useRef, useState } from "react";

// Read-only computed token value badge — ported from preview/src/extras.jsx.
// Unlike preview's live token-editing machinery (SwapPicker/ValueEditor/…,
// explicitly out of scope for this gallery port), this only reads: it shows
// the active system's resolved value (480px, 20ch…) next to demos that would
// otherwise name a token with no visible effect. Reads its own computed
// style (not document.documentElement): custom properties inherit down the
// DOM, so this resolves correctly wherever the tokens live.
export function VarVal({ name }: { name: string }) {
  const ref = useRef<HTMLElement>(null);
  const [val, setVal] = useState("");
  useEffect(() => {
    try {
      const el = ref.current;
      setVal(el ? getComputedStyle(el).getPropertyValue(name).trim() : "");
    } catch {
      setVal("");
    }
  }, [name]);
  if (!val) return <code ref={ref} className="dsv-code-inline" hidden />;
  return (
    <code ref={ref} className="dsv-code-inline">
      {val}
    </code>
  );
}
