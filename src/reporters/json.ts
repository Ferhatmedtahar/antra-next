import type { Reporter } from "./types.js";

/** The full ScanResult, verbatim — for scripts and for `trace`/Studio later. */
export const jsonReporter: Reporter = {
  format: "json",
  render(result) {
    return JSON.stringify(result, null, 2);
  },
};
