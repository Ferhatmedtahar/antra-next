import path from "path";

import chalk from "chalk";

import {
  DatabaseNotFoundError,
  describeSchema,
  formatCsv,
  formatTable,
  runQuery,
} from "../../storage/query.js";

interface QueryOptions {
  format?: string;
}

const EXAMPLES = [
  "SELECT id, started_at, findings, baselined FROM scans ORDER BY id DESC LIMIT 10",
  "SELECT rule_id, COUNT(*) AS n FROM findings WHERE scan_id = (SELECT MAX(id) FROM scans) GROUP BY rule_id",
  "SELECT file, line, message FROM findings WHERE status = 'active' AND scan_id = (SELECT MAX(id) FROM scans)",
  "SELECT path FROM files WHERE boundary = 'client' AND scan_id = (SELECT MAX(id) FROM scans)",
];

export function queryCommand(
  sql: string | undefined,
  targetPath = ".",
  options: QueryOptions = {},
): void {
  const rootDir = path.resolve(targetPath);
  const format = options.format ?? "table";
  if (format !== "table" && format !== "json" && format !== "csv") {
    console.error(
      chalk.red(`Unknown format "${format}". Known: table, json, csv`),
    );
    process.exitCode = 2;
    return;
  }

  try {
    if (sql === undefined || sql.trim() === "") {
      const tables = describeSchema(rootDir);
      console.log(chalk.blue.bold("boundary-guard query"));
      console.log(
        chalk.gray(`database: ${rootDir}/.boundary-guard/findings.sqlite\n`),
      );
      for (const table of tables) {
        console.log(
          `  ${chalk.bold(table.table)}  ${chalk.gray(table.columns.join(", "))}`,
        );
      }
      console.log(chalk.gray("\n  Examples:"));
      for (const example of EXAMPLES) {
        console.log(chalk.gray(`    boundary-guard query "${example}"`));
      }
      return;
    }

    const result = runQuery(rootDir, sql);
    if (format === "json") {
      console.log(
        JSON.stringify(
          result.rows.map((row) =>
            Object.fromEntries(
              result.columns.map((column, index) => [column, row[index]]),
            ),
          ),
          null,
          2,
        ),
      );
    } else if (format === "csv") {
      console.log(formatCsv(result));
    } else {
      console.log(formatTable(result));
      console.log(chalk.gray(`\n${result.rows.length} row(s)`));
    }
  } catch (error) {
    if (error instanceof DatabaseNotFoundError) {
      console.error(chalk.red(error.message));
      process.exitCode = 1;
      return;
    }
    if (error instanceof Error && error.name.startsWith("Sqlite")) {
      console.error(chalk.red(`SQL error: ${error.message}`));
      process.exitCode = 2;
      return;
    }
    if (error instanceof Error && /read queries/.test(error.message)) {
      console.error(chalk.red(error.message));
      process.exitCode = 2;
      return;
    }
    throw error;
  }
}
