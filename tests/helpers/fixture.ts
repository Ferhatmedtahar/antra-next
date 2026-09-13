import fs from "fs";
import os from "os";
import path from "path";

export interface TempProject {
  dir: string;
  cleanup(): void;
}

/** Creates a throwaway project directory from a { relativePath: content } map. */
export function makeTempProject(
  files: Record<string, string> = {},
): TempProject {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "antra-"));
  for (const [relativePath, content] of Object.entries(files)) {
    const absolute = path.join(dir, relativePath);
    fs.mkdirSync(path.dirname(absolute), { recursive: true });
    fs.writeFileSync(absolute, content);
  }
  return {
    dir,
    cleanup: () => fs.rmSync(dir, { recursive: true, force: true }),
  };
}

/** Copies `tests/fixtures/<name>` into a throwaway directory. */
export function copyFixture(name: string): TempProject {
  const source = path.join(
    path.dirname(new URL(import.meta.url).pathname),
    "..",
    "fixtures",
    name,
  );
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `antra-${name}-`));
  fs.cpSync(source, dir, { recursive: true });
  return {
    dir,
    cleanup: () => fs.rmSync(dir, { recursive: true, force: true }),
  };
}

/** Minimal Next.js App Router project, plain `app/` layout. */
export const NEXT_APP_FILES: Record<string, string> = {
  "package.json": JSON.stringify({ dependencies: { next: "^15.0.0" } }),
  "next.config.mjs": "export default {};\n",
  "app/page.tsx": "export default function Page() { return null; }\n",
};
