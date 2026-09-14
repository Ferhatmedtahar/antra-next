import type { SourceFile } from "ts-morph";

import {
  collectJsxSinks,
  collectResponseSinks,
  describeSink,
  describeSubject,
} from "../ast/render-graph.js";
import {
  findingAt,
  type Finding,
  type Rule,
  type RuleContext,
} from "./types.js";

/**
 * BG-001 server-to-client-leak: a concrete sensitive value (schema field,
 * keyword-named field, or env var) leaves the server readable by the
 * browser — as a Client Component prop, spread or children, as a Server
 * Action's return value, or in a route handler's response body.
 */
export const bg001: Rule = {
  id: "BG-001",
  severity: "error",
  description:
    "Sensitive value crosses to the client (Client Component prop, Server Action return, route response)",

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
        if (!taint || taint.opaque) continue;
        findings.push(
          findingAt(
            bg001,
            attribute.node,
            `${describeSubject(taint.origin)} is passed as prop "${attribute.name}" to client component ${tag}`,
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
            `${describeSubject(taint.origin)} is rendered as children of client component ${tag}`,
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
            `${describeSubject(taint.origin)} is spread into client component ${tag}`,
            taint.trace,
          ),
        );
      }
    }

    for (const sink of collectResponseSinks(file, classification)) {
      const taint = ctx.resolver.resolve(sink.node);
      if (!taint || taint.opaque) continue;
      findings.push(
        findingAt(
          bg001,
          sink.node,
          `${describeSubject(taint.origin)} is ${describeSink(sink)}`,
          taint.trace,
        ),
      );
    }
    return findings;
  },
};
