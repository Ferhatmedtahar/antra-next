import type { SourceFile } from "ts-morph";

import {
  collectJsxSinks,
  collectResponseSinks,
  describeSink,
  type Taint,
} from "../ast/render-graph.js";
import {
  findingAt,
  type Finding,
  type Rule,
  type RuleContext,
} from "./types.js";

const ADVICE = "project the fields you need into a new object instead";

function unprojected(taint: Taint | null): taint is Taint & {
  origin: { kind: "ingress"; call: string };
} {
  return taint?.opaque === true && taint.origin.kind === "ingress";
}

/**
 * BG-003 opaque-object-pass: the raw, unprojected result of a fetch/DB call
 * is handed whole to the client — as a Client Component prop, a Server
 * Action's return value, or a route handler's response body. Nobody picked
 * fields, so whatever the backend returns — today or after its next deploy
 * — gets serialized to the browser. Needs no schema at all, which makes it
 * the workhorse rule in zero-schema/BFF projects (ADR-002).
 */
export const bg003: Rule = {
  id: "BG-003",
  severity: "warning",
  description:
    "Unprojected fetch/DB result sent whole to the client (Client Component prop, Server Action return, route response)",

  run(file: SourceFile, ctx: RuleContext): Finding[] {
    const classification = ctx.classifications.get(file.getFilePath());
    if (classification?.boundary !== "server") return [];
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
        if (!unprojected(taint)) continue;
        findings.push(
          findingAt(
            bg003,
            attribute.node,
            `Unprojected result of ${taint.origin.call} is passed whole as prop "${attribute.name}" to client component ${tag} — ${ADVICE}`,
            taint.trace,
          ),
        );
      }
      for (const spread of sink.spreads) {
        const taint = ctx.resolver.resolve(spread);
        if (!unprojected(taint)) continue;
        findings.push(
          findingAt(
            bg003,
            spread,
            `Unprojected result of ${taint.origin.call} is spread into client component ${tag} — ${ADVICE}`,
            taint.trace,
          ),
        );
      }
    }

    for (const sink of collectResponseSinks(file, classification)) {
      const taint = ctx.resolver.resolve(sink.node);
      if (!unprojected(taint)) continue;
      findings.push(
        findingAt(
          bg003,
          sink.node,
          `Unprojected result of ${taint.origin.call} is ${describeSink(sink, true)} — ${ADVICE}`,
          taint.trace,
        ),
      );
    }
    return findings;
  },
};
