import { createHash } from "crypto";
import fs from "fs";
import path from "path";

import { z } from "zod";

import { SNAPSHOT_DIR } from "../config/write.js";
import type { Finding } from "../rules/types.js";

export const BASELINE_FILENAME = "baseline.json";

export function baselinePath(rootDir: string): string {
  return path.join(rootDir, SNAPSHOT_DIR, BASELINE_FILENAME);
}

const baselineSchema = z.object({
  generatedAt: z.string(),
  fingerprints: z.array(z.string()),
});
export type Baseline = z.infer<typeof baselineSchema>;

/**
 * Stable identity for a finding: rule + relative file + sink text, plus an
 * ordinal for repeats of the same sink in one file. Line numbers are
 * deliberately excluded so edits elsewhere in the file don't turn a known
 * finding into a "new" one.
 */
export function assignFingerprints(
  findings: readonly Finding[],
  rootDir: string,
): Finding[] {
  const seen = new Map<string, number>();
  return findings.map((finding) => {
    const key = [
      finding.ruleId,
      path.relative(rootDir, finding.filePath),
      finding.snippet,
    ].join("\n");
    const ordinal = seen.get(key) ?? 0;
    seen.set(key, ordinal + 1);
    const fingerprint = createHash("sha256")
      .update(`${key}\n#${ordinal}`)
      .digest("hex")
      .slice(0, 16);
    return { ...finding, fingerprint };
  });
}

/** null when the project has no baseline yet. */
export async function loadBaseline(rootDir: string): Promise<Baseline | null> {
  const target = baselinePath(rootDir);
  if (!fs.existsSync(target)) return null;
  const raw: unknown = JSON.parse(await fs.promises.readFile(target, "utf8"));
  return baselineSchema.parse(raw);
}

export async function writeBaseline(
  rootDir: string,
  fingerprints: readonly string[],
): Promise<string> {
  const target = baselinePath(rootDir);
  await fs.promises.mkdir(path.dirname(target), { recursive: true });
  const baseline: Baseline = {
    generatedAt: new Date().toISOString(),
    fingerprints: [...new Set(fingerprints)].sort(),
  };
  await fs.promises.writeFile(
    target,
    `${JSON.stringify(baseline, null, 2)}\n`,
    "utf8",
  );
  return target;
}

/** Findings whose fingerprint is in the baseline are pre-existing, not new. */
export function splitBaselined(
  findings: readonly Finding[],
  baseline: Baseline | null,
): { active: Finding[]; baselined: Finding[] } {
  if (!baseline) return { active: [...findings], baselined: [] };
  const known = new Set(baseline.fingerprints);
  const active: Finding[] = [];
  const baselined: Finding[] = [];
  for (const finding of findings) {
    (finding.fingerprint && known.has(finding.fingerprint)
      ? baselined
      : active
    ).push(finding);
  }
  return { active, baselined };
}
