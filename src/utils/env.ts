import fs from "fs";
import path from "path";

/**
 * Next.js's own load order, highest priority first. `.env.local` is the
 * one developers keep their real keys in, so it wins.
 */
const ENV_FILES = [
  ".env.local",
  ".env.development.local",
  ".env.development",
  ".env",
] as const;

const LINE = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/;

/** Strips matching quotes and a trailing `# comment` from an unquoted value. */
function parseValue(raw: string): string {
  const trimmed = raw.trim();
  const quote = trimmed[0];
  if (
    (quote === '"' || quote === "'" || quote === "`") &&
    trimmed.endsWith(quote) &&
    trimmed.length > 1
  ) {
    const inner = trimmed.slice(1, -1);
    return quote === "'" ? inner : inner.replace(/\\n/g, "\n");
  }
  return trimmed.replace(/\s+#.*$/, "").trim();
}

export function parseEnvFile(contents: string): Record<string, string> {
  const values: Record<string, string> = {};
  for (const line of contents.split(/\r?\n/)) {
    if (line.trim() === "" || line.trimStart().startsWith("#")) continue;
    const match = LINE.exec(line);
    const key = match?.[1];
    if (!key) continue;
    values[key] = parseValue(match?.[2] ?? "");
  }
  return values;
}

/**
 * The project's env files merged, then `process.env` on top — an exported
 * variable beats a file, same as at runtime. Values are read here and
 * never persisted: config and snapshot only ever hold variable *names*.
 */
export function readProjectEnv(
  rootDir: string,
  processEnv: NodeJS.ProcessEnv = process.env,
): Record<string, string> {
  const values: Record<string, string> = {};
  for (const file of [...ENV_FILES].reverse()) {
    const target = path.join(rootDir, file);
    if (!fs.existsSync(target)) continue;
    try {
      Object.assign(values, parseEnvFile(fs.readFileSync(target, "utf8")));
    } catch {
      // Unreadable env file: fall through to whatever else we can read.
    }
  }
  for (const [key, value] of Object.entries(processEnv)) {
    if (value !== undefined) values[key] = value;
  }
  return values;
}

/** The first candidate that has a non-empty value, with its name. */
export function findEnvVar(
  env: Readonly<Record<string, string>>,
  candidates: readonly string[],
): { name: string; value: string } | null {
  for (const name of candidates) {
    const value = env[name];
    if (value !== undefined && value.trim() !== "") {
      return { name, value: value.trim() };
    }
  }
  return null;
}

/** Never let a key reach a log line or an error message. */
export function redact(secret: string, text: string): string {
  return secret.length < 8 ? text : text.split(secret).join("[redacted]");
}
