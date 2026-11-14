import { encodeSystem, SHARE_EMBED_LIMIT } from "./shareLink.ts";

export interface CopyLinkResult {
  /** True when the copied URL carries the `s` payload. */
  shared: boolean;
  /** True when the system was too large to embed: the plain URL (no `s`)
      was copied instead and the caller must toast the Export-JSON hint. */
  tooLarge: boolean;
}

/** Copy the current view URL plus `s=<encoded active system>` (issue #337),
 *  so a recipient without the sender's localStorage still gets the tokens.
 *  The `#section` hash rides along untouched — the URL object preserves it.
 *  Past SHARE_EMBED_LIMIT chars the link is copied without `s` (tooLarge).
 *  With no system (or an unencodable one) the bare URL is copied, exactly as
 *  before — the existing verbatim-copy contract is unchanged. */
export async function copyLinkToView(
  active?: { name: string; css: string } | null,
): Promise<CopyLinkResult> {
  const href = window.location.href;
  if (!active?.css) {
    await navigator.clipboard.writeText(href);
    return { shared: false, tooLarge: false };
  }
  let encoded: string;
  try {
    encoded = await encodeSystem({ name: active.name, css: active.css });
  } catch {
    await navigator.clipboard.writeText(href);
    return { shared: false, tooLarge: false };
  }
  if (encoded.length > SHARE_EMBED_LIMIT) {
    await navigator.clipboard.writeText(href);
    return { shared: false, tooLarge: true };
  }
  const url = new URL(href);
  url.searchParams.set("s", encoded);
  await navigator.clipboard.writeText(url.toString());
  return { shared: true, tooLarge: false };
}
