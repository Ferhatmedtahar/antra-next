import fs from "fs";
import path from "path";

import chalk from "chalk";

import { runScan } from "../../engine.js";
import {
  FrameworkNotDetectedError,
  requireFramework,
} from "../../framework/detect.js";
import { renderFindings } from "../../reporters/terminal.js";
import { isRuleId, RULE_IDS } from "../../rules/index.js";
import { isProjectSettingsPath, startWatcher } from "../../watch/watcher.js";
import { scanSpinner } from "../progress.js";

interface WatchOptions {
  /** Always rescan the whole project instead of only the changed files. */
  full?: boolean;
  rule?: string;
}

const SOURCE_FILE = /\.(?:tsx?|jsx?)$/;

function stamp(): string {
  return new Date().toLocaleTimeString(undefined, { hour12: false });
}

export async function watchCommand(
  targetPath = ".",
  options: WatchOptions = {},
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
  try {
    await requireFramework(rootDir);
  } catch (error) {
    if (error instanceof FrameworkNotDetectedError) {
      console.error(chalk.red(error.message));
      process.exitCode = 1;
      return;
    }
    throw error;
  }
  const onlyRules =
    options.rule !== undefined && isRuleId(options.rule)
      ? { onlyRules: [options.rule] as const }
      : {};

  console.log(chalk.blue.bold("boundary-guard watch"));
  console.log(chalk.gray(`project: ${rootDir}\n`));

  const scan = async (label: string, onlyFiles?: string[]) => {
    const { spinner, onPhase } = scanSpinner(label);
    try {
      const result = await runScan({
        rootDir,
        store: false,
        onPhase,
        ...(onlyFiles ? { onlyFiles, scopeLabel: label } : {}),
        ...onlyRules,
      });
      spinner.stop();
      const summary =
        result.findings.length === 0
          ? chalk.green(`no new findings`)
          : chalk.red(`${result.findings.length} finding(s)`);
      console.log(
        `${chalk.gray(stamp())}  ${chalk.bold(label)} → ${summary}  ${chalk.gray(
          `(${result.baselined.length} baselined, ${result.suppressed.length} suppressed, ${(result.durationMs / 1000).toFixed(1)}s)`,
        )}`,
      );
      if (result.findings.length > 0) {
        console.log(
          renderFindings(
            result,
            { rootDir, color: true, verbose: false },
            chalk,
          )
            .slice(2) // the "✖ N finding(s)" headline is already on the stamp line
            .join("\n"),
        );
      }
    } catch (error) {
      spinner.fail("Scan failed");
      console.error(
        chalk.red(error instanceof Error ? error.message : String(error)),
      );
    }
  };

  await scan("whole project");

  let running = false;
  let queued: string[] | null = null;
  const handle = async (paths: string[]): Promise<void> => {
    if (running) {
      queued = [...(queued ?? []), ...paths];
      return;
    }
    running = true;
    try {
      const settingsChanged = paths.some((file) =>
        isProjectSettingsPath(path.relative(rootDir, file)),
      );
      const sources = paths.filter(
        (file) => SOURCE_FILE.test(file) && fs.existsSync(file),
      );
      if (options.full || settingsChanged || sources.length === 0) {
        await scan(
          settingsChanged ? "config changed, whole project" : "whole project",
        );
      } else {
        await scan(
          sources.length === 1
            ? path.relative(rootDir, sources[0] ?? "")
            : `${sources.length} changed files`,
          sources,
        );
      }
    } finally {
      running = false;
      if (queued) {
        const next = queued;
        queued = null;
        void handle(next);
      }
    }
  };

  const watcher = startWatcher(rootDir, (paths) => void handle(paths));
  console.log(
    chalk.gray(
      `\nWatching ${rootDir} — ${options.full ? "full rescan" : "changed files only"} on save (config/snapshot/baseline changes always rescan everything). Ctrl+C to stop.\n`,
    ),
  );
  await new Promise<void>((resolve) => {
    const stop = () => {
      watcher.close();
      resolve();
    };
    process.once("SIGINT", stop);
    process.once("SIGTERM", stop);
  });
}
