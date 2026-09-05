import path from "path";

import chalk from "chalk";

import { ConfigNotFoundError } from "../../config/load.js";
import { runSync } from "../../config/sync.js";
import { CONFIG_FILENAME } from "../../config/write.js";
import { FrameworkNotDetectedError } from "../../framework/detect.js";
import type { TaintSource } from "../../schema/types.js";

export async function syncCommand(targetPath: string): Promise<void> {
  const rootDir = path.resolve(targetPath);
  console.log(chalk.blue.bold("boundary-guard sync"));
  console.log(chalk.gray(`project: ${rootDir}\n`));

  try {
    const result = await runSync(rootDir);
    const providerIds = result.config.providers.map((provider) => provider.id);
    console.log(chalk.green.bold("✓ snapshot refreshed"));
    console.log(
      `  providers: ${providerIds.join(", ") || "(none — zero-schema only)"}`,
    );
    console.log(
      `  sources:   ${result.snapshot.sources.length} field(s), ${result.sensitive.length} look sensitive → ${path.relative(rootDir, result.snapshotPath)}`,
    );
    for (const entry of result.skipped) {
      console.log(chalk.yellow(`  skipped:   ${entry.id} — ${entry.reason}`));
    }
    printSensitive(result.sensitive);
  } catch (error) {
    if (
      error instanceof ConfigNotFoundError ||
      error instanceof FrameworkNotDetectedError
    ) {
      console.error(chalk.red(error.message));
      process.exitCode = 1;
      return;
    }
    throw error;
  }
}

/** Full list on purpose — `sync`/`init` are the moments to review and pin/ignore. */
export function printSensitive(
  sensitive: readonly TaintSource[],
  options: { seeded?: boolean } = {},
): void {
  console.log(
    chalk.gray(
      options.seeded
        ? "\n  sensitive fields (written to sensitiveFields.include in the config):"
        : "\n  sensitive fields:",
    ),
  );
  if (sensitive.length === 0) {
    console.log(chalk.gray("    (none matched)"));
  }
  for (const source of sensitive) {
    console.log(chalk.gray(`    ${source.origin}`));
  }
  console.log(
    chalk.gray(
      `\n  Missed one, or a false positive? Edit ${CONFIG_FILENAME}:\n` +
        `    sensitiveFields.include — the list above; add exact fields/origins the keywords missed\n` +
        `    sensitiveFields.exclude — never treat an exact field or origin as sensitive (wins)\n` +
        `    keywords.include        — name patterns in your own language ("mot_de_passe", "iban")\n` +
        `  Takes effect on the next scan — no sync needed; sync never rewrites your config.`,
    ),
  );
}
