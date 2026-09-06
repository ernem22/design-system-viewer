// WCAG 2.1 relative-luminance contrast. Pure math on rgb triples; the browser
// resolves var()/color-mix()/oklch to rgb for us (see app.js probe), so this
// file never needs a colour parser beyond "pull three numbers out".

/** "rgb(12, 34, 56)" | "12 34 56" -> [12,34,56] | null */
export function parseRgb(str) {
  const nums = String(str).match(/-?\d*\.?\d+/g);
  if (!nums || nums.length < 3) return null;
  return nums.slice(0, 3).map(Number);
}

const channel = (c) => {
  c /= 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};

export function relLuminance([r, g, b]) {
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** @returns {number|null} contrast ratio 1..21, or null if either colour is unparseable */
export function contrastRatio(fg, bg) {
  const a = Array.isArray(fg) ? fg : parseRgb(fg);
  const b = Array.isArray(bg) ? bg : parseRgb(bg);
  if (!a || !b) return null;
  const l1 = relLuminance(a);
  const l2 = relLuminance(b);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

/** WCAG AA needs 4.5 (normal text) / 3 (large); AAA needs 7. */
export function rating(ratio) {
  if (ratio == null) return { label: "—", pass: null };
  if (ratio >= 7) return { label: "AAA", pass: true };
  if (ratio >= 4.5) return { label: "AA", pass: true };
  if (ratio >= 3) return { label: "AA Large", pass: "large" };
  return { label: "Fail", pass: false };
}

// Foreground / background token pairs worth checking, with a human label.
export const CONTRAST_PAIRS = [
  ["--color-text", "--color-bg", "Body text"],
  ["--color-text", "--color-surface", "Surface text"],
  ["--color-text-secondary", "--color-surface", "Secondary text"],
  ["--color-text-muted", "--color-surface", "Muted text"],
  ["--color-text-link", "--color-bg", "Link"],
  ["--color-on-accent", "--color-accent", "On accent"],
  ["--color-on-success", "--color-success", "On success"],
  ["--color-on-warning", "--color-warning", "On warning"],
  ["--color-on-danger", "--color-danger", "On danger"],
  ["--color-on-info", "--color-info", "On info"],
];
