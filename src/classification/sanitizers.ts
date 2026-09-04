/** Given a call's callee text (`schema.parse`, `v.safeParse`), does it validate? */
export type SanitizerMatcher = (calleeText: string) => boolean;

/** Callee shapes per known validator; anything else in config is treated as a function/method name. */
const KNOWN: Record<string, readonly RegExp[]> = {
  zod: [/\.(?:parse|safeParse|parseAsync|safeParseAsync)$/],
  valibot: [/(?:^|\.)(?:parse|safeParse|parseAsync|safeParseAsync)$/],
  yup: [/\.(?:validate|validateSync|cast)$/],
  joi: [/\.(?:validate|validateAsync)$/],
  arktype: [/\.assert$/],
  "next-safe-action": [/\.(?:schema|inputSchema|bindArgsSchemas)$/],
};

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Builds the sanitizer gate from `config.sanitizers` (FR7). A matching call
 * breaks the taint chain in the render graph and counts as validation for
 * BG-002.
 */
export function createSanitizerMatcher(
  names: readonly string[],
): SanitizerMatcher {
  const patterns = names.flatMap(
    (name) => KNOWN[name] ?? [new RegExp(`(?:^|\\.)${escapeRegExp(name)}$`)],
  );
  return (calleeText) =>
    // JSON.parse is deserialization, not validation — never a sanitizer.
    !calleeText.startsWith("JSON.") &&
    patterns.some((pattern) => pattern.test(calleeText));
}
