import { useEffect, useRef, useState } from "react";

const isCssFile = (f: File) => /\.css$/i.test(f.name);

/** Text of a picked/dropped stylesheet; rejects anything but .css (legacy
   parity — a JSON or image drop would parse to zero tokens anyway). */
export async function readCssFile(file: File): Promise<string> {
  if (!isCssFile(file)) throw new Error("Only .css files");
  return file.text();
}

const CORS_ERROR = "blocked (the URL must allow cross-origin requests)";
const PROXY_PATH = "/api/fetch-css";

/** Direct fetch — the only option on the static build. A rejected fetch is a
   CORS/network failure; a reachable host's non-2xx keeps its real status
   rather than being flattened into the CORS message. */
async function fetchDirect(url: string): Promise<string> {
  let res: Response;
  try {
    res = await fetch(url);
  } catch {
    throw new Error(CORS_ERROR);
  }
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`.trim());
  return res.text();
}

/** The dev server's /api/fetch-css route, which has no origin restrictions
   (legacy parity — src/viewer/app.js:1010). Returns null when there is no
   proxy behind the app; throws when the proxy itself reports a failure.

   A static/SPA host answers the unknown path with its index.html (200,
   text/html) or an HTML 404, and a fetch with no server at all rejects — those
   are the only cases that fall back to the direct fetch. A JSON non-2xx is the
   route answering with a real upstream status (`502 upstream 404`, `400
   invalid url`); surfacing that beats retrying direct, which would replace the
   status with a misleading CORS "blocked". */
async function fetchProxied(url: string): Promise<string | null> {
  let res: Response;
  try {
    res = await fetch(`${PROXY_PATH}?url=${encodeURIComponent(url)}`);
  } catch {
    return null;
  }
  const type = res.headers.get("content-type") ?? "";
  if (res.ok) return type.includes("text/html") ? null : res.text();
  if (!type.includes("application/json")) return null;
  const body = (await res.json().catch(() => null)) as { error?: string } | null;
  throw new Error(body?.error || `${res.status} ${res.statusText}`.trim());
}

/** Legacy parity (src/viewer/app.js fetchCss): most stylesheet hosts send no
   ACAO header, so a direct request dies with "Failed to fetch". Try the dev
   server proxy first; with no server behind the app (the static build) that
   attempt is a no-op and the direct fetch the app has today is the fallback.
   If both fail, the direct fetch's message is the one shown. */
export async function fetchCss(url: string): Promise<string> {
  const proxied = await fetchProxied(url);
  return proxied ?? fetchDirect(url);
}

/** Page-wide .css drag & drop. Returns whether a file drag is over the page
   (for the overlay); `onFile` gets the first .css file of a drop. */
export function useCssFileDrop(onFile: (file: File | null) => void): boolean {
  const [dragging, setDragging] = useState(false);
  const onFileRef = useRef(onFile);
  useEffect(() => {
    onFileRef.current = onFile;
  });

  useEffect(() => {
    // dragenter/leave fire for every child crossed — count depth instead of
    // toggling, or the overlay flickers.
    let depth = 0;
    const hasFiles = (e: DragEvent) => !!e.dataTransfer && [...e.dataTransfer.types].includes("Files");
    const enter = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      depth++;
      setDragging(true);
    };
    const leave = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      depth = Math.max(0, depth - 1);
      if (!depth) setDragging(false);
    };
    const over = (e: DragEvent) => {
      if (hasFiles(e)) e.preventDefault();
    };
    const drop = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth = 0;
      setDragging(false);
      const file = [...(e.dataTransfer?.files ?? [])].find(isCssFile) ?? null;
      onFileRef.current(file);
    };
    document.addEventListener("dragenter", enter);
    document.addEventListener("dragleave", leave);
    document.addEventListener("dragover", over);
    document.addEventListener("drop", drop);
    return () => {
      document.removeEventListener("dragenter", enter);
      document.removeEventListener("dragleave", leave);
      document.removeEventListener("dragover", over);
      document.removeEventListener("drop", drop);
    };
  }, []);

  return dragging;
}
