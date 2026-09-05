import fs from "fs";
import path from "path";

import chalk, { Chalk } from "chalk";

import { runScan } from "../../engine.js";
import { FrameworkNotDetectedError } from "../../framework/detect.js";
import { codeFrame, SourceCache } from "../../reporters/terminal.js";
import type { Finding } from "../../rules/types.js";
import { scanSpinner } from "../progress.js";

interface TraceOptions {
  format?: string;
}

type Status = "new" | "accepted" | "suppressed";

/** `components/UserCard.tsx:85` → file + optional line. */
export function parseTarget(target: string): {
  file: string;
  line: number | null;
} {
  const match = /^(.*?)(?::(\d+))?(?::\d+)?$/.exec(target);
  const file = match?.[1] ?? target;
  const line = match?.[2] !== undefined ? Number(match[2]) : null;
  return { file, line };
}

export async function traceCommand(
  target: string,
  targetPath = ".",
  options: TraceOptions = {},
): Promise<void> {
  const rootDir = path.resolve(targetPath);
  const format = options.format ?? "pretty";
  if (format !== "pretty" && format !== "json") {
    console.error(chalk.red(`Unknown format "${format}". Known: pretty, json`));
    process.exitCode = 2;
    return;
  }

  const { file, line } = parseTarget(target);
  const candidates = [path.resolve(rootDir, file), path.resolve(file)];
  const filePath = candidates.find((candidate) => fs.existsSync(candidate));
  if (!filePath) {
    console.error(chalk.red(`File not found: ${file} (looked in ${rootDir})`));
    process.exitCode = 1;
    return;
  }
  const relative = path.relative(rootDir, filePath);

  const { spinner, onPhase } = scanSpinner();
  let result;
  try {
    result = await runScan({
      rootDir,
      store: false,
      onPhase,
      onlyFiles: [filePath],
      scopeLabel: `trace ${relative}`,
    });
    spinner.stop();
  } catch (error) {
    spinner.fail("Trace failed");
    if (error instanceof FrameworkNotDetectedError) {
      console.error(chalk.red(error.message));
      process.exitCode = 1;
      return;
    }
    throw error;
  }

  const all: { finding: Finding; status: Status }[] = [
    ...result.findings.map((finding) => ({ finding, status: "new" as const })),
    ...result.baselined.map((finding) => ({
      finding,
      status: "accepted" as const,
    })),
    ...result.suppressed.map((finding) => ({
      finding,
      status: "suppressed" as const,
    })),
  ].sort((a, b) => a.finding.line - b.finding.line);
  const inFile = all.filter(
    ({ finding }) => path.resolve(finding.filePath) === filePath,
  );
  const hits =
    line === null
      ? inFile
      : inFile.filter(({ finding }) => finding.line === line);

  if (format === "json") {
    console.log(
      JSON.stringify(
        {
          file: relative,
          line,
          findings: hits.map(({ finding, status }) => ({
            ...finding,
            file: relative,
            status,
            path: [...finding.trace].reverse(),
          })),
        },
        null,
        2,
      ),
    );
    return;
  }

  const c = new Chalk();
  console.log(chalk.blue.bold("boundary-guard trace"));
  console.log(
    chalk.gray(`target: ${relative}${line === null ? "" : `:${line}`}\n`),
  );

  if (hits.length === 0) {
    console.log(
      line === null
        ? chalk.green(`✓ no findings in ${relative}`)
        : chalk.yellow(`No finding at ${relative}:${line}.`),
    );
    if (inFile.length > 0 && line !== null) {
      console.log(chalk.gray("\n  Findings in this file:"));
      for (const { finding, status } of inFile) {
        console.log(
          chalk.gray(
            `    ${relative}:${finding.line}:${finding.column}  ${finding.ruleId}  ${status}`,
          ),
        );
      }
    }
    return;
  }

  const sources = new SourceCache();
  const statusColor: Record<Status, (text: string) => string> = {
    new: (text) => chalk.red(text),
    accepted: (text) => chalk.gray(text),
    suppressed: (text) => chalk.green(text),
  };
  hits.forEach(({ finding, status }, index) => {
    if (index > 0) console.log("");
    const severity =
      finding.severity === "error"
        ? chalk.red("error")
        : chalk.yellow("warning");
    console.log(
      `${chalk.bold(`${relative}:${finding.line}:${finding.column}`)}  ${chalk.cyan(finding.ruleId)}  ${severity}  ${statusColor[status](status)}`,
    );
    console.log(`  ${finding.message}`);
    const lines = sources.get(finding.filePath);
    if (lines) console.log(codeFrame(finding, lines, c).join("\n"));
    if (finding.trace.length === 0) {
      console.log(
        chalk.gray("\n  No dataflow — the sink itself is the finding."),
      );
    } else {
      console.log(chalk.gray("\n  Path, origin → sink:"));
      const steps = [...finding.trace].reverse();
      steps.forEach((step, stepIndex) => {
        console.log(`    ${chalk.gray(`${stepIndex + 1}.`)} ${step}`);
      });
      console.log(`    ${chalk.gray("↳ sink")} ${chalk.bold(finding.snippet)}`);
    }
    if (finding.suppressed) {
      console.log(
        chalk.gray(
          `\n  Suppressed in source${finding.suppressed.reason ? `: "${finding.suppressed.reason}"` : ""}.`,
        ),
      );
    }
  });
}
