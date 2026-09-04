import type { SourceFile } from "ts-morph";

import { collectJsxSinks, describeOrigin } from "../ast/render-graph.js";
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

    for (const sink of collectJsxSinks(file)) {
      if (!sink.intrinsic) continue;
      const tag = `<${sink.tagName}>`;

      for (const attribute of sink.attributes) {
        if (!attribute.value) continue;
        const taint = ctx.resolver.resolve(attribute.value);
        if (!taint || taint.opaque) continue;
        findings.push(
          findingAt(
            bg004,
            attribute.node,
            `${capitalize(describeOrigin(taint.origin))} is rendered into attribute "${attribute.name}" of ${tag}`,
            taint.trace,
          ),
        );
      }
      for (const child of sink.children) {
        const taint = ctx.resolver.resolve(child);
        if (!taint || taint.opaque) continue;
        findings.push(
          findingAt(
            bg004,
            child,
            `${capitalize(describeOrigin(taint.origin))} is rendered as text inside ${tag}`,
            taint.trace,
          ),
        );
      }
    }
    return findings;
  },
};

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
