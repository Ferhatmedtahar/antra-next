import path from "path";

import chalk from "chalk";

import { runScan, type ScanResult } from "../../engine.js";
import { FrameworkNotDetectedError } from "../../framework/detect.js";
import { isRuleId, RULE_IDS, type Finding } from "../../rules/index.js";

interface ScanOptions {
  strict?: boolean;
  diff?: boolean;
  staged?: boolean;
  failOnViolation?: boolean;
  format?: string;
  rule?: string;
  verbose?: boolean;
}

/** Per-section cap in the pretty summary; --verbose or --format json lifts it. */
const PREVIEW_LIMIT = 10;

export async function scanCommand(
  targetPath: string,
  options: ScanOptions,
): Promise<void> {
  const rootDir = path.resolve(targetPath);

  if (options.rule !== undefined && !isRuleId(options.rule)) {
    console.error(
      chalk.red(
        `Unknown rule "${options.rule}". Known: ${RULE_IDS.join(", ")}`,
      ),
    );
    process.exitCode = 2;
    return;
  }

  let result: ScanResult;
  try {
    result = await runScan({
      rootDir,
      ...(options.rule !== undefined && isRuleId(options.rule)
        ? { onlyRules: [options.rule] }
        : {}),
    });
  } catch (error) {
    if (error instanceof FrameworkNotDetectedError) {
      console.error(chalk.red(error.message));
      process.exitCode = 1;
      return;
    }
    throw error;
  }

  if (options.format === "json") {
    console.log(JSON.stringify(result, null, 2));
  } else {
    printSummary(result, rootDir, options.verbose ?? false);
    printFindings(result, rootDir);
  }

  const shouldFail =
    (options.failOnViolation ?? false) || (options.strict ?? false);
  const violated =
    result.findings.length > 0 ||
    ((options.strict ?? false) && !result.configPresent);
  if (shouldFail && violated) process.exitCode = 1;
}

function printList(lines: readonly string[], verbose: boolean): void {
  const shown = verbose ? lines : lines.slice(0, PREVIEW_LIMIT);
  for (const line of shown) console.log(chalk.gray(`    ${line}`));
  if (lines.length > shown.length) {
    console.log(
      chalk.gray(
        `    … and ${lines.length - shown.length} more (--verbose or --format json for all)`,
      ),
    );
  }
}

function printSummary(
  result: ScanResult,
  rootDir: string,
  verbose: boolean,
): void {
  const relative = (filePath: string) => path.relative(rootDir, filePath);
  const clients = result.classifications.filter((c) => c.boundary === "client");
  const routes = result.classifications.filter((c) => c.isRouteHandler);
  const actions = result.classifications.flatMap((c) =>
    c.serverActions.map((action) => ({ file: c.filePath, ...action })),
  );

  console.log(chalk.blue.bold("boundary-guard scan"));
  console.log(chalk.gray(`project:   ${rootDir}`));
  console.log(chalk.gray(`framework: ${result.frameworkAdapter}`));
  console.log(
    chalk.gray(
      `rules:     ${result.rulesRun.join(", ") || "(none enabled)"}\n`,
    ),
  );

  if (result.configPresent) {
    console.log(
      `  taint sources:     ${result.taintSources.length} sensitive of ${result.schemaFields.length} schema field(s)`,
    );
    printList(
      result.taintSources.map((source) => source.origin),
      verbose,
    );
  } else {
    console.log(
      chalk.yellow(
        "  taint sources:     none — no boundary-guard.config.json; run `boundary-guard init` (zero-schema heuristics only)",
      ),
    );
  }

  console.log(`  files scanned:     ${result.classifications.length}`);
  console.log(`  client boundaries: ${clients.length}`);
  printList(
    clients.map((c) => relative(c.filePath)),
    verbose,
  );
  console.log(`  server actions:    ${actions.length}`);
  printList(
    actions.map((a) => `${relative(a.file)}:${a.line}  ${a.name}`),
    verbose,
  );
  console.log(`  route handlers:    ${routes.length}`);
  printList(
    routes.map(
      (r) => `${relative(r.filePath)}  [${r.routeMethods.join(", ")}]`,
    ),
    verbose,
  );
}

function countByRule(findings: readonly Finding[]): string {
  const counts = new Map<string, number>();
  for (const finding of findings) {
    counts.set(finding.ruleId, (counts.get(finding.ruleId) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([ruleId, count]) => `${ruleId} ×${count}`)
    .join(", ");
}

function printFindings(result: ScanResult, rootDir: string): void {
  const relative = (filePath: string) => path.relative(rootDir, filePath);
  console.log("");

  if (result.findings.length === 0) {
    console.log(chalk.green.bold("✓ no findings"));
  } else {
    console.log(
      chalk.red.bold(
        `✖ ${result.findings.length} finding(s)  [${countByRule(result.findings)}]`,
      ),
    );
  }
  if (result.suppressed.length > 0) {
    console.log(
      chalk.gray(`  ${result.suppressed.length} suppressed by inline comment`),
    );
  }

  let lastFile = "";
  for (const finding of result.findings) {
    if (finding.filePath !== lastFile) {
      console.log(chalk.bold(`\n${relative(finding.filePath)}`));
      lastFile = finding.filePath;
    }
    const severity =
      finding.severity === "error" ? chalk.red("error") : chalk.yellow("warn ");
    console.log(
      `  ${chalk.gray(`${finding.line}:${finding.column}`)}  ${severity}  ${chalk.cyan(finding.ruleId)}  ${finding.message}`,
    );
    console.log(chalk.gray(`        ${finding.snippet}`));
    for (const step of finding.trace) {
      console.log(chalk.gray(`        ↳ ${step}`));
    }
  }
}
