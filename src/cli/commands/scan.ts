import fs from "fs";
import path from "path";

import chalk from "chalk";

import { runScan, type ScanResult } from "../../engine.js";
import { FrameworkNotDetectedError } from "../../framework/detect.js";
import {
  getReporter,
  isReportFormat,
  REPORT_FORMATS,
} from "../../reporters/index.js";
import { isRuleId, RULE_IDS } from "../../rules/index.js";

export interface ScanCommandOptions {
  strict?: boolean;
  diff?: boolean;
  staged?: boolean;
  failOnViolation?: boolean;
  format?: string;
  rule?: string;
  verbose?: boolean;
  output?: string;
  /** commander's --no-store → false; absent → true. */
  store?: boolean;
}

export async function scanCommand(
  targetPath: string,
  options: ScanCommandOptions,
): Promise<void> {
  const rootDir = path.resolve(targetPath);
  const format = options.format ?? "pretty";

  if (!isReportFormat(format)) {
    console.error(
      chalk.red(
        `Unknown format "${format}". Known: ${REPORT_FORMATS.join(", ")}`,
      ),
    );
    process.exitCode = 2;
    return;
  }
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
      store: options.store !== false,
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

  const report = getReporter(format).render(result, {
    rootDir,
    color: options.output === undefined && format === "pretty",
    verbose: options.verbose ?? false,
  });

  if (options.output !== undefined) {
    const target = path.resolve(options.output);
    await fs.promises.mkdir(path.dirname(target), { recursive: true });
    await fs.promises.writeFile(target, `${report}\n`, "utf8");
    console.log(
      `${chalk.green("✓")} ${format} report → ${path.relative(process.cwd(), target)}  (${result.findings.length} finding(s), ${result.baselined.length} baselined, ${result.suppressed.length} suppressed)`,
    );
  } else {
    console.log(report);
  }

  const gate = (options.failOnViolation ?? false) || (options.strict ?? false);
  const violated =
    result.findings.length > 0 ||
    ((options.strict ?? false) && !result.configPresent);
  if (gate && violated) process.exitCode = 1;
}
