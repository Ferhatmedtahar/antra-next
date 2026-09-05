import path from "path";

import chalk from "chalk";

import {
  classifySources,
  sensitivityFromConfig,
} from "../../classification/classify.js";
import { FrameworkNotDetectedError } from "../../framework/detect.js";
import { SchemaExtractionError } from "../../schema/errors.js";
import { frameworkAdapters } from "../../framework/index.js";
import { inquirerPrompter, isPromptExit } from "../../init/prompter.js";
import { runInit, type InitResult } from "../../init/run-init.js";
import { selectableProviders } from "../../schema/providers/index.js";
import { printSensitive } from "./sync.js";

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
    if (error instanceof SchemaExtractionError) {
      console.error(chalk.red(`\n✖ ${error.message}`));
      console.error(
        chalk.gray(
          "  Nothing was written. Fix the provider's path or credentials and run `boundary-guard init` again.",
        ),
      );
      process.exitCode = 1;
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

  const sensitive = classifySources(
    result.snapshot.sources,
    sensitivityFromConfig(result.config),
  );

  console.log(chalk.green.bold("\n✓ boundary-guard initialized"));
  console.log(`  framework: ${result.frameworkAdapter}`);
  console.log(`  providers: ${providerLines.join(", ")}`);
  console.log(
    `  sources:   ${result.snapshot.sources.length} field(s), ${sensitive.length} look sensitive → ${path.relative(rootDir, result.snapshotPath)}`,
  );
  console.log(`  config:    ${path.relative(rootDir, result.configPath)}`);
  const gitignoreNote = {
    created: "created with the boundary-guard block",
    appended: "boundary-guard block appended",
    unchanged: "already has the boundary-guard block",
  }[result.gitignore];
  console.log(`  .gitignore: ${gitignoreNote}`);
  if (result.snapshot.sources.length > 0) {
    printSensitive(sensitive, { seeded: true });
  }
}
