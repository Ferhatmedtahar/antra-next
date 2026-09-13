#!/usr/bin/env node
import { program } from "../dist/cli/index.js";

program.parseAsync().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
