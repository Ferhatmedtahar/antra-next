import {
  Node,
  SyntaxKind,
  type ArrowFunction,
  type BindingElement,
  type CallExpression,
  type ElementAccessExpression,
  type Expression,
  type FunctionDeclaration,
  type FunctionExpression,
  type JsxAttribute,
  type JsxOpeningElement,
  type JsxSelfClosingElement,
  type MethodDeclaration,
  type ObjectLiteralExpression,
  type ParameterDeclaration,
  type PropertyAccessExpression,
  type SourceFile,
} from "ts-morph";

import {
  isSensitiveName,
  normalizeFieldName,
  type SensitivityConfig,
} from "../classification/classify.js";
import type { SanitizerMatcher } from "../classification/sanitizers.js";
import type { TaintSource } from "../schema/types.js";

/**
 * P1 in docs/c4: binding provenance. Given an expression at a sink, walk
 * back through assignment, destructuring, object literals and one import
 * hop to decide whether it carries a sensitive value — and from where.
 *
 * Bounded on purpose (ADR-002): same module plus one hop through a named
 * import. Unknown function calls end the walk; that's a documented false
 * negative, not a bug to chase.
 */

export type TaintOrigin =
  /** Property named like a field the snapshot flagged (with the snapshot origins). */
  | { kind: "schema-field"; field: string; origins: string[] }
  /** Property named like a keyword/pin, with no schema backing (zero-schema mode). */
  | { kind: "lexical"; field: string }
  /** `process.env.X` (never NEXT_PUBLIC_*). */
  | { kind: "env"; name: string }
  /** Raw result of a network/DB call, still unprojected. */
  | { kind: "ingress"; call: string };

export interface Taint {
  origin: TaintOrigin;
  /** A whole unknown object (ingress) rather than one sensitive value. */
  opaque: boolean;
  /** Provenance, nearest-to-sink first. */
  trace: string[];
}

export interface TaintContext {
  sensitivity: SensitivityConfig;
  taintSources: readonly TaintSource[];
  sanitizer: SanitizerMatcher;
}

export function describeOrigin(origin: TaintOrigin): string {
  switch (origin.kind) {
    case "schema-field":
      return `schema field "${origin.field}" — ${origin.origins.join(", ")}`;
    case "lexical":
      return `field "${origin.field}" matches a sensitivity keyword`;
    case "env":
      return `process.env.${origin.name}`;
    case "ingress":
      return `unprojected result of ${origin.call}`;
  }
}

const MAX_DEPTH = 12;
const MAX_FILE_HOPS = 1;
/** One parameter hop: a helper's caller is checked, its caller's caller isn't. */
const MAX_PARAM_HOPS = 1;

/** Properties that carry an opaque payload through unchanged (`const { data } = await ...`). */
const PASSTHROUGH = new Set([
  "data",
  "body",
  "rows",
  "row",
  "result",
  "results",
  "payload",
  "json",
  "items",
  "records",
  "record",
]);

const INGRESS_CALLEE = /^(?:fetch|axios(?:\.\w+)?|ky(?:\.\w+)?|got(?:\.\w+)?)$/;
const RESPONSE_PARSE = /\.(?:json|text|formData|arrayBuffer)$/;
const DB_CHAIN = /(?<!Array)\.(?:from|rpc)\(/;
const ORM_CALL =
  /\b(?:prisma|db|database|client|orm)\.\w+\.(?:find\w*|create\w*|update\w*|upsert|delete\w*|aggregate|groupBy|count)\(/;

/** Collapses a (possibly multi-line) expression to one readable line. */
function firstLine(text: string, max = 90): string {
  const line = text
    .replace(/\s+/g, " ")
    .replace(/\s+\./g, ".")
    .replace(/\(\s+/g, "(")
    .trim();
  return line.length > max ? `${line.slice(0, max - 1)}…` : line;
}

/** The call text if this is a network/DB ingress point, else null. */
export function detectIngress(call: CallExpression): string | null {
  const calleeNode = call.getExpression();
  const callee = calleeNode.getText();
  if (INGRESS_CALLEE.test(callee)) return firstLine(call.getText());
  if (RESPONSE_PARSE.test(callee) && !callee.startsWith("JSON.")) {
    return firstLine(call.getText());
  }
  // `fetch(url).then((r) => r.json())`: the promise chain carries the ingress.
  if (
    /\.(?:then|catch|finally)$/.test(callee) &&
    Node.isPropertyAccessExpression(calleeNode)
  ) {
    const receiver = calleeNode.getExpression();
    if (Node.isCallExpression(receiver)) return detectIngress(receiver);
  }
  const text = call.getText();
  if (DB_CHAIN.test(text) || ORM_CALL.test(text)) return firstLine(text);
  return null;
}

export type CallableNode =
  FunctionDeclaration | ArrowFunction | FunctionExpression | MethodDeclaration;

/** The function behind a declaration: itself, or a variable's function initializer. */
export function functionLikeOf(node: Node | undefined): CallableNode | null {
  if (!node) return null;
  if (
    Node.isFunctionDeclaration(node) ||
    Node.isArrowFunction(node) ||
    Node.isFunctionExpression(node) ||
    Node.isMethodDeclaration(node)
  ) {
    return node;
  }
  if (Node.isVariableDeclaration(node) || Node.isPropertyAssignment(node)) {
    return functionLikeOf(node.getInitializer());
  }
  return null;
}

function enclosingFunction(node: Node): Node | undefined {
  return node.getFirstAncestor(
    (ancestor) =>
      Node.isFunctionDeclaration(ancestor) ||
      Node.isArrowFunction(ancestor) ||
      Node.isFunctionExpression(ancestor) ||
      Node.isMethodDeclaration(ancestor),
  );
}

interface WalkState {
  depth: number;
  hops: number;
  paramHops: number;
  seen: Set<Node>;
}

/** The name call sites use for a function: its own, or the variable holding it. */
function callableName(fn: CallableNode): string | null {
  if (Node.isFunctionDeclaration(fn) || Node.isMethodDeclaration(fn)) {
    return fn.getName() ?? null;
  }
  if (Node.isFunctionExpression(fn)) {
    const own = fn.getName();
    if (own) return own;
  }
  const parent = fn.getParent();
  if (Node.isVariableDeclaration(parent) || Node.isPropertyAssignment(parent)) {
    return parent.getName();
  }
  return null;
}

function asCallable(node: Node | undefined): CallableNode | null {
  if (!node) return null;
  return Node.isFunctionDeclaration(node) ||
    Node.isArrowFunction(node) ||
    Node.isFunctionExpression(node) ||
    Node.isMethodDeclaration(node)
    ? node
    : null;
}

/** The expression a literal assigns to `name`, following shorthand. */
function literalProperty(
  literal: ObjectLiteralExpression,
  name: string,
): Node | null {
  for (const property of literal.getProperties()) {
    if (Node.isPropertyAssignment(property) && property.getName() === name) {
      return property.getInitializer() ?? null;
    }
    if (
      Node.isShorthandPropertyAssignment(property) &&
      property.getName() === name
    ) {
      return property.getNameNode();
    }
  }
  return null;
}

/**
 * Where an identifier is declared. Symbol-based first (cheap, and it works
 * on binding elements where go-to-definition returns nothing); the alias
 * hop makes an imported name resolve to the exporting module's declaration.
 * Language-service lookup only as a fallback.
 */
function resolveDeclarations(identifier: Node): Node[] {
  const symbol = identifier.getSymbol();
  const target = symbol?.getAliasedSymbol() ?? symbol;
  const declarations = target?.getDeclarations() ?? [];
  if (declarations.length > 0) return declarations;
  try {
    return Node.isIdentifier(identifier) ? identifier.getDefinitionNodes() : [];
  } catch {
    return [];
  }
}

export class TaintResolver {
  private readonly fieldOrigins = new Map<string, string[]>();

  constructor(private readonly ctx: TaintContext) {
    for (const source of ctx.taintSources) {
      const key = normalizeFieldName(source.field);
      const origins = this.fieldOrigins.get(key) ?? [];
      origins.push(source.origin);
      this.fieldOrigins.set(key, origins);
    }
  }

  /** Call expressions and JSX elements per file, indexed by the name they call. */
  private readonly callSiteIndex = new Map<SourceFile, Map<string, Node[]>>();

  resolve(node: Node): Taint | null {
    return this.visit(node, {
      depth: 0,
      hops: 0,
      paramHops: 0,
      seen: new Set(),
    });
  }

  /** schema-field beats lexical; both respect sensitiveFields.exclude via the classifier. */
  private classifyName(name: string): TaintOrigin | null {
    const origins = this.fieldOrigins.get(normalizeFieldName(name));
    if (origins) return { kind: "schema-field", field: name, origins };
    if (isSensitiveName(name, this.ctx.sensitivity)) {
      return { kind: "lexical", field: name };
    }
    return null;
  }

  private visit(node: Node, state: WalkState): Taint | null {
    if (state.depth > MAX_DEPTH) return null;
    const next: WalkState = { ...state, depth: state.depth + 1 };

    if (
      Node.isParenthesizedExpression(node) ||
      Node.isAwaitExpression(node) ||
      Node.isAsExpression(node) ||
      Node.isNonNullExpression(node) ||
      Node.isTypeAssertion(node) ||
      Node.isSatisfiesExpression(node) ||
      Node.isSpreadElement(node) ||
      Node.isSpreadAssignment(node)
    ) {
      return this.visit(node.getExpression(), next);
    }
    if (Node.isJsxExpression(node)) {
      const inner = node.getExpression();
      return inner ? this.visit(inner, next) : null;
    }
    if (Node.isIdentifier(node)) return this.visitIdentifier(node, next);
    if (Node.isPropertyAccessExpression(node)) {
      return this.visitProperty(node, node.getName(), next);
    }
    if (Node.isElementAccessExpression(node)) {
      const argument = node.getArgumentExpression();
      return argument && Node.isStringLiteral(argument)
        ? this.visitProperty(node, argument.getLiteralValue(), next)
        : null;
    }
    if (Node.isCallExpression(node)) return this.visitCall(node, next);
    if (Node.isObjectLiteralExpression(node)) {
      return this.first(
        node.getProperties().map((property) => {
          if (Node.isPropertyAssignment(property)) {
            const initializer = property.getInitializer();
            return initializer ? this.visit(initializer, next) : null;
          }
          if (Node.isShorthandPropertyAssignment(property)) {
            return this.visit(property.getNameNode(), next);
          }
          if (Node.isSpreadAssignment(property)) {
            return this.visit(property.getExpression(), next);
          }
          return null;
        }),
      );
    }
    if (Node.isArrayLiteralExpression(node)) {
      return this.first(node.getElements().map((e) => this.visit(e, next)));
    }
    if (Node.isConditionalExpression(node)) {
      return (
        this.visit(node.getWhenTrue(), next) ??
        this.visit(node.getWhenFalse(), next)
      );
    }
    if (Node.isBinaryExpression(node)) {
      return (
        this.visit(node.getLeft(), next) ?? this.visit(node.getRight(), next)
      );
    }
    if (Node.isTemplateExpression(node)) {
      return this.first(
        node
          .getTemplateSpans()
          .map((span) => this.visit(span.getExpression(), next)),
      );
    }
    return null;
  }

  private first(results: readonly (Taint | null)[]): Taint | null {
    // Prefer a concrete sensitive value over an opaque blob when both appear.
    return (
      results.find((taint) => taint !== null && !taint.opaque) ??
      results.find((taint) => taint !== null) ??
      null
    );
  }

  private visitProperty(
    node: PropertyAccessExpression | ElementAccessExpression,
    name: string,
    state: WalkState,
  ): Taint | null {
    const objectNode = node.getExpression();
    if (objectNode.getText() === "process.env") {
      if (name.startsWith("NEXT_PUBLIC_")) return null;
      return {
        origin: { kind: "env", name },
        opaque: false,
        trace: [node.getText()],
      };
    }
    const byName = this.classifyName(name);
    const base = this.visit(objectNode, state);
    if (byName) return this.named(byName, base, node.getText());
    if (base?.opaque && PASSTHROUGH.has(name)) {
      return { ...base, trace: [node.getText(), ...base.trace] };
    }
    return null;
  }

  /**
   * A keyword-only ("lexical") match needs provenance: the object must itself
   * trace back to a fetch/DB/env source. Otherwise `errors.password` — a form
   * validation message — would fire. A schema-backed name is strong enough
   * on its own (ADR-002 trust tiers).
   */
  private named(
    origin: TaintOrigin,
    base: Taint | null,
    step: string,
  ): Taint | null {
    if (origin.kind === "lexical" && !base) return null;
    return { origin, opaque: false, trace: [step, ...(base?.trace ?? [])] };
  }

  private visitCall(call: CallExpression, state: WalkState): Taint | null {
    const callee = call.getExpression().getText();
    // Serialization round-trips carry the value through unchanged.
    if (/^(?:JSON\.parse|JSON\.stringify|structuredClone)$/.test(callee)) {
      const [argument] = call.getArguments();
      return argument ? this.visit(argument, state) : null;
    }
    if (this.ctx.sanitizer(callee)) return null; // sanitizer gate (FR7)
    const ingress = detectIngress(call);
    if (ingress) {
      return {
        origin: { kind: "ingress", call: ingress },
        opaque: true,
        trace: [ingress],
      };
    }
    return this.visitCallee(call, state);
  }

  private visitIdentifier(node: Node, state: WalkState): Taint | null {
    if (state.seen.has(node)) return null;
    state.seen.add(node);
    const name = node.getText();
    if (name === "undefined" || name === "null") return null;
    if (!Node.isIdentifier(node)) return null;

    for (const definition of resolveDeclarations(node)) {
      const crossesFile =
        definition.getSourceFile().getFilePath() !==
        node.getSourceFile().getFilePath();
      if (crossesFile && state.hops >= MAX_FILE_HOPS) continue;
      const next = crossesFile ? { ...state, hops: state.hops + 1 } : state;
      const taint = this.visitDefinition(definition, next);
      if (!taint) continue;
      // Binding elements describe their own step; plain declarations get one here.
      if (Node.isVariableDeclaration(definition)) {
        const initializer = definition.getInitializer();
        const step = `${name} ← ${firstLine(initializer?.getText() ?? definition.getText())}`;
        return { ...taint, trace: [step, ...taint.trace] };
      }
      return taint;
    }
    return null;
  }

  private visitDefinition(definition: Node, state: WalkState): Taint | null {
    if (Node.isVariableDeclaration(definition)) {
      const initializer = definition.getInitializer();
      return initializer ? this.visit(initializer, state) : null;
    }
    if (Node.isBindingElement(definition)) {
      return this.visitBinding(definition, state);
    }
    if (Node.isParameterDeclaration(definition)) {
      return this.visitParameter(definition, null, state);
    }
    if (Node.isImportSpecifier(definition) || Node.isImportClause(definition)) {
      const moduleFile = definition
        .getFirstAncestorByKind(SyntaxKind.ImportDeclaration)
        ?.getModuleSpecifierSourceFile();
      const exportName = Node.isImportSpecifier(definition)
        ? definition.getName()
        : "default";
      const [exported] =
        moduleFile?.getExportedDeclarations().get(exportName) ?? [];
      return exported ? this.visitDefinition(exported, state) : null;
    }
    // Parameters, functions, classes: the walk stops here by design.
    return null;
  }

  private visitBinding(
    element: BindingElement,
    state: WalkState,
  ): Taint | null {
    const pattern = element.getParent();
    if (!Node.isObjectBindingPattern(pattern)) return null;
    const propertyName = (
      element.getPropertyNameNode()?.getText() ?? element.getName()
    ).replace(/^["']|["']$/g, "");
    const isRest = element.getDotDotDotToken() !== undefined;

    const owner = pattern.getParent();
    if (Node.isParameterDeclaration(owner)) {
      // `function Card({ user })` — the value is whatever callers pass as `user`.
      return isRest ? null : this.visitParameter(owner, propertyName, state);
    }
    const initializer = Node.isVariableDeclaration(owner)
      ? owner.getInitializer()
      : undefined;
    const base = initializer ? this.visit(initializer, state) : null;
    const step = `${element.getText()} ← ${firstLine(initializer?.getText() ?? "(parameter)")}`;

    if (!isRest) {
      const byName = this.classifyName(propertyName);
      if (byName) return this.named(byName, base, step);
    }
    if (!base?.opaque) return null;
    if (isRest || PASSTHROUGH.has(propertyName)) {
      return { ...base, trace: [step, ...base.trace] };
    }
    return null;
  }

  /**
   * A parameter carries whatever the caller passed. Bounded hard: one
   * parameter hop per walk, and only call sites in the same file, because
   * finding every caller across a project needs a reference search we
   * can't afford at each sink. A helper defined beside the page that
   * renders it resolves; one imported from another module does not, and
   * that stays a documented false negative (ADR-002).
   */
  private visitParameter(
    parameter: ParameterDeclaration,
    propertyName: string | null,
    state: WalkState,
  ): Taint | null {
    if (state.paramHops >= MAX_PARAM_HOPS) return null;
    if (state.seen.has(parameter)) return null;
    state.seen.add(parameter);

    const fn = asCallable(parameter.getParent());
    if (!fn) return null;
    const name = callableName(fn);
    if (name === null) return null;
    const index = fn.getParameters().indexOf(parameter);
    if (index < 0) return null;

    const next: WalkState = {
      ...state,
      depth: state.depth + 1,
      paramHops: state.paramHops + 1,
    };
    const label = propertyName ?? parameter.getName();
    return this.first(
      this.callSitesIn(fn.getSourceFile(), name).map((site) =>
        this.visitCallSite(site, index, propertyName, label, name, next),
      ),
    );
  }

  private callSitesIn(file: SourceFile, name: string): Node[] {
    const cached = this.callSiteIndex.get(file);
    if (cached) return cached.get(name) ?? [];

    const index = new Map<string, Node[]>();
    const add = (key: string, node: Node) => {
      index.set(key, [...(index.get(key) ?? []), node]);
    };
    for (const call of file.getDescendantsOfKind(SyntaxKind.CallExpression)) {
      const callee = call.getExpression();
      if (Node.isIdentifier(callee)) add(callee.getText(), call);
      else if (Node.isPropertyAccessExpression(callee)) {
        add(callee.getName(), call);
      }
    }
    for (const kind of [
      SyntaxKind.JsxOpeningElement,
      SyntaxKind.JsxSelfClosingElement,
    ] as const) {
      for (const element of file.getDescendantsOfKind(kind)) {
        add(element.getTagNameNode().getText(), element);
      }
    }
    this.callSiteIndex.set(file, index);
    return index.get(name) ?? [];
  }

  /**
   * What one call site hands to the parameter. A destructured name maps to
   * the argument property or JSX attribute of the same name, so the value
   * is that expression itself; only a spread or a bare object argument
   * needs the property read applying on top.
   */
  private visitCallSite(
    site: Node,
    index: number,
    propertyName: string | null,
    label: string,
    fnName: string,
    state: WalkState,
  ): Taint | null {
    if (state.seen.has(site)) return null;
    state.seen.add(site);
    const step = (value: Node) =>
      `${label} ← ${firstLine(value.getText())} (parameter of ${fnName})`;
    const direct = (value: Node): Taint | null => {
      const taint = this.visit(value, state);
      return taint ? { ...taint, trace: [step(value), ...taint.trace] } : null;
    };

    if (Node.isCallExpression(site)) {
      const argument = site.getArguments()[index];
      if (!argument) return null;
      if (propertyName === null) return direct(argument);
      if (Node.isObjectLiteralExpression(argument)) {
        const value = literalProperty(argument, propertyName);
        if (value) return direct(value);
      }
      return this.throughProperty(
        argument,
        propertyName,
        step(argument),
        state,
      );
    }

    if (Node.isJsxOpeningElement(site) || Node.isJsxSelfClosingElement(site)) {
      // JSX only ever passes the props object, so a positional parameter
      // beyond the first has nothing to bind to.
      if (propertyName === null && index !== 0) return null;
      const spreads: Node[] = [];
      for (const attribute of site.getAttributes()) {
        if (Node.isJsxSpreadAttribute(attribute)) {
          spreads.push(attribute.getExpression());
          continue;
        }
        if (
          propertyName !== null &&
          Node.isJsxAttribute(attribute) &&
          attribute.getNameNode().getText() === propertyName
        ) {
          const initializer = attribute.getInitializer();
          const value =
            initializer && Node.isJsxExpression(initializer)
              ? initializer.getExpression()
              : undefined;
          if (value) return direct(value);
        }
      }
      return this.first(
        spreads.map((spread) =>
          propertyName === null
            ? direct(spread)
            : this.throughProperty(spread, propertyName, step(spread), state),
        ),
      );
    }
    return null;
  }

  /** The object literal behind an expression, through one variable hop. */
  private literalBehind(node: Node): ObjectLiteralExpression | null {
    if (Node.isObjectLiteralExpression(node)) return node;
    if (!Node.isIdentifier(node)) return null;
    for (const declaration of resolveDeclarations(node)) {
      if (!Node.isVariableDeclaration(declaration)) continue;
      const initializer = declaration.getInitializer();
      if (initializer && Node.isObjectLiteralExpression(initializer)) {
        return initializer;
      }
    }
    return null;
  }

  /** `<Card {...props} />` reaching `{ user }`: read `user` off the spread. */
  private throughProperty(
    object: Node,
    propertyName: string,
    step: string,
    state: WalkState,
  ): Taint | null {
    // When the spread object is a literal we can see, read the exact key
    // rather than guessing from the property name.
    const literal = this.literalBehind(object);
    const value = literal ? literalProperty(literal, propertyName) : null;
    if (value) {
      const exact = this.visit(value, state);
      return exact ? { ...exact, trace: [step, ...exact.trace] } : null;
    }
    const base = this.visit(object, state);
    const byName = this.classifyName(propertyName);
    if (byName) return this.named(byName, base, step);
    if (base?.opaque && PASSTHROUGH.has(propertyName)) {
      return { ...base, trace: [step, ...base.trace] };
    }
    return null;
  }

  /**
   * One level into a called function: what does it `return`? This is what
   * makes `const user = await getCurrentUser()` resolve when the DB call
   * lives in a service module — the common shape in real apps. Still bounded
   * by depth and the one-import-hop rule.
   */
  private visitCallee(call: CallExpression, state: WalkState): Taint | null {
    const callee = call.getExpression();
    const identifier = Node.isIdentifier(callee)
      ? callee
      : Node.isPropertyAccessExpression(callee)
        ? callee.getNameNode()
        : null;
    if (!identifier) return null;

    for (const declaration of resolveDeclarations(identifier)) {
      const fn = functionLikeOf(declaration);
      if (!fn || state.seen.has(fn)) continue;
      state.seen.add(fn);
      const crossesFile =
        fn.getSourceFile().getFilePath() !== call.getSourceFile().getFilePath();
      if (crossesFile && state.hops >= MAX_FILE_HOPS) continue;
      const next = crossesFile ? { ...state, hops: state.hops + 1 } : state;

      const body = fn.getBody();
      if (!body) continue;
      const returned: Node[] = Node.isBlock(body)
        ? body
            .getDescendantsOfKind(SyntaxKind.ReturnStatement)
            .filter((statement) => enclosingFunction(statement) === fn)
            .flatMap((statement) => {
              const expression = statement.getExpression();
              return expression ? [expression] : [];
            })
        : [body];
      const taint = this.first(returned.map((node) => this.visit(node, next)));
      if (taint) {
        return {
          ...taint,
          trace: [`${callee.getText()}() returns`, ...taint.trace],
        };
      }
    }
    return null;
  }
}

export interface JsxSinkAttribute {
  name: string;
  /** The expression inside `{...}`; null for string literals / bare attributes. */
  value: Expression | null;
  node: JsxAttribute;
}

export interface JsxSink {
  node: JsxOpeningElement | JsxSelfClosingElement;
  tagName: string;
  /** `<div>`, `<p>` … — markup, not a component. */
  intrinsic: boolean;
  /** Where the component is declared, when resolvable. */
  targetFilePath: string | null;
  attributes: JsxSinkAttribute[];
  spreads: Expression[];
  children: Expression[];
}

/** Every JSX element in the file with its prop/children expressions — the sinks rules query. */
export function collectJsxSinks(sourceFile: SourceFile): JsxSink[] {
  const elements: (JsxOpeningElement | JsxSelfClosingElement)[] = [
    ...sourceFile.getDescendantsOfKind(SyntaxKind.JsxOpeningElement),
    ...sourceFile.getDescendantsOfKind(SyntaxKind.JsxSelfClosingElement),
  ];

  return elements.map((element) => {
    const tag = element.getTagNameNode();
    const tagName = tag.getText();
    const intrinsic = Node.isIdentifier(tag) && /^[a-z]/.test(tagName);

    const targetFilePath =
      !intrinsic && Node.isIdentifier(tag)
        ? (resolveDeclarations(tag)[0]?.getSourceFile().getFilePath() ?? null)
        : null;

    const attributes: JsxSinkAttribute[] = [];
    const spreads: Expression[] = [];
    for (const attribute of element.getAttributes()) {
      if (Node.isJsxSpreadAttribute(attribute)) {
        spreads.push(attribute.getExpression());
        continue;
      }
      if (!Node.isJsxAttribute(attribute)) continue;
      const initializer = attribute.getInitializer();
      const value =
        initializer && Node.isJsxExpression(initializer)
          ? (initializer.getExpression() ?? null)
          : null;
      attributes.push({
        name: attribute.getNameNode().getText(),
        value,
        node: attribute,
      });
    }

    const children: Expression[] = Node.isJsxOpeningElement(element)
      ? element
          .getParent()
          .getJsxChildren()
          .filter(Node.isJsxExpression)
          .map((child) => child.getExpression())
          .filter((child): child is Expression => child !== undefined)
      : [];

    return {
      node: element,
      tagName,
      intrinsic,
      targetFilePath,
      attributes,
      spreads,
      children,
    };
  });
}
