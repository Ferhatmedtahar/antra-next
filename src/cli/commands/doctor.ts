import chalk from "chalk";

export function doctorCommand(): void {
  console.log(chalk.blue.bold("boundary-guard doctor"));
  console.log(chalk.yellow("Health checks not implemented yet."));
}
