import { frameworkAdapters } from "./index.js";
import type { FrameworkAdapter } from "./types.js";

export class FrameworkNotDetectedError extends Error {
  constructor(rootDir: string) {
    super(
      `${rootDir} doesn't look like a Next.js App Router project ` +
        "(expected next.config.*, an app/ or src/app/ directory, and next in package.json). " +
        "antra v1 supports nothing else.",
    );
    this.name = "FrameworkNotDetectedError";
  }
}

/** First adapter whose detect() matches, or null. */
export async function detectFramework(
  rootDir: string,
  adapters: readonly FrameworkAdapter[] = frameworkAdapters,
): Promise<FrameworkAdapter | null> {
  for (const adapter of adapters) {
    if (await adapter.detect(rootDir)) return adapter;
  }
  return null;
}

/** Like detectFramework, but throws FrameworkNotDetectedError instead of returning null. */
export async function requireFramework(
  rootDir: string,
  adapters: readonly FrameworkAdapter[] = frameworkAdapters,
): Promise<FrameworkAdapter> {
  const adapter = await detectFramework(rootDir, adapters);
  if (!adapter) throw new FrameworkNotDetectedError(rootDir);
  return adapter;
}
