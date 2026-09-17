import { useRef, useState } from "react";
import { fetchCss, readCssFile } from "../lib/cssImport.ts";
import type { PushToast } from "../lib/toasts.ts";

/**
 * The add/merge dialogs' alternate sources (legacy URL + File tabs): pick a
 * .css file or fetch one from a URL into the paste box for review before
 * saving — nothing is written until the dialog's own Save.
 */
export function CssSourceBar({ onLoad, onToast }: { onLoad: (css: string) => void; onToast: PushToast }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);

  const fetchUrl = async () => {
    const target = url.trim();
    if (!target) {
      onToast("Enter a stylesheet URL", "err");
      return;
    }
    setBusy(true);
    try {
      onLoad(await fetchCss(target));
      onToast("CSS fetched", "ok");
    } catch (e) {
      onToast(`Fetch failed: ${e instanceof Error ? e.message : String(e)}`, "err");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="tok-dialog-row tok-source">
      <button type="button" className="tok-btn" onClick={() => fileRef.current?.click()}>
        Upload .css
      </button>
      <input
        ref={fileRef}
        type="file"
        accept=".css,text/css"
        hidden
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file) return;
          try {
            onLoad(await readCssFile(file));
            onToast("File loaded — review, then save", "ok");
          } catch (err) {
            onToast(err instanceof Error ? err.message : String(err), "err");
          }
        }}
      />
      <input
        className="tok-input tok-source-url"
        type="url"
        value={url}
        placeholder="https://…/tokens.css"
        aria-label="Stylesheet URL"
        onChange={(e) => setUrl(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            void fetchUrl();
          }
        }}
      />
      <button type="button" className="tok-btn" disabled={busy} onClick={() => void fetchUrl()}>
        {busy ? "…" : "Fetch"}
      </button>
    </div>
  );
}
