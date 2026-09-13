import path from "path";

import chalk from "chalk";

import { runScan } from "../../engine.js";
import { FrameworkNotDetectedError } from "../../framework/detect.js";
import { applySuppressionEdits, planSuppressions } from "../../fix/suppress.js";
import { isRuleId, RULE_IDS } from "../../rules/index.js";
import { scanSpinner } from "../progress.js";

export interface FixOptions {
  /** Rule id, or "all". */
  suppress?: string;
  reason?: string;
  /** Substring of the relative file path to limit the edit to. */
  file?: string;
  dryRun?: boolean;
}

export async function fixCommand(
  targetPath = ".",
  options: FixOptions = {},
): Promise<void> {
  const rootDir = path.resolve(targetPath);

  if (options.suppress === undefined) {
    console.log(chalk.blue.bold("antra fix"));
    console.log(
      [
        "",
        "  What fix can do today:",
        '    --suppress <BG-00X|all> --reason "why"   insert a disable-next-line comment above every new finding of that rule',
        "    --file <path-fragment>                     limit the edit to matching files",
        "    --dry-run                                  print the planned edits without writing",
        "",
        "  Not automated (yet): scaffolding validators for BG-002 and projecting props for BG-003 —",
        "  those need to know the shape of your data. `antra trace <file:line>` shows the path to fix by hand.",
      ].join("\n"),
    );
    process.exitCode = 2;
    return;
  }
  const rule = options.suppress === "all" ? null : options.suppress;
  if (rule !== null && !isRuleId(rule)) {
    console.error(
      chalk.red(`Unknown rule "${rule}". Known: ${RULE_IDS.join(", ")}, all`),
    );
    process.exitCode = 2;
    return;
  }
  const reason = options.reason?.trim() ?? "";
  if (reason === "") {
    console.error(
      chalk.red(
        "--reason is required: a suppression without a reason is a finding nobody will revisit.",
      ),
    );
    process.exitCode = 2;
    return;
  }

  const { spinner, onPhase } = scanSpinner();
  let result;
  try {
    result = await runScan({
      rootDir,
      store: false,
      onPhase,
      ...(rule !== null && isRuleId(rule) ? { onlyRules: [rule] } : {}),
    });
    spinner.succeed(`Scanned ${result.classifications.length} files`);
  } catch (error) {
    spinner.fail("Scan failed");
    if (error instanceof FrameworkNotDetectedError) {
      console.error(chalk.red(error.message));
      process.exitCode = 1;
      return;
    }
    throw error;
  }

  const targets = result.findings.filter(
    (finding) =>
      (rule === null || finding.ruleId === rule) &&
      (options.file === undefined ||
        path.relative(rootDir, finding.filePath).includes(options.file)),
  );
  console.log(chalk.blue.bold("antra fix"));
  console.log(chalk.gray(`project: ${rootDir}\n`));
  if (targets.length === 0) {
    const accepted = result.baselined.filter(
      (finding) => rule === null || finding.ruleId === rule,
    ).length;
    console.log(
      chalk.green(
        `✓ nothing to suppress — no new ${rule ?? ""} finding(s)${options.file ? ` in files matching "${options.file}"` : ""}.`,
      ),
    );
    if (accepted > 0) {
      console.log(
        chalk.gray(
          `  ${accepted} already accepted in the baseline — fix only touches new findings.`,
        ),
      );
    }
    return;
  }

  const edits = planSuppressions(targets, reason);
  for (const edit of edits) {
    console.log(
      `  ${chalk.bold(`${path.relative(rootDir, edit.filePath)}:${edit.line}`)}  ${chalk.cyan(edit.ruleIds.join(", "))}`,
    );
    console.log(chalk.gray(`    + ${edit.text.trim()}`));
  }

  if (options.dryRun) {
    console.log(
      chalk.yellow(
        `\nDry run — ${edits.length} comment(s) planned, nothing written. Drop --dry-run to apply.`,
      ),
    );
    return;
  }

  const { files, inserted } = await applySuppressionEdits(edits);
  console.log(
    chalk.green.bold(`\n✓ inserted ${inserted} comment(s) in ${files} file(s)`),
  );
  console.log(
    chalk.gray(
      "  Review the diff, then `antra scan` — these findings now report as suppressed.",
    ),
  );
}
