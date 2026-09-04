import chalk from "chalk";

export function traceCommand(target: string): void {
  console.log(chalk.blue.bold("boundary-guard trace"));
  console.log(chalk.gray(`target: ${target}`));
  console.log(chalk.yellow("Dataflow trace not implemented yet."));
}
