import type { SourceFile } from "ts-morph";

import {
  collectJsxSinks,
  describeSubject,
  type Taint,
} from "../ast/render-graph.js";
import {
  findingAt,
  type Finding,
  type Rule,
  type RuleContext,
} from "./types.js";

/**
 * BG-004 secret-in-markup: a concrete sensitive value is interpolated into
 * an intrinsic element (`<p>{user.password_hash}</p>`, `<div data-x={key}>`).
 * No boundary crossing needed — it ends up as visible text or an attribute
 * in the HTML. Distinct from BG-001, which is about structured prop data.
 */
export const bg004: Rule = {
  id: "BG-004",
  severity: "error",
  description: "Sensitive value rendered directly into markup",

  run(file: SourceFile, ctx: RuleContext): Finding[] {
    const findings: Finding[] = [];
    // In the browser, a non-public env var is undefined and a schema-named
    // property is usually form state — only a traced source counts there.
    const isClient =
      ctx.classifications.get(file.getFilePath())?.boundary === "client";
    const resolve = (node: Parameters<typeof ctx.resolver.resolve>[0]) => {
      const taint = ctx.resolver.resolve(node, { requireProvenance: isClient });
      return isConcreteLeak(taint, isClient) ? taint : null;
    };

    for (const sink of collectJsxSinks(file)) {
      if (!sink.intrinsic) continue;
      const tag = `<${sink.tagName}>`;

      for (const attribute of sink.attributes) {
        if (!attribute.value) continue;
        const taint = resolve(attribute.value);
        if (!taint) continue;
        findings.push(
          findingAt(
            bg004,
            attribute.node,
            `${describeSubject(taint.origin)} is rendered into attribute "${attribute.name}" of ${tag}`,
            taint.trace,
          ),
        );
      }
      for (const child of sink.children) {
        const taint = resolve(child);
        if (!taint) continue;
        findings.push(
          findingAt(
            bg004,
            child,
            `${describeSubject(taint.origin)} is rendered as text inside ${tag}`,
            taint.trace,
          ),
        );
      }
    }
    return findings;
  },
};

function isConcreteLeak(
  taint: Taint | null,
  isClient: boolean,
): taint is Taint {
  if (!taint || taint.opaque) return false;
  return !(isClient && taint.origin.kind === "env");
}
