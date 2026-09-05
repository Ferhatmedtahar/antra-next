import { afterEach, describe, expect, it } from "vitest";

import { runScan } from "../../../src/engine.js";
import {
  DatabaseNotFoundError,
  describeSchema,
  formatCsv,
  formatTable,
  runQuery,
} from "../../../src/storage/query.js";
import { copyFixture, type TempProject } from "../../helpers/fixture.js";

describe("query", () => {
  let project: TempProject | undefined;

  afterEach(() => {
    project?.cleanup();
    project = undefined;
  });

  it("reads the recorded scan, refuses writes, and describes the schema", async () => {
    project = copyFixture("rules-app");
    const scan = await runScan({ rootDir: project.dir });

    const result = runQuery(
      project.dir,
      "SELECT rule_id, COUNT(*) AS n FROM findings WHERE scan_id = ? GROUP BY rule_id ORDER BY rule_id".replace(
        "?",
        String(scan.scanId),
      ),
    );
    expect(result.columns).toEqual(["rule_id", "n"]);
    expect(result.rows.length).toBeGreaterThan(0);
    expect(result.rows.map((row) => row[0])).toContain("BG-001");

    expect(() => runQuery(project?.dir ?? "", "DELETE FROM findings")).toThrow(
      /read/i,
    );
    expect(() => runQuery(project?.dir ?? "", "SELECT * FROM nope")).toThrow(
      /no such table/,
    );

    expect(describeSchema(project.dir).map((table) => table.table)).toEqual([
      "edges",
      "files",
      "findings",
      "scans",
      "taint_sources",
    ]);
  });

  it("throws DatabaseNotFoundError before any scan", () => {
    project = copyFixture("rules-app");
    expect(() => runQuery(project?.dir ?? "", "SELECT 1")).toThrow(
      DatabaseNotFoundError,
    );
  });

  it("formats aligned tables and CSV with escaping", () => {
    const result = {
      columns: ["id", "message"],
      rows: [
        [1, 'has "quotes", commas'],
        [22, "x".repeat(80)],
      ],
    };
    const table = formatTable(result, 20);
    expect(table.split("\n")[0]).toBe("id  message             ");
    expect(table).toContain("22  xxxxxxxxxxxxxxxxxxx…");
    expect(formatCsv(result).split("\n")[1]).toBe('1,"has ""quotes"", commas"');
  });
});
