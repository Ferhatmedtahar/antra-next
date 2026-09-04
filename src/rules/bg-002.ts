import { SyntaxKind, type SourceFile } from "ts-morph";

import { listServerActions } from "../ast/boundary-classifier.js";
import { functionLikeOf, type CallableNode } from "../ast/render-graph.js";
import type { SanitizerMatcher } from "../classification/sanitizers.js";
import {
  findingAt,
  type Finding,
  type Rule,
  type RuleContext,
} from "./types.js";

/** Verbs that carry a request body. GET/HEAD/OPTIONS have nothing to validate. */
const BODY_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const READS_BODY = /\.(?:json|formData|text)\(\)|\breq(?:uest)?\.body\b/;

function isValidated(fn: CallableNode, sanitizer: SanitizerMatcher): boolean {
  return fn
    .getDescendantsOfKind(SyntaxKind.CallExpression)
    .some((call) => sanitizer(call.getExpression().getText()));
}

/**
 * BG-002 unvalidated-input: a Server Action that accepts parameters, or a
 * route handler that reads the request body, with no call to a configured
 * validator anywhere in its body. Client input is untrusted by definition.
 */
export const bg002: Rule = {
  id: "BG-002",
  severity: "error",
  description:
    "Server Action or route handler accepts input without validation",

  run(file: SourceFile, ctx: RuleContext): Finding[] {
    const classification = ctx.classifications.get(file.getFilePath());
    if (!classification) return [];
    const findings: Finding[] = [];

    if (classification.serverActions.length > 0) {
      for (const action of listServerActions(file)) {
        const parameters = action.node.getParameters();
        if (parameters.length === 0) continue;
        if (isValidated(action.node, ctx.sanitizer)) continue;
        const names = parameters.map((p) => p.getName()).join(", ");
        findings.push(
          findingAt(
            bg002,
            action.node,
            `Server action "${action.name}" accepts (${names}) without calling a configured validator`,
          ),
        );
      }
    }

    if (classification.isRouteHandler) {
      const exported = file.getExportedDeclarations();
      for (const method of classification.routeMethods) {
        if (!BODY_METHODS.has(method)) continue;
        const fn = functionLikeOf(exported.get(method)?.[0]);
        if (!fn || !READS_BODY.test(fn.getText())) continue;
        if (isValidated(fn, ctx.sanitizer)) continue;
        findings.push(
          findingAt(
            bg002,
            fn,
            `Route handler ${method} reads the request body without calling a configured validator`,
          ),
        );
      }
    }
    return findings;
  },
};
