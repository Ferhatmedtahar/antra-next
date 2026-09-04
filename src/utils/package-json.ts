import fs from "fs";
import path from "path";

import { z } from "zod";

const packageJsonSchema = z.object({
  name: z.string().optional(),
  dependencies: z.record(z.string(), z.string()).optional(),
  devDependencies: z.record(z.string(), z.string()).optional(),
});

export type PackageJson = z.infer<typeof packageJsonSchema>;

/**
 * Reads and validates `<rootDir>/package.json`. Returns null when the file
 * is missing or isn't valid JSON/shape — callers treat that as "no
 * evidence", never as an error.
 */
export async function readPackageJson(
  rootDir: string,
): Promise<PackageJson | null> {
  const packageJsonPath = path.join(rootDir, "package.json");
  if (!fs.existsSync(packageJsonPath)) return null;

  try {
    const raw = await fs.promises.readFile(packageJsonPath, "utf8");
    const parsed = packageJsonSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export function hasDependency(
  packageJson: PackageJson | null,
  ...names: readonly string[]
): boolean {
  if (!packageJson) return false;
  return names.some(
    (name) =>
      name in (packageJson.dependencies ?? {}) ||
      name in (packageJson.devDependencies ?? {}),
  );
}
