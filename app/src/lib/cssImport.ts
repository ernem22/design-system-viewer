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

/** Client-side budget for the whole proxy attempt — headers and body. The
    dev-server route gives up on the upstream host after 15s and answers with a
    JSON `502` (src/server/server.js:107), so 20s leaves the route room to answer
    a genuinely slow but valid stylesheet before we abort. The budget therefore
    can never clip a legitimate response; it only catches a connection that
    never answers, where falling back to the direct fetch is the correct move. */
export const PROXY_TIMEOUT_MS = 20_000;

/** Thrown by fetchProxied when the route answered and the answer is a real
    failure (a JSON 4xx/5xx, or a non-JSON 5xx). Distinguishes "the proxy is
    here and broke" — which must surface — from a network rejection or timeout,
    which falls back to the direct fetch. */
class ProxyFailure extends Error {}

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
   proxy behind the app (so fetchCss falls back to the direct fetch); throws a
   ProxyFailure when the route answered with a real failure.

   Response -> decision, matching the code below:
   - reject / abort (timeout) -> no proxy, fall back.
   - 2xx text/html -> the SPA index.html a static host serves for unknown paths,
     not a stylesheet: no proxy, fall back.
   - 2xx other -> the stylesheet, use it.
   - 404 (JSON or HTML) -> the path does not exist on this host (dev server
     without the route, static host's own 404): no proxy, fall back.
   - JSON 4xx other than 404 (`400 invalid url`) -> the route's own rejection:
     surface it.
   - JSON 5xx (`502 upstream 404`) -> the route's upstream status: surface it.
   - non-JSON 5xx -> the proxy is present but broken: surface it (retrying
     direct would show a CORS-less host the misleading "blocked" message).
   - non-JSON 4xx other than 404 -> not the route: no proxy, fall back. */
async function fetchProxied(url: string): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROXY_TIMEOUT_MS);
  try {
    const res = await fetch(`${PROXY_PATH}?url=${encodeURIComponent(url)}`, {
      signal: controller.signal,
    });
    const type = res.headers.get("content-type") ?? "";

    if (res.ok) return type.includes("text/html") ? null : res.text();
    if (res.status === 404) return null;

    if (type.includes("application/json")) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      throw new ProxyFailure(body?.error || `${res.status} ${res.statusText}`.trim());
    }
    if (res.status >= 500) {
      throw new ProxyFailure(`proxy error: ${res.status} ${res.statusText}`.trim());
    }
    return null;
  } catch (err) {
    // Abort (our timeout) and network rejection both mean the proxy never
    // answered; a ProxyFailure is the route answering and must propagate.
    if (err instanceof ProxyFailure) throw err;
    return null;
  } finally {
    clearTimeout(timer);
  }
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
