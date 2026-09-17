import { parseTokens } from "../../../src/core/parse.js";

/** Shared token-value helpers (non-component, so fast-refresh stays quiet). */
export const isRef = (v: string) => v.includes("var(--");

/** Pasted-token count for a CSS block — what the dialogs gate Save on. */
export function countTokens(css: string): number {
  return css.trim() ? (parseTokens(css) as unknown[]).length : 0;
}
