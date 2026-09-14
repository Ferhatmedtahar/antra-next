import { Node, SyntaxKind, type SourceFile } from "ts-morph";

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
const BODY_READERS = new Set([
  "json",
  "formData",
  "text",
  "arrayBuffer",
  "blob",
]);
/** next-safe-action binds its schema on the client builder, not on the input. */
const SCHEMA_BINDING = /\.(?:schema|inputSchema|bindArgsSchemas)$/;

/** Every name a parameter binds: `data`, or each of `{ id, name }`. */
function boundNames(fn: CallableNode): string[] {
  return fn.getParameters().flatMap((parameter) => {
    const nameNode = parameter.getNameNode();
    if (Node.isIdentifier(nameNode)) return [nameNode.getText()];
    return nameNode
      .getDescendantsOfKind(SyntaxKind.BindingElement)
      .map((element) => element.getName());
  });
}

/** A value read of the identifier — not `{ name: … }` keys or `x.name` members. */
function isValueReference(identifier: Node): boolean {
  const parent = identifier.getParent();
  if (
    Node.isPropertyAssignment(parent) &&
    parent.getNameNode() === identifier
  ) {
    return false;
  }
  if (
    Node.isPropertyAccessExpression(parent) &&
    parent.getNameNode() === identifier
  ) {
    return false;
  }
  return true;
}

function referencesAny(node: Node, names: ReadonlySet<string>): boolean {
  const identifiers = Node.isIdentifier(node)
    ? [node]
    : node.getDescendantsOfKind(SyntaxKind.Identifier);
  return identifiers.some(
    (identifier) =>
      names.has(identifier.getText()) && isValueReference(identifier),
  );
}

/**
 * The input names plus every local assigned from one of them, in source
 * order — so `const raw = Object.fromEntries(formData)` makes `raw` input.
 */
function inputNames(fn: CallableNode, seeds: readonly string[]): Set<string> {
  const names = new Set(seeds);
  for (const declaration of fn.getDescendantsOfKind(
    SyntaxKind.VariableDeclaration,
  )) {
    const initializer = declaration.getInitializer();
    if (!initializer || !referencesAny(initializer, names)) continue;
    const nameNode = declaration.getNameNode();
    if (Node.isIdentifier(nameNode)) names.add(nameNode.getText());
    else {
      for (const element of nameNode.getDescendantsOfKind(
        SyntaxKind.BindingElement,
      )) {
        names.add(element.getName());
      }
    }
  }
  return names;
}

/** A configured validator that is actually handed the input. */
function isValidated(
  fn: CallableNode,
  sanitizer: SanitizerMatcher,
  inputs: ReadonlySet<string>,
): boolean {
  return fn.getDescendantsOfKind(SyntaxKind.CallExpression).some((call) => {
    const callee = call.getExpression().getText();
    if (!sanitizer(callee)) return false;
    if (SCHEMA_BINDING.test(callee)) return true;
    return call
      .getArguments()
      .some((argument) => referencesAny(argument, inputs));
  });
}

/** The request parameter's name when the handler reads its body, else null. */
function readsRequestBody(fn: CallableNode): string | null {
  const request = fn.getParameters()[0]?.getNameNode();
  if (!request || !Node.isIdentifier(request)) return null;
  const name = request.getText();
  const reads = fn
    .getDescendantsOfKind(SyntaxKind.PropertyAccessExpression)
    .some((access) => {
      if (access.getExpression().getText() !== name) return false;
      if (access.getName() === "body") return true;
      const call = access.getParent();
      return (
        BODY_READERS.has(access.getName()) &&
        Node.isCallExpression(call) &&
        call.getExpression() === access
      );
    });
  return reads ? name : null;
}

/**
 * BG-002 unvalidated-input: a Server Action that accepts parameters, or a
 * route handler that reads the request body, where no configured validator
 * is ever given that input. Client input is untrusted by definition.
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
        const inputs = inputNames(action.node, boundNames(action.node));
        if (isValidated(action.node, ctx.sanitizer, inputs)) continue;
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
        const request = fn ? readsRequestBody(fn) : null;
        if (!fn || !request) continue;
        if (isValidated(fn, ctx.sanitizer, inputNames(fn, [request]))) continue;
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
