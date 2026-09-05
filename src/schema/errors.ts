/**
 * Thrown by a provider's extract() when its real ingestion logic hasn't
 * landed yet (Epic 03). `init` catches this specifically so it can report
 * "not supported yet" instead of crashing — any other error from extract()
 * is a genuine failure and is left to propagate.
 */
export class NotImplementedError extends Error {
  constructor(providerId: string) {
    super(`${providerId} extract() is not implemented yet (Epic 03)`);
    this.name = "NotImplementedError";
  }
}

/**
 * A configured provider failed to read its schema: a missing types file,
 * an unset environment variable, a rejected key, an unreachable project.
 * The commands catch this to print one clear line rather than a stack —
 * it is the user's configuration talking back, not a crash.
 */
export class SchemaExtractionError extends Error {
  constructor(
    readonly providerId: string,
    message: string,
    options?: { cause?: unknown },
  ) {
    super(`${providerId}: ${message}`, options);
    this.name = "SchemaExtractionError";
  }
}
