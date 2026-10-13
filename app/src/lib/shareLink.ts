// Shared-system link payload (issue #337) — encode and decode.
//
// A copied view link carries no system data on its own (urlState's params
// describe which system, not what is in it), and a recipient has only the
// bundled catalogue: a link to a sender-added or edited system opens on some
// other system, or on nothing. This module embeds the active system's tokens
// in the link as one `s` param: the CSS is minified, serialised as
// `{ v: 1, n: name, c: css }`, compressed with the browser's
// `CompressionStream("deflate-raw")`, and emitted as unpadded base64url.
// No new dependencies. Both directions are async (the platform streams are).

import { parseTokens } from "../../../src/core/parse.js";

export interface SharedSystemInput {
  name: string;
  css: string;
}

export interface SharedToken {
  name: string;
  value: string;
}

export interface DecodedSharedSystem {
  name: string;
  /** Sanitised stylesheet rebuilt from the kept tokens only — never the raw
      string. Apply or store this, never the payload's `c` field. */
  css: string;
  tokens: SharedToken[];
  /** Tokens refused for an unsafe value (url(, @import, expression(,
      javascript:). Reported in the banner. */
  dropped: number;
}

/** Copy path refuses to embed a payload past this many characters and falls
    back to a system-less link instead. perp-ultra-v2 (the largest bundled
    system) encodes to ~4.6k chars, comfortably inside. */
export const SHARE_EMBED_LIMIT = 7000;

/** Decode refuses input past this many characters, or inflating past 200 KB
    (decompression-bomb guard), before even looking at the JSON. */
const MAX_INPUT_CHARS = 20000;
const MAX_OUTPUT_BYTES = 200 * 1024;

/** Values that must never reach a live stylesheet or the network log:
    remote fetches, stylesheet imports, and script vectors. Case-insensitive,
    matched against the parsed value (not the raw payload) so casing or
    spacing around the keyword cannot smuggle one through. */
const UNSAFE_VALUE = /(url\(|@import|expression\(|javascript:)/i;

/** Drop comments, collapse every whitespace run to one space. parseTokens
    already strips comments and normalises space, so this only shrinks the
    payload — the token stream is unchanged. */
export function minifyCss(css: string): string {
  return String(css ?? "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function bytesToBase64Url(bytes: Uint8Array): string {
  const g = globalThis as unknown as { Buffer?: { from: (b: Uint8Array) => { toString: (e: string) => string } } };
  if (typeof g.Buffer !== "undefined") return g.Buffer.from(bytes).toString("base64url");
  let bin = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlToBytes(s: string): Uint8Array {
  const g = globalThis as unknown as { Buffer?: { from: (s: string, e: string) => Uint8Array } };
  if (typeof g.Buffer !== "undefined") return new Uint8Array(g.Buffer.from(s, "base64url"));
  let b64 = s.replace(/-/g, "+").replace(/_/g, "/");
  const pad = b64.length % 4;
  if (pad) b64 += "=".repeat(4 - pad);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function deflateRaw(data: Uint8Array): Promise<Uint8Array> {
  const stream = new CompressionStream("deflate-raw");
  const writer = stream.writable.getWriter();
  const reader = stream.readable.getReader();
  // The readable side must drain concurrently with writing: Chromium applies
  // backpressure to the writable side, so awaiting write()/close() before
  // the first read() never resolves in a real browser.
  const chunks: Uint8Array[] = [];
  let total = 0;
  const reading = (async () => {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      total += value.length;
    }
  })();
  try {
    await writer.write(data);
    await writer.close();
  } catch (e) {
    try {
      await reader.cancel();
    } catch {
      /* already closed — the write error below is the signal */
    }
    throw e;
  }
  await reading;
  const out = new Uint8Array(total);
  let at = 0;
  for (const c of chunks) {
    out.set(c, at);
    at += c.length;
  }
  return out;
}

async function inflateRaw(data: Uint8Array): Promise<string> {
  const stream = new DecompressionStream("deflate-raw");
  const writer = stream.writable.getWriter();
  const reader = stream.readable.getReader();
  // Same backpressure deadlock as deflateRaw above: drain while writing.
  const chunks: Uint8Array[] = [];
  let total = 0;
  const reading = (async () => {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.length;
      if (total > MAX_OUTPUT_BYTES) {
        try {
          await reader.cancel();
        } catch {
          /* already closed — the throw below is the signal */
        }
        throw new Error("shared link payload too large");
      }
      chunks.push(value);
    }
  })();
  try {
    await writer.write(data);
    await writer.close();
  } catch (e) {
    try {
      await reader.cancel();
    } catch {
      /* already closed — the write error below is the signal */
    }
    throw e;
  }
  await reading;
  const out = new Uint8Array(total);
  let at = 0;
  for (const c of chunks) {
    out.set(c, at);
    at += c.length;
  }
  return new TextDecoder().decode(out);
}

/** Serialise, compress and encode one system for the `s` param. */
export async function encodeSystem(input: SharedSystemInput): Promise<string> {
  const payload = JSON.stringify({ v: 1, n: input.name, c: minifyCss(input.css) });
  const compressed = await deflateRaw(new TextEncoder().encode(payload));
  return bytesToBase64Url(compressed);
}

/** Inverse of encodeSystem: decompress, validate, sanitise. Rejects input
    longer than 20000 chars, output past 200 KB, invalid JSON, or `v !== 1`
    by throwing — the caller toasts "This shared link is damaged" and
    continues normally. Sanitising runs the CSS through the existing
    parseTokens and keeps only the parsed `--name: value` tokens, dropping
    unsafe values and reporting how many were dropped. */
export async function decodeSystem(s: string): Promise<DecodedSharedSystem> {
  if (typeof s !== "string" || s.length === 0 || s.length > MAX_INPUT_CHARS) {
    throw new Error("shared link is damaged");
  }
  if (!/^[A-Za-z0-9\-_]*$/.test(s)) throw new Error("shared link is damaged");
  let json: string;
  try {
    json = await inflateRaw(base64UrlToBytes(s));
  } catch {
    throw new Error("shared link is damaged");
  }
  let obj: unknown;
  try {
    obj = JSON.parse(json);
  } catch {
    throw new Error("shared link is damaged");
  }
  if (
    typeof obj !== "object" ||
    obj === null ||
    (obj as { v?: unknown }).v !== 1 ||
    typeof (obj as { n?: unknown }).n !== "string" ||
    typeof (obj as { c?: unknown }).c !== "string"
  ) {
    throw new Error("shared link is damaged");
  }
  const { n: name, c: css } = obj as { n: string; c: string };
  const tokens: SharedToken[] = [];
  let dropped = 0;
  for (const t of parseTokens(css) as SharedToken[]) {
    if (UNSAFE_VALUE.test(t.value)) dropped++;
    else tokens.push({ name: t.name, value: t.value });
  }
  return {
    name,
    css: `:root {\n${tokens.map((t) => `  ${t.name}: ${t.value};`).join("\n")}\n}\n`,
    tokens,
    dropped,
  };
}

// Short aliases: the round-trip contract reads `decode(encode(x))`.
export const encode = encodeSystem;
export const decode = decodeSystem;
