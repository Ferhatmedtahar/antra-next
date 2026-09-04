import chalk from "chalk";

interface ScanOptions {
  strict?: boolean;
  diff?: boolean;
  staged?: boolean;
  failOnViolation?: boolean;
  format?: string;
  rule?: string;
}

export function scanCommand(path: string, options: ScanOptions): void {
  console.log(chalk.blue.bold("boundary-guard scan"));
  console.log(chalk.gray(`target: ${path}`), options);
  console.log(
    chalk.yellow("Engine pipeline not wired yet — no findings to report."),
  );
}
