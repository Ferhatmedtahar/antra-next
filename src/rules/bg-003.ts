import type { SourceFile } from "ts-morph";

import { collectJsxSinks } from "../ast/render-graph.js";
import {
  findingAt,
  type Finding,
  type Rule,
  type RuleContext,
} from "./types.js";

/**
 * BG-003 opaque-object-pass: the raw, unprojected result of a fetch/DB call
 * is handed whole to a Client Component. Nobody picked fields, so whatever
 * the backend returns — today or after its next deploy — gets serialized to
 * the browser. Needs no schema at all, which makes it the workhorse rule in
 * zero-schema/BFF projects (ADR-002).
 */
export const bg003: Rule = {
  id: "BG-003",
  severity: "warning",
  description: "Unprojected fetch/DB result passed whole to a Client Component",

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
      const advice = "project the fields you need into a new object instead";

      for (const attribute of sink.attributes) {
        if (!attribute.value) continue;
        const taint = ctx.resolver.resolve(attribute.value);
        if (!taint?.opaque || taint.origin.kind !== "ingress") continue;
        findings.push(
          findingAt(
            bg003,
            attribute.node,
            `Unprojected result of ${taint.origin.call} is passed whole as prop "${attribute.name}" to client component ${tag} — ${advice}`,
            taint.trace,
          ),
        );
      }
      for (const spread of sink.spreads) {
        const taint = ctx.resolver.resolve(spread);
        if (!taint?.opaque || taint.origin.kind !== "ingress") continue;
        findings.push(
          findingAt(
            bg003,
            spread,
            `Unprojected result of ${taint.origin.call} is spread into client component ${tag} — ${advice}`,
            taint.trace,
          ),
        );
      }
    }
    return findings;
  },
};
