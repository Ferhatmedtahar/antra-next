import { describe, expect, it } from "vitest";

import type { Finding } from "../../src/rules/index.js";
import { applySuppressions } from "../../src/suppressions/suppressions.js";

const finding = (
  line: number,
  ruleId: Finding["ruleId"] = "BG-001",
): Finding => ({
  ruleId,
  severity: "error",
  message: "m",
  filePath: "/p/a.tsx",
  line,
  column: 1,
  snippet: "",
  trace: [],
});

describe("applySuppressions", () => {
  const source = [
    "const a = 1;", // 1
    '// boundary-guard-disable-next-line BG-001 reason="public token"', // 2
    "<C token={x} />", // 3 suppressed BG-001
    "<C token={y} />", // 4 not suppressed
    "{/* boundary-guard-disable-next-line */}", // 5
    "<C token={z} />", // 6 suppressed any rule
    "<C token={w} /> // boundary-guard-disable-line BG-003", // 7 only BG-003
    "// boundary-guard-disable-next-line BG-002, BG-003 reason='batch'", // 8
    "<C token={v} />", // 9
  ].join("\n");
  const getText = () => source;

  it("suppresses by next-line directive, rule-scoped or not, keeping the reason", () => {
    const { active, suppressed } = applySuppressions(
      [finding(3), finding(4), finding(6, "BG-004")],
      getText,
    );
    expect(active.map((f) => f.line)).toEqual([4]);
    expect(suppressed.map((f) => [f.line, f.suppressed?.reason])).toEqual([
      [3, "public token"],
      [6, null],
    ]);
  });

  it("respects rule lists on same-line and multi-rule directives", () => {
    const { active, suppressed } = applySuppressions(
      [
        finding(7, "BG-001"),
        finding(7, "BG-003"),
        finding(9, "BG-001"),
        finding(9, "BG-003"),
      ],
      getText,
    );
    expect(active.map((f) => `${f.ruleId}:${f.line}`)).toEqual([
      "BG-001:7",
      "BG-001:9",
    ]);
    expect(
      suppressed.map((f) => `${f.ruleId}:${f.line}:${f.suppressed?.reason}`),
    ).toEqual(["BG-003:7:null", "BG-003:9:batch"]);
  });

  it("leaves everything active when the file text is unavailable", () => {
    const { active, suppressed } = applySuppressions(
      [finding(3)],
      () => undefined,
    );
    expect(active).toHaveLength(1);
    expect(suppressed).toHaveLength(0);
  });
});
