import { nextjsAdapter } from "./nextjs.js";
import type { FrameworkAdapter } from "./types.js";

/** All known framework adapters. v1 ships exactly one (see ADR/Epic 01). */
export const frameworkAdapters: readonly FrameworkAdapter[] = [nextjsAdapter];
