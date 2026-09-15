/** Shared token-value helpers (non-component, so fast-refresh stays quiet). */
export const isRef = (v: string) => v.includes("var(--");
