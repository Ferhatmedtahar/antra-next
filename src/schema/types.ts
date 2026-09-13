/**
 * One sensitive field and where we learned about it — e.g.
 * { field: "password_hash", origin: "prisma:User.password_hash" }.
 */
export interface TaintSource {
  field: string;
  origin: string;
}

/**
 * One question `init` asks the user to configure a provider. `key` becomes
 * the property name in that provider's config object.
 */
export interface ProviderConfigField {
  key: string;
  message: string;
  defaultValue: string;
}

export interface SchemaProvider {
  readonly id: string;
  /** Human-readable name shown in the `init` checkbox. */
  readonly label: string;
  /**
   * npm packages whose presence in package.json hints this provider is
   * relevant even when detect() finds no file — lets `init` say "found
   * Supabase but no generated types file" instead of silently skipping.
   */
  readonly dependencyPackages?: readonly string[];
  /** Cheap filesystem presence check. Never prompts, never parses. */
  detect(rootDir: string): Promise<boolean>;
  /** What to ask the user, with defaults prefilled from whatever detect() located. */
  configFields(rootDir: string): Promise<ProviderConfigField[]>;
  /**
   * Whether `config` would give extract() something real to work with.
   *
   * Counting keys is not enough: `{ id, schema: "public" }` has two keys and
   * still extracts nothing, and a `typesPath` pointing at a file that isn't
   * there reads as configured right up until extract() throws. `init` asks
   * this before writing the entry, so a half-answered provider becomes an
   * explicit "continue without it?" instead of a crash far from the prompt.
   *
   * Optional — providers that don't implement it keep the older
   * "more than just an id" rule.
   */
  isViable?(rootDir: string, config: unknown): boolean | Promise<boolean>;
  /** Real ingestion. Throws NotImplementedError until Epic 03 lands for that provider. */
  extract(rootDir: string, config: unknown): Promise<TaintSource[]>;
}
