import chalk from "chalk";

export function syncCommand(): void {
  console.log(chalk.blue.bold("boundary-guard sync"));
  console.log(chalk.yellow("Schema snapshot refresh not implemented yet."));
}
