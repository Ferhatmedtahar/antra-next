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
