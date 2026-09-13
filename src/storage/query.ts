import fs from "fs";

import Database from "better-sqlite3";

import { dbPath } from "./db.js";

export class DatabaseNotFoundError extends Error {
  constructor(filePath: string) {
    super(
      `${filePath} doesn't exist — run \`antra scan\` once to record a scan.`,
    );
    this.name = "DatabaseNotFoundError";
  }
}

export interface QueryResult {
  columns: string[];
  rows: unknown[][];
}

export interface TableInfo {
  table: string;
  columns: string[];
}

function openReadonly(rootDir: string): Database.Database {
  const file = dbPath(rootDir);
  if (!fs.existsSync(file)) throw new DatabaseNotFoundError(file);
  return new Database(file, { readonly: true, fileMustExist: true });
}

/** Ad-hoc SQL over antra-findings.sqlite. Read-only connection: writes throw. */
export function runQuery(rootDir: string, sql: string): QueryResult {
  const db = openReadonly(rootDir);
  try {
    const statement = db.prepare(sql);
    if (!statement.reader) {
      throw new Error("Only read queries are allowed (SELECT, WITH, PRAGMA).");
    }
    const columns = statement.columns().map((column) => column.name);
    const rows = statement.raw(true).all() as unknown[][];
    return { columns, rows };
  } finally {
    db.close();
  }
}

export function describeSchema(rootDir: string): TableInfo[] {
  const db = openReadonly(rootDir);
  try {
    const tables = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
      )
      .all() as { name: string }[];
    return tables.map(({ name }) => ({
      table: name,
      columns: (
        db.prepare(`PRAGMA table_info(${name})`).all() as { name: string }[]
      ).map((column) => column.name),
    }));
  } finally {
    db.close();
  }
}

/** SQLite hands back strings, numbers, bigints, buffers or null. */
function stringify(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (
    typeof value === "number" ||
    typeof value === "bigint" ||
    typeof value === "boolean"
  ) {
    return String(value);
  }
  if (value instanceof Uint8Array) return `<${value.byteLength} bytes>`;
  return JSON.stringify(value);
}

function cell(value: unknown, max: number): string {
  const single = stringify(value).replace(/\s+/g, " ");
  return single.length > max ? `${single.slice(0, max - 1)}…` : single;
}

/** Aligned columns, cells capped so a trace column doesn't eat the terminal. */
export function formatTable(result: QueryResult, maxWidth = 60): string {
  if (result.columns.length === 0) return "(no columns)";
  const grid = [
    result.columns,
    ...result.rows.map((row) => row.map((value) => cell(value, maxWidth))),
  ];
  const widths = result.columns.map((_, index) =>
    Math.max(...grid.map((row) => (row[index] ?? "").length)),
  );
  const line = (row: string[]) =>
    row.map((text, index) => text.padEnd(widths[index] ?? 0)).join("  ");
  return [
    line(grid[0] ?? []),
    widths.map((width) => "─".repeat(width)).join("  "),
    ...grid.slice(1).map(line),
  ].join("\n");
}

export function formatCsv(result: QueryResult): string {
  const escape = (value: unknown) => {
    const text = stringify(value);
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  return [result.columns, ...result.rows]
    .map((row) => row.map(escape).join(","))
    .join("\n");
}
