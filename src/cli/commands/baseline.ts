import path from "path";

import chalk from "chalk";

import { writeBaseline } from "../../baseline/baseline.js";
import { runScan } from "../../engine.js";
import { FrameworkNotDetectedError } from "../../framework/detect.js";
import { scanSpinner } from "../progress.js";

/**
 * Records every current finding as known, so future scans only fail on new
 * ones. The adoption path for an existing codebase — commit the file.
 */
export async function baselineCommand(targetPath: string): Promise<void> {
  const rootDir = path.resolve(targetPath);
  console.log(chalk.blue.bold("antra baseline"));
  console.log(chalk.gray(`project: ${rootDir}\n`));

  const { spinner, onPhase } = scanSpinner();
  try {
    const result = await runScan({
      rootDir,
      ignoreBaseline: true,
      store: false,
      onPhase,
    });
    spinner.succeed(
      `Scanned ${result.classifications.length} files in ${(result.durationMs / 1000).toFixed(1)}s`,
    );
    const fingerprints = result.findings.flatMap((finding) =>
      finding.fingerprint ? [finding.fingerprint] : [],
    );
    const target = await writeBaseline(rootDir, fingerprints);

    const counts = new Map<string, number>();
    for (const finding of result.findings) {
      counts.set(finding.ruleId, (counts.get(finding.ruleId) ?? 0) + 1);
    }
    console.log(chalk.green.bold("✓ baseline written"));
    console.log(
      `  recorded:  ${fingerprints.length} finding(s)` +
        (counts.size > 0
          ? `  [${[...counts.entries()]
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([rule, count]) => `${rule} ×${count}`)
              .join(", ")}]`
          : ""),
    );
    console.log(
      `  excluded:  ${result.suppressed.length} suppressed by inline comment`,
    );
    console.log(`  file:      ${path.relative(rootDir, target)}`);
    console.log(
      chalk.gray(
        "\n  Commit this file. From now on `scan` reports only findings that aren't in it;\n" +
          "  re-run `baseline` when you've deliberately accepted more.",
      ),
    );
  } catch (error) {
    spinner.fail("Baseline failed");
    if (error instanceof FrameworkNotDetectedError) {
      console.error(chalk.red(error.message));
      process.exitCode = 1;
      return;
    }
    throw error;
  }
}
