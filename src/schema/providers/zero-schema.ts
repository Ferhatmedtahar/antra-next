import type { SchemaProvider } from "../types.js";

/**
 * zero-schema — the always-available floor (ADR-002, Strategy D). Never
 * offered as a checkbox in `init`; it's what every project has when
 * nothing else is enabled. Its "sources" are heuristics applied at scan
 * time, so it has no snapshot data to extract.
 */
export const zeroSchemaProvider: SchemaProvider = {
  id: "zero-schema",
  label: "Zero-schema heuristics (always on)",

  detect() {
    return Promise.resolve(true);
  },

  configFields() {
    return Promise.resolve([]);
  },

  extract() {
    return Promise.resolve([]);
  },
};
