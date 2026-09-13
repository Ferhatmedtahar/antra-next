import { pathToFileURL } from "node:url";

import { Command } from "commander";

import { baselineCommand } from "./commands/baseline.js";
import { doctorCommand } from "./commands/doctor.js";
import { fixCommand } from "./commands/fix.js";
import { initCommand } from "./commands/init.js";
import { queryCommand } from "./commands/query.js";
import { scanCommand } from "./commands/scan.js";
import { studioCommand } from "./commands/studio.js";
import { syncCommand } from "./commands/sync.js";
import { traceCommand } from "./commands/trace.js";
import { watchCommand } from "./commands/watch.js";

export const program = new Command();

program
  .name("antra")
  .description(
    "AST-based static analysis security linter for React Server Components and the Next.js App Router.",
  )
  .version("0.1.0");

program
  .command("init")
  .description("Initialize config, introspect DB, and generate schema snapshot")
  .argument("[path]", "Next.js app root to configure", ".")
  .action(initCommand);

program
  .command("scan")
  .description("Run static AST taint analysis across React Flight boundaries")
  .argument("[path]", "path to scan", ".")
  .option("-s, --strict", "treat warnings as errors, require valid schema")
  .option("--diff", "only scan files changed relative to the base branch")
  .option("--staged", "only scan git-staged files")
  .option(
    "--base <ref>",
    "base ref for --diff (default: origin/main, main, origin/master, master)",
  )
  .option(
    "--fail-on-violation",
    "exit 1 if unsanitized boundary leaks are found",
  )
  .option("--format <type>", "output format: pretty | json | sarif", "pretty")
  .option("--rule <ruleId>", "run only the given rule, e.g. BG-001")
  .option("--verbose", "print every file instead of the first 10 per section")
  .option("--output <file>", "write the report to a file instead of stdout")
  .option(
    "--no-store",
    "don't record this scan in .antra/antra-findings.sqlite",
  )
  .action(scanCommand);

program
  .command("sync")
  .description("Refresh the static schema snapshot from DB/Prisma/Supabase")
  .argument("[path]", "Next.js app root", ".")
  .action(syncCommand);

program
  .command("doctor")
  .description("Validate configuration, rules, and parser readiness")
  .argument("[path]", "Next.js app root", ".")
  .option("--format <type>", "output format: pretty | json", "pretty")
  .action(doctorCommand);

program
  .command("baseline")
  .description("Record current violations so only new leaks trigger warnings")
  .argument("[path]", "Next.js app root", ".")
  .action(baselineCommand);

program
  .command("trace")
  .description("Print the full dataflow path from DB source to client sink")
  .argument("<target>", "file or file:line to trace, e.g. app/page.tsx:85")
  .argument("[path]", "Next.js app root", ".")
  .option("--format <type>", "output format: pretty | json", "pretty")
  .action(traceCommand);

program
  .command("watch")
  .description("Run continuous analysis on local file changes")
  .argument("[path]", "Next.js app root", ".")
  .option("--full", "rescan the whole project on every change")
  .option("--rule <ruleId>", "run only the given rule, e.g. BG-001")
  .action(watchCommand);

program
  .command("fix")
  .description(
    "Apply mechanical remediations: today, reasoned suppression comments",
  )
  .argument("[path]", "Next.js app root", ".")
  .option("--suppress <rule>", "rule id (BG-001 … BG-004) or all")
  .option("--reason <text>", "recorded in every inserted comment")
  .option("--file <fragment>", "only files whose path contains this")
  .option("--dry-run", "print the planned edits, write nothing")
  .action(fixCommand);

program
  .command("query")
  .description("Query the local SQLite analysis database")
  .argument("[sql]", "read-only SQL; omit to print the schema and examples")
  .argument("[path]", "Next.js app root", ".")
  .option("--format <type>", "output format: table | json | csv", "table")
  .action(queryCommand);

program
  .command("studio")
  .description("Launch the local web dashboard over antra-findings.sqlite")
  .argument("[path]", "Next.js app root", ".")
  .option("--port <port>", "port to listen on (localhost only)", "8080")
  .option("--no-open", "don't open the browser")
  .action(studioCommand);

const isMainModule =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMainModule) {
  program.parseAsync().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
