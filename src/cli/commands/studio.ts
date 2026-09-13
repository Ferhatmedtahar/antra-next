import path from "path";

import chalk from "chalk";

import {
  FrameworkNotDetectedError,
  requireFramework,
} from "../../framework/detect.js";
import { resolveAssetsDir, startStudio } from "../../studio/server.js";

interface StudioOptions {
  port?: string;
  /** commander's --no-open → false; absent → true. */
  open?: boolean;
}

export async function studioCommand(
  targetPath: string,
  options: StudioOptions,
): Promise<void> {
  const rootDir = path.resolve(targetPath);
  const port = Number(options.port ?? 8080);
  if (!Number.isInteger(port) || port <= 0) {
    console.error(chalk.red(`Invalid port "${options.port ?? ""}"`));
    process.exitCode = 2;
    return;
  }

  try {
    await requireFramework(rootDir);
  } catch (error) {
    if (error instanceof FrameworkNotDetectedError) {
      console.error(chalk.red(error.message));
      process.exitCode = 1;
      return;
    }
    throw error;
  }

  if (!resolveAssetsDir()) {
    console.error(
      chalk.red(
        "Studio assets are not built. Run `pnpm build:studio` in antra first.",
      ),
    );
    process.exitCode = 1;
    return;
  }

  const { url } = await startStudio({
    rootDir,
    port,
    open: options.open !== false,
  });
  console.log(chalk.blue.bold("antra studio"));
  console.log(chalk.gray(`project: ${rootDir}`));
  console.log(
    `\n  ${chalk.green("➜")}  ${url}   ${chalk.gray("(localhost only · Ctrl+C to stop)")}\n`,
  );
}
