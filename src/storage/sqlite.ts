import fs from "fs";
import { createRequire } from "node:module";

export interface SqliteRunResult {
  changes: number;
  lastInsertRowid: number | bigint;
}

export interface SqliteStatement<TRow = unknown> {
  run(...params: unknown[]): SqliteRunResult;
  all(...params: unknown[]): TRow[];
  get(...params: unknown[]): TRow | undefined;
  columns(): { name: string }[];
  allRaw(...params: unknown[]): unknown[][];
}

export interface SqliteDatabase {
  exec(sql: string): void;
  pragma(pragmaSql: string): void;
  prepare<TRow = unknown>(sql: string): SqliteStatement<TRow>;
  transaction<T>(fn: () => T): T;
  close(): void;
}

export interface OpenDatabaseOptions {
  readonly?: boolean;
  fileMustExist?: boolean;
}

interface RawStatement {
  run(...params: unknown[]): {
    changes?: number;
    lastInsertRowid?: number | bigint;
  };
  all(...params: unknown[]): unknown[];
  get(...params: unknown[]): unknown;
  columns(): { name: string }[];
  setReturnArrays?(value: boolean): void;
  raw?(value: boolean): { all(...params: unknown[]): unknown[][] };
}

interface RawDatabase {
  exec(sql: string): void;
  prepare(sql: string): RawStatement;
  transaction?(fn: () => unknown): () => unknown;
  pragma?(sql: string): void;
  close(): void;
}

type DatabaseConstructor = new (
  path: string,
  opts?: { readonly?: boolean; readOnly?: boolean; fileMustExist?: boolean },
) => RawDatabase;

function normalizeParams(params: unknown[]): unknown[] {
  if (params.length === 1 && Array.isArray(params[0])) {
    return params[0];
  }
  return params;
}

let warningSuppressed = false;
function suppressSqliteWarning(): void {
  if (warningSuppressed) return;
  warningSuppressed = true;
  const orig = process.emitWarning.bind(process);
  process.emitWarning = (
    warning: string | Error,
    ...args: [unknown?, unknown?, unknown?]
  ) => {
    if (typeof warning === "string" && warning.includes("SQLite")) return;
    if (
      warning &&
      typeof warning === "object" &&
      "message" in warning &&
      String(warning.message).includes("SQLite")
    ) {
      return;
    }
    Reflect.apply(orig, process, [warning, ...args]);
  };
}

function tryLoadNodeSqlite(): DatabaseConstructor | null {
  try {
    suppressSqliteWarning();
    const req = createRequire(import.meta.url);
    const mod = req("node:sqlite") as { DatabaseSync?: unknown };
    return typeof mod.DatabaseSync === "function"
      ? (mod.DatabaseSync as DatabaseConstructor)
      : null;
  } catch {
    return null;
  }
}

function tryLoadBetterSqlite3(): DatabaseConstructor | null {
  try {
    const req = createRequire(import.meta.url);
    const mod: unknown = req("better-sqlite3");
    if (typeof mod === "function") return mod as DatabaseConstructor;
    if (
      mod &&
      typeof mod === "object" &&
      "default" in mod &&
      typeof mod.default === "function"
    ) {
      return mod.default as DatabaseConstructor;
    }
    return null;
  } catch {
    return null;
  }
}

function wrapNodeSqlite(db: RawDatabase): SqliteDatabase {
  return {
    exec(sql: string) {
      db.exec(sql);
    },
    pragma(pragmaSql: string) {
      db.exec(`PRAGMA ${pragmaSql};`);
    },
    prepare<TRow = unknown>(sql: string): SqliteStatement<TRow> {
      const stmt = db.prepare(sql);
      return {
        run(...params: unknown[]): SqliteRunResult {
          const norm = normalizeParams(params);
          const res = stmt.run(...norm);
          return {
            changes: res.changes ?? 0,
            lastInsertRowid: res.lastInsertRowid ?? 0,
          };
        },
        all(...params: unknown[]): TRow[] {
          const norm = normalizeParams(params);
          return stmt.all(...norm) as TRow[];
        },
        get(...params: unknown[]): TRow | undefined {
          const norm = normalizeParams(params);
          return stmt.get(...norm) as TRow | undefined;
        },
        columns() {
          return stmt.columns();
        },
        allRaw(...params: unknown[]): unknown[][] {
          const norm = normalizeParams(params);
          if (typeof stmt.setReturnArrays === "function") {
            stmt.setReturnArrays(true);
            try {
              return stmt.all(...norm) as unknown[][];
            } finally {
              stmt.setReturnArrays(false);
            }
          }
          return stmt.all(...norm) as unknown[][];
        },
      };
    },
    transaction<T>(fn: () => T): T {
      db.exec("BEGIN");
      try {
        const result = fn();
        db.exec("COMMIT");
        return result;
      } catch (err) {
        try {
          db.exec("ROLLBACK");
        } catch {
          // ignore rollback failure
        }
        throw err;
      }
    },
    close() {
      db.close();
    },
  };
}

function wrapBetterSqlite3(db: RawDatabase): SqliteDatabase {
  return {
    exec(sql: string) {
      db.exec(sql);
    },
    pragma(pragmaSql: string) {
      if (typeof db.pragma === "function") {
        db.pragma(pragmaSql);
      } else {
        db.exec(`PRAGMA ${pragmaSql};`);
      }
    },
    prepare<TRow = unknown>(sql: string): SqliteStatement<TRow> {
      const stmt = db.prepare(sql);
      return {
        run(...params: unknown[]): SqliteRunResult {
          const norm = normalizeParams(params);
          const res = stmt.run(...norm);
          return {
            changes: res.changes ?? 0,
            lastInsertRowid: res.lastInsertRowid ?? 0,
          };
        },
        all(...params: unknown[]): TRow[] {
          const norm = normalizeParams(params);
          return stmt.all(...norm) as TRow[];
        },
        get(...params: unknown[]): TRow | undefined {
          const norm = normalizeParams(params);
          return stmt.get(...norm) as TRow | undefined;
        },
        columns() {
          return stmt.columns();
        },
        allRaw(...params: unknown[]): unknown[][] {
          const norm = normalizeParams(params);
          if (typeof stmt.raw === "function") {
            return stmt.raw(true).all(...norm);
          }
          return stmt.all(...norm) as unknown[][];
        },
      };
    },
    transaction<T>(fn: () => T): T {
      if (typeof db.transaction === "function") {
        const run = db.transaction(fn);
        return run() as T;
      }
      db.exec("BEGIN");
      try {
        const result = fn();
        db.exec("COMMIT");
        return result;
      } catch (err) {
        try {
          db.exec("ROLLBACK");
        } catch {
          // ignore rollback failure
        }
        throw err;
      }
    },
    close() {
      db.close();
    },
  };
}

export function openSqliteDatabase(
  filePath: string,
  options?: OpenDatabaseOptions,
): SqliteDatabase {
  if (options?.fileMustExist && !fs.existsSync(filePath)) {
    throw new Error(
      `Cannot open database because the file does not exist: ${filePath}`,
    );
  }

  // 1. Prefer Node built-in node:sqlite (Node >= 22.5.0) - zero native binding / node-gyp issues.
  const NodeSqlite = tryLoadNodeSqlite();
  if (NodeSqlite) {
    try {
      const instance = new NodeSqlite(filePath, {
        readOnly: options?.readonly ?? false,
      });
      return wrapNodeSqlite(instance);
    } catch (error) {
      // If node:sqlite failed to instantiate, proceed to try better-sqlite3 fallback
      if (options?.fileMustExist && !fs.existsSync(filePath)) {
        throw error;
      }
    }
  }

  // 2. Fall back to better-sqlite3 (e.g. Node 20)
  const BetterSqlite3 = tryLoadBetterSqlite3();
  if (BetterSqlite3) {
    try {
      const instance = new BetterSqlite3(filePath, {
        readonly: options?.readonly ?? false,
        fileMustExist: options?.fileMustExist ?? false,
      });
      return wrapBetterSqlite3(instance);
    } catch (error) {
      throw new Error(
        `Failed to open SQLite database at "${filePath}": ${error instanceof Error ? error.message : String(error)}. ` +
          `If this is a native binding issue, upgrade to Node >= 22.5 to use built-in SQLite or run "pnpm approve-builds".`,
      );
    }
  }

  throw new Error(
    `Antra requires SQLite support. Node.js >= 22.5 provides built-in SQLite without native addons. ` +
      `On older Node versions, better-sqlite3 with compiled native bindings is required.`,
  );
}
