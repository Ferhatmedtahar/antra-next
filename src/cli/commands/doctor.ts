import path from "path";

import chalk from "chalk";

import { runDoctor, type CheckStatus } from "../../doctor/doctor.js";

interface DoctorOptions {
  format?: string;
}

const GLYPH: Record<CheckStatus, string> = {
  ok: chalk.green("✓"),
  warn: chalk.yellow("!"),
  fail: chalk.red("✖"),
};

export async function doctorCommand(
  targetPath: string,
  options: DoctorOptions = {},
): Promise<void> {
  const rootDir = path.resolve(targetPath);
  const report = await runDoctor(rootDir);

  if (options.format === "json") {
    console.log(JSON.stringify(report, null, 2));
  } else if (options.format !== undefined && options.format !== "pretty") {
    console.error(
      chalk.red(`Unknown format "${options.format}". Known: pretty, json`),
    );
    process.exitCode = 2;
    return;
  } else {
    console.log(chalk.blue.bold("boundary-guard doctor"));
    console.log(chalk.gray(`project: ${rootDir}\n`));
    const width = Math.max(...report.checks.map((check) => check.label.length));
    for (const check of report.checks) {
      const label = check.label.padEnd(width);
      const detail =
        check.status === "fail"
          ? chalk.red(check.detail)
          : check.status === "warn"
            ? chalk.yellow(check.detail)
            : check.detail;
      console.log(`  ${GLYPH[check.status]} ${label}  ${detail}`);
      if (check.hint && check.status !== "ok") {
        console.log(chalk.gray(`    ${" ".repeat(width)}  → ${check.hint}`));
      }
    }
    const summary = `${report.ok} ok · ${report.warn} warning(s) · ${report.fail} failed`;
    console.log(
      "\n" +
        (report.healthy
          ? chalk.green.bold(`✓ ${summary} — ready to scan`)
          : chalk.red.bold(`✖ ${summary} — fix the ✖ lines first`)),
    );
  }

  if (!report.healthy) process.exitCode = 1;
}
