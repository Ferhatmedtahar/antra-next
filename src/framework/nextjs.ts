import fs from "fs";
import path from "path";

import { hasDependency, readPackageJson } from "../utils/package-json.js";
import type { FrameworkAdapter } from "./types.js";

const CONFIG_EXTENSIONS = ["js", "ts", "mjs", "cjs"] as const;

function hasNextConfig(rootDir: string): boolean {
  return CONFIG_EXTENSIONS.some((ext) =>
    fs.existsSync(path.join(rootDir, `next.config.${ext}`)),
  );
}

function hasAppRouterDir(rootDir: string): boolean {
  return (
    fs.existsSync(path.join(rootDir, "app")) ||
    fs.existsSync(path.join(rootDir, "src", "app"))
  );
}

interface NextjsAdapter extends FrameworkAdapter {
  id: "nextjs-app-router";
}

export const nextjsAdapter: NextjsAdapter = {
  id: "nextjs-app-router",

  async detect(rootDir: string) {
    if (!hasNextConfig(rootDir)) return false;
    if (!hasAppRouterDir(rootDir)) return false;
    return hasDependency(await readPackageJson(rootDir), "next");
  },

  findSourceRoot(rootDir: string) {
    const srcAppDir = path.join(rootDir, "src", "app");
    if (fs.existsSync(srcAppDir)) {
      return srcAppDir;
    }
    return path.join(rootDir, "app");
  },
};
