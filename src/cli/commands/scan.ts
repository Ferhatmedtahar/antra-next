import fs from "fs";
import path from "path";

import chalk from "chalk";

import { runScan, type ScanResult } from "../../engine.js";
import { FrameworkNotDetectedError } from "../../framework/detect.js";
import {
  GitError,
  listChangedFiles,
  type ChangeMode,
} from "../../git/changed-files.js";
import {
  getReporter,
  isReportFormat,
  REPORT_FORMATS,
} from "../../reporters/index.js";
import { isRuleId, RULE_IDS } from "../../rules/index.js";
import { scanSpinner } from "../progress.js";

export interface ScanCommandOptions {
  strict?: boolean;
  diff?: boolean;
  staged?: boolean;
  /** Ref for --diff; auto-detected (origin/main, main, …) when absent. */
  base?: string;
  failOnViolation?: boolean;
  format?: string;
  rule?: string;
  verbose?: boolean;
  output?: string;
  /** commander's --no-store → false; absent → true. */
  store?: boolean;
}

const SOURCE_FILE = /\.(?:tsx?|jsx?)$/;

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
  if (options.staged && options.diff) {
    console.error(chalk.red("--staged and --diff can't be combined."));
    process.exitCode = 2;
    return;
  }

  // --staged / --diff: rules run only on the changed files. The whole
  // project is still parsed, so cross-file taint resolves; the scan is
  // partial, so it isn't recorded in antra-findings.sqlite.
  let scope: { onlyFiles: string[]; scopeLabel: string } | null = null;
  if (options.staged || options.diff) {
    const mode: ChangeMode = options.staged ? "staged" : "diff";
    try {
      const changed = await listChangedFiles(rootDir, mode, options.base);
      scope = {
        onlyFiles: changed.files.filter((file) => SOURCE_FILE.test(file)),
        scopeLabel:
          mode === "staged"
            ? "git staged files"
            : `files changed since ${changed.base ?? "base"}`,
      };
    } catch (error) {
      if (error instanceof GitError) {
        console.error(chalk.red(error.message));
        process.exitCode = 1;
        return;
      }
      throw error;
    }
    if (scope.onlyFiles.length === 0) {
      if (format === "json") {
        console.log(
          JSON.stringify(
            {
              scope: { partial: true, label: scope.scopeLabel, files: 0 },
              findings: [],
              suppressed: [],
              baselined: [],
            },
            null,
            2,
          ),
        );
      } else {
        console.log(
          chalk.gray(`No ${scope.scopeLabel} to scan — nothing to do.`),
        );
      }
      return;
    }
  }

  const { spinner, onPhase } = scanSpinner();
  let result: ScanResult;
  try {
    result = await runScan({
      rootDir,
      store: options.store !== false && scope === null,
      onPhase,
      ...(scope ?? {}),
      ...(options.rule !== undefined && isRuleId(options.rule)
        ? { onlyRules: [options.rule] }
        : {}),
    });
    spinner.succeed();
  } catch (error) {
    // Mark the step that was in flight red before the error explains it.
    spinner.fail();
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
  if (gate && violated) {
    process.exitCode = 1;
    // Say why, so a red CI step is readable without opening the log header.
    if (format === "pretty") {
      const why =
        result.findings.length > 0
          ? `${result.findings.length} finding(s) to fix`
          : "no schema snapshot (--strict)";
      console.log(chalk.red(`✖ exit 1 — ${why}`));
    }
  }
}
