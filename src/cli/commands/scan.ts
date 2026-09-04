import path from "path";

import chalk from "chalk";

import { runScan, type ScanResult } from "../../engine.js";
import { FrameworkNotDetectedError } from "../../framework/detect.js";

interface ScanOptions {
  strict?: boolean;
  diff?: boolean;
  staged?: boolean;
  failOnViolation?: boolean;
  format?: string;
  rule?: string;
}

export async function scanCommand(
  targetPath: string,
  options: ScanOptions,
): Promise<void> {
  const rootDir = path.resolve(targetPath);

  let result: ScanResult;
  try {
    result = await runScan({ rootDir });
  } catch (error) {
    if (error instanceof FrameworkNotDetectedError) {
      console.error(chalk.red(error.message));
      process.exitCode = 1;
      return;
    }
    throw error;
  }

  if (options.format === "json") {
    console.log(JSON.stringify(result, null, 2));
    return;
  }
  printSummary(result, rootDir);
}

function printSummary(result: ScanResult, rootDir: string): void {
  const relative = (filePath: string) => path.relative(rootDir, filePath);
  const clients = result.classifications.filter((c) => c.boundary === "client");
  const routes = result.classifications.filter((c) => c.isRouteHandler);
  const actions = result.classifications.flatMap((c) =>
    c.serverActions.map((action) => ({ file: c.filePath, ...action })),
  );

  console.log(chalk.blue.bold("boundary-guard scan"));
  console.log(chalk.gray(`project:   ${rootDir}`));
  console.log(chalk.gray(`framework: ${result.frameworkAdapter}\n`));

  console.log(`  files scanned:     ${result.classifications.length}`);
  console.log(`  client boundaries: ${clients.length}`);
  for (const c of clients)
    console.log(chalk.gray(`    ${relative(c.filePath)}`));
  console.log(`  server actions:    ${actions.length}`);
  for (const a of actions) {
    console.log(chalk.gray(`    ${relative(a.file)}:${a.line}  ${a.name}`));
  }
  console.log(`  route handlers:    ${routes.length}`);
  for (const r of routes) {
    console.log(
      chalk.gray(`    ${relative(r.filePath)}  [${r.routeMethods.join(", ")}]`),
    );
  }

  console.log(
    chalk.yellow(
      "\nClassification only — taint tracking and rules land in Epics 03–04.",
    ),
  );
}
