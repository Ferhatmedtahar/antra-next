import path from "path";
import { pathToFileURL } from "url";

import { VERSION } from "../index.js";
import { rules } from "../rules/index.js";
import { formatTraceStep, type Finding } from "../rules/types.js";
import type { Reporter } from "./types.js";

const SARIF_SCHEMA =
  "https://raw.githubusercontent.com/oasis-tcs/sarif-spec/main/sarif-2.1/schema/sarif-schema-2.1.0.json";

interface SarifResult {
  ruleId: string;
  level: "error" | "warning";
  message: { text: string };
  locations: {
    physicalLocation: {
      artifactLocation: { uri: string; uriBaseId: string };
      region: {
        startLine: number;
        startColumn: number;
        snippet: { text: string };
      };
    };
  }[];
  partialFingerprints: { "antra/v1": string };
  properties: { trace: string[] };
  baselineState?: "new" | "unchanged";
  suppressions?: { kind: "inSource"; justification?: string }[];
}

function toResult(
  finding: Finding,
  rootDir: string,
  status: "active" | "suppressed" | "baselined",
): SarifResult {
  const result: SarifResult = {
    ruleId: finding.ruleId,
    level: finding.severity,
    message: { text: finding.message },
    locations: [
      {
        physicalLocation: {
          artifactLocation: {
            uri: path
              .relative(rootDir, finding.filePath)
              .split(path.sep)
              .join("/"),
            uriBaseId: "%SRCROOT%",
          },
          region: {
            startLine: finding.line,
            startColumn: finding.column,
            snippet: { text: finding.snippet },
          },
        },
      },
    ],
    partialFingerprints: { "antra/v1": finding.fingerprint ?? "" },
    properties: { trace: finding.trace.map(formatTraceStep) },
  };
  if (status === "baselined") result.baselineState = "unchanged";
  if (status === "suppressed") {
    const justification = finding.suppressed?.reason;
    result.suppressions = [
      justification
        ? { kind: "inSource", justification }
        : { kind: "inSource" },
    ];
  }
  return result;
}

/**
 * SARIF 2.1.0 (GitHub code scanning, VS Code SARIF viewer, …). Suppressed
 * findings are included with `suppressions` so the platform hides them
 * itself; baselined ones carry `baselineState: "unchanged"`.
 */
export const sarifReporter: Reporter = {
  format: "sarif",
  render(result, ctx) {
    const log = {
      $schema: SARIF_SCHEMA,
      version: "2.1.0",
      runs: [
        {
          tool: {
            driver: {
              name: "antra",
              version: VERSION,
              informationUri: "https://github.com/Ferhatmedtahar/Antra",
              rules: rules.map((rule) => ({
                id: rule.id,
                name: rule.id.replace("-", ""),
                shortDescription: { text: rule.description },
                fullDescription: { text: rule.description },
                defaultConfiguration: { level: rule.severity },
                helpUri:
                  "https://github.com/Ferhatmedtahar/Antra/tree/main/docs",
              })),
            },
          },
          originalUriBaseIds: {
            "%SRCROOT%": { uri: `${pathToFileURL(ctx.rootDir).href}/` },
          },
          results: [
            ...result.findings.map((f) => toResult(f, ctx.rootDir, "active")),
            ...result.suppressed.map((f) =>
              toResult(f, ctx.rootDir, "suppressed"),
            ),
            ...result.baselined.map((f) =>
              toResult(f, ctx.rootDir, "baselined"),
            ),
          ],
        },
      ],
    };
    return JSON.stringify(log, null, 2);
  },
};
