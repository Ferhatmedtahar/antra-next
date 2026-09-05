import type { ScanResult } from "../engine.js";

export type ReportFormat = "pretty" | "json" | "sarif";

export interface ReportContext {
  rootDir: string;
  color: boolean;
  /** Pretty reporter: lift the per-section caps. */
  verbose: boolean;
}

/** D2/D3 in docs/c4: a pure function from ScanResult to text. Nothing else. */
export interface Reporter {
  format: ReportFormat;
  render(result: ScanResult, ctx: ReportContext): string;
}
