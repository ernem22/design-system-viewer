// High-level TYPE layer over the root schema (REFERENCE in schema.js).
//
// The schema ships ~50 fine-grained groups (color-surface, font-size,
// motion-distance, …) — too granular for type-level UI (a "Motion" section,
// a type filter, per-type coverage). This module collapses them into a
// stable dozen product-level types (color, typography, motion, …).
//
// Mapping is an explicit group-id → type table, not prefix matching: a new
// schema group must be classified deliberately (schemaTypes.test.js fails
// otherwise) instead of being silently swallowed by a greedy prefix.

import { REFERENCE } from "./schema.js";

/** @typedef {{ type: string, label: string }} SchemaType */
/** @typedef {{ id: string, label: string, tokens: string[] }} SchemaGroup */
/** @typedef {{ type: string, label: string, tokenCount: number, groups: SchemaGroup[] }} TypedSchemaSection */

/** Product-level types, in display order. */
export const SCHEMA_TYPES = [
  { type: "color", label: "Color" },
  { type: "typography", label: "Typography" },
  { type: "spacing", label: "Spacing" },
  { type: "layout", label: "Layout" },
  { type: "shape", label: "Shape" },
  { type: "effects", label: "Effects" },
  { type: "motion", label: "Motion" },
  { type: "layering", label: "Layering" },
  { type: "breakpoint", label: "Breakpoint" },
  { type: "accessibility", label: "Accessibility" },
  { type: "component", label: "Component" },
];

/** Fallback for schema groups added without a deliberately chosen type. */
export const OTHER_TYPE = "other";

/** @type {Record<string, string>} */
const TYPE_OF_GROUP = {
  // — color —
  "color-surface": "color",
  "color-text": "color",
  "color-border": "color",
  "color-accent": "color",
  "color-disabled": "color",
  "color-input": "color",
  "color-brand": "color",
  "color-neutral": "color",
  "color-chart": "color",
  "color-interaction": "color",
  "color-state": "color",
  "color-alpha": "color",
  // — typography —
  "font-family": "typography",
  "font-display": "typography",
  "font-size": "typography",
  "font-weight": "typography",
  "line-height": "typography",
  "letter-spacing": "typography",
  "text-measure": "typography",
  // — spacing —
  spacing: "spacing",
  "section-spacing": "spacing",
  // — layout —
  layout: "layout",
  composition: "layout",
  size: "layout",
  "control-geometry": "layout",
  iconography: "layout",
  media: "layout",
  responsive: "layout",
  // — shape —
  radius: "shape",
  "border-width": "shape",
  // — effects —
  shadow: "effects",
  glow: "effects",
  blur: "effects",
  gradient: "effects",
  opacity: "effects",
  // — motion —
  duration: "motion",
  "motion-distance": "motion",
  "motion-scale": "motion",
  "motion-blur": "motion",
  easing: "motion",
  motion: "motion",
  // — layering / breakpoint / accessibility —
  "z-index": "layering",
  breakpoint: "breakpoint",
  accessibility: "accessibility",
  // — component —
  "component-button": "component",
  "component-card": "component",
  "component-nav": "component",
  "component-badge": "component",
  "component-modal": "component",
  "component-tooltip": "component",
  "component-input": "component",
  "component-avatar": "component",
  "component-divider": "component",
  "component-overlay": "component",
};

/**
 * Product-level type for a schema group id.
 * Unknown ids fall back to "other" (never throws) — the test suite pins
 * every current REFERENCE id to a real type so gaps are caught deliberately.
 * @param {string} groupId
 */
export function typeOfGroup(groupId) {
  return TYPE_OF_GROUP[groupId] ?? OTHER_TYPE;
}

/**
 * Parse the root schema into type sections.
 * Sections follow SCHEMA_TYPES order; types with no groups are omitted;
 * groups keep their schema order inside each section; the input is never
 * mutated (sections hold new objects, token arrays are shared by reference).
 * @param {SchemaGroup[]} [ref]
 * @returns {TypedSchemaSection[]}
 */
export function parseSchemaByType(ref = REFERENCE) {
  const byType = new Map();
  for (const g of ref) {
    const type = typeOfGroup(g.id);
    if (!byType.has(type)) byType.set(type, []);
    byType.get(type).push({ id: g.id, label: g.label, tokens: g.tokens });
  }
  const labelOf = new Map(SCHEMA_TYPES.map((t) => [t.type, t.label]));
  const order = new Map(SCHEMA_TYPES.map((t, i) => [t.type, i]));
  return [...byType]
    .sort(([a], [b]) => (order.get(a) ?? SCHEMA_TYPES.length) - (order.get(b) ?? SCHEMA_TYPES.length))
    .map(([type, groups]) => ({
      type,
      label: labelOf.get(type) ?? type,
      tokenCount: groups.reduce((n, g) => n + g.tokens.length, 0),
      groups,
    }));
}

/**
 * Token names belonging to one type (e.g. every motion token).
 * @param {string} type
 * @param {SchemaGroup[]} [ref]
 * @returns {string[]}
 */
export function tokensOfType(type, ref = REFERENCE) {
  return ref.filter((g) => typeOfGroup(g.id) === type).flatMap((g) => g.tokens);
}
