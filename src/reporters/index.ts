import { jsonReporter } from "./json.js";
import { sarifReporter } from "./sarif.js";
import { terminalReporter } from "./terminal.js";
import type { ReportFormat, Reporter } from "./types.js";

export type { ReportContext, ReportFormat, Reporter } from "./types.js";

export const reporters: readonly Reporter[] = [
  terminalReporter,
  jsonReporter,
  sarifReporter,
];

export const REPORT_FORMATS: readonly ReportFormat[] = reporters.map(
  (reporter) => reporter.format,
);

export function isReportFormat(value: string): value is ReportFormat {
  return (REPORT_FORMATS as readonly string[]).includes(value);
}

export function getReporter(format: ReportFormat): Reporter {
  const reporter = reporters.find((candidate) => candidate.format === format);
  if (!reporter) throw new Error(`No reporter for format "${format}"`);
  return reporter;
}
