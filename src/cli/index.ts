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
  .name("boundary-guard")
  .description(
    "AST-based static analysis security linter for React Server Components and the Next.js App Router.",
  )
  .version("0.1.0");

program
  .command("init")
  .description("Initialize config, introspect DB, and generate schema snapshot")
  .action(initCommand);

program
  .command("scan")
  .description("Run static AST taint analysis across React Flight boundaries")
  .argument("[path]", "path to scan", ".")
  .option("-s, --strict", "treat warnings as errors, require valid schema")
  .option("--diff", "only scan files changed relative to the base branch")
  .option("--staged", "only scan git-staged files")
  .option(
    "--fail-on-violation",
    "exit 1 if unsanitized boundary leaks are found",
  )
  .option("--format <type>", "output format: pretty | json | sarif", "pretty")
  .option("--rule <ruleId>", "run only the given rule, e.g. BG-001")
  .action(scanCommand);

program
  .command("sync")
  .description("Refresh the static schema snapshot from DB/Prisma/Supabase")
  .action(syncCommand);

program
  .command("doctor")
  .description("Validate configuration, rules, and parser readiness")
  .action(doctorCommand);

program
  .command("baseline")
  .description("Record current violations so only new leaks trigger warnings")
  .action(baselineCommand);

program
  .command("trace")
  .description("Print the full dataflow path from DB source to client sink")
  .argument("<target>", "file:line to trace, e.g. UserCard.tsx:85")
  .action(traceCommand);

program
  .command("watch")
  .description("Run continuous analysis on local file changes")
  .action(watchCommand);

program
  .command("fix")
  .description("Auto-scaffold action validators and clean destructured props")
  .action(fixCommand);

program
  .command("query")
  .description("Query the local SQLite analysis database")
  .action(queryCommand);

program
  .command("studio")
  .description("Launch the local web dashboard over findings.sqlite")
  .action(studioCommand);

const isMainModule =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMainModule) {
  program.parse();
}
