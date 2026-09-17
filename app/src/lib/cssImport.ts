import { useEffect, useRef, useState } from "react";

const isCssFile = (f: File) => /\.css$/i.test(f.name);

/** Text of a picked/dropped stylesheet; rejects anything but .css (legacy
   parity — a JSON or image drop would parse to zero tokens anyway). */
export async function readCssFile(file: File): Promise<string> {
  if (!isCssFile(file)) throw new Error("Only .css files");
  return file.text();
}

/** Direct fetch — there is no proxy server behind this app, so it only
   works for CORS-enabled stylesheet URLs; the error says so. */
export async function fetchCss(url: string): Promise<string> {
  let res: Response;
  try {
    res = await fetch(url);
  } catch {
    throw new Error("blocked (the URL must allow cross-origin requests)");
  }
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`.trim());
  return res.text();
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
