import type { SourceFile } from "ts-morph";

import { collectJsxSinks, describeOrigin } from "../ast/render-graph.js";
import {
  findingAt,
  type Finding,
  type Rule,
  type RuleContext,
} from "./types.js";

/**
 * BG-001 server-to-client-leak: a concrete sensitive value (schema field,
 * keyword-named field, or process.env) is handed to a Client Component as a
 * prop, spread, or children from a Server Component. That value crosses the
 * Flight boundary as serialized data the browser can read.
 */
export const bg001: Rule = {
  id: "BG-001",
  severity: "error",
  description: "Sensitive value passed to a Client Component from the server",

  run(file: SourceFile, ctx: RuleContext): Finding[] {
    if (ctx.classifications.get(file.getFilePath())?.boundary !== "server") {
      return [];
    }
    const findings: Finding[] = [];

    for (const sink of collectJsxSinks(file)) {
      if (sink.intrinsic || !sink.targetFilePath) continue;
      if (ctx.classifications.get(sink.targetFilePath)?.boundary !== "client") {
        continue;
      }
      const tag = `<${sink.tagName}>`;

      for (const attribute of sink.attributes) {
        if (!attribute.value) continue;
        const taint = ctx.resolver.resolve(attribute.value);
        if (!taint || taint.opaque) continue;
        findings.push(
          findingAt(
            bg001,
            attribute.node,
            `${capitalize(describeOrigin(taint.origin))} is passed as prop "${attribute.name}" to client component ${tag}`,
            taint.trace,
          ),
        );
      }
      for (const child of sink.children) {
        const taint = ctx.resolver.resolve(child);
        if (!taint || taint.opaque) continue;
        findings.push(
          findingAt(
            bg001,
            child,
            `${capitalize(describeOrigin(taint.origin))} is rendered as children of client component ${tag}`,
            taint.trace,
          ),
        );
      }
      for (const spread of sink.spreads) {
        const taint = ctx.resolver.resolve(spread);
        if (!taint || taint.opaque) continue;
        findings.push(
          findingAt(
            bg001,
            spread,
            `${capitalize(describeOrigin(taint.origin))} is spread into client component ${tag}`,
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
