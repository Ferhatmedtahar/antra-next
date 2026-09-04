import path from "path";

import chalk from "chalk";

import { frameworkAdapters } from "../../framework/index.js";
import { inquirerPrompter, isPromptExit } from "../../init/prompter.js";
import { FrameworkNotDetectedError } from "../../framework/detect.js";
import { runInit, type InitResult } from "../../init/run-init.js";
import { selectableProviders } from "../../schema/providers/index.js";

export async function initCommand(targetPath: string): Promise<void> {
  const rootDir = path.resolve(targetPath);
  console.log(chalk.blue.bold("boundary-guard init"));
  console.log(chalk.gray(`project: ${rootDir}\n`));

  try {
    const result = await runInit({
      rootDir,
      prompter: inquirerPrompter,
      adapters: frameworkAdapters,
      providers: selectableProviders,
    });
    printResult(result, rootDir);
  } catch (error) {
    if (error instanceof FrameworkNotDetectedError) {
      console.error(chalk.red(error.message));
      process.exitCode = 1;
      return;
    }
    if (isPromptExit(error)) {
      console.log(chalk.yellow("\nAborted."));
      process.exitCode = 130;
      return;
    }
    throw error;
  }
}

function printResult(result: InitResult, rootDir: string): void {
  if (result.status === "aborted") {
    console.log(chalk.yellow(`Aborted — ${result.reason}.`));
    return;
  }

  const providerLines = result.config.providers.map((provider) => {
    const skipped = result.skipped.find((entry) => entry.id === provider.id);
    return skipped
      ? `${provider.id} ${chalk.yellow("(extract not implemented yet — skipped)")}`
      : provider.id;
  });
  providerLines.push(`zero-schema ${chalk.gray("(always on)")}`);

  console.log(chalk.green.bold("\n✓ boundary-guard initialized"));
  console.log(`  framework: ${result.frameworkAdapter}`);
  console.log(`  providers: ${providerLines.join(", ")}`);
  console.log(
    `  sources:   ${result.snapshot.sources.length} field(s) → ${path.relative(rootDir, result.snapshotPath)}`,
  );
  console.log(`  config:    ${path.relative(rootDir, result.configPath)}`);
}
