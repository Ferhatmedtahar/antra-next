import {
  Node,
  SyntaxKind,
  type ArrowFunction,
  type FunctionDeclaration,
  type FunctionExpression,
  type SourceFile,
  type Statement,
} from "ts-morph";

/**
 * Boundary classification for Next.js App Router conventions (C2 in
 * docs/c4). Everything here reads syntax the bundler itself enforces —
 * directives, export names, file names — never types (ADR-002, tier 1).
 *
 * When a second FrameworkAdapter exists these conventions move behind it;
 * with one framework that indirection would be pure ceremony.
 */

export type FunctionLike =
  FunctionDeclaration | ArrowFunction | FunctionExpression;

export type Boundary = "client" | "server";

export interface ServerActionInfo {
  name: string;
  line: number;
  node: FunctionLike;
}

export interface FileClassification {
  filePath: string;
  /** "client" iff the file opens with "use client"; everything else is server by default. */
  boundary: Boundary;
  /** Top-level "use server" — every exported function is a Server Action. */
  isServerActionModule: boolean;
  isRouteHandler: boolean;
  routeMethods: string[];
  serverActions: { name: string; line: number }[];
}

const HTTP_METHODS = [
  "GET",
  "HEAD",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
  "OPTIONS",
] as const;

const ROUTE_BASENAMES = new Set(["route.ts", "route.js", "route.mjs"]);

/**
 * The directive prologue: leading string-literal expression statements,
 * stopping at the first real statement. Comments are skipped by the parser.
 */
function leadingDirectives(statements: readonly Statement[]): string[] {
  const directives: string[] = [];
  for (const statement of statements) {
    if (!Node.isExpressionStatement(statement)) break;
    const expression = statement.getExpression();
    if (!Node.isStringLiteral(expression)) break;
    directives.push(expression.getLiteralValue());
  }
  return directives;
}

export function hasDirective(
  sourceFile: SourceFile,
  directive: string,
): boolean {
  return leadingDirectives(sourceFile.getStatements()).includes(directive);
}

export function isClientBoundary(sourceFile: SourceFile): boolean {
  return hasDirective(sourceFile, "use client");
}

export function isServerActionModule(sourceFile: SourceFile): boolean {
  return hasDirective(sourceFile, "use server");
}

function hasBodyDirective(node: FunctionLike, directive: string): boolean {
  const body = node.getBody();
  if (!body || !Node.isBlock(body)) return false;
  return leadingDirectives(body.getStatements()).includes(directive);
}

function isExported(node: FunctionLike): boolean {
  if (Node.isFunctionDeclaration(node)) return node.isExported();
  const parent = node.getParent();
  if (Node.isExportAssignment(parent)) return true;
  if (Node.isVariableDeclaration(parent)) {
    return parent.getVariableStatement()?.isExported() ?? false;
  }
  return false;
}

/**
 * A function is a Server Action if its body opens with "use server", or if
 * it's exported from a module that opens with "use server".
 */
export function isServerAction(node: FunctionLike): boolean {
  if (hasBodyDirective(node, "use server")) return true;
  return isServerActionModule(node.getSourceFile()) && isExported(node);
}

export function routeHandlerMethods(sourceFile: SourceFile): string[] {
  if (!ROUTE_BASENAMES.has(sourceFile.getBaseName())) return [];
  const exported = sourceFile.getExportedDeclarations();
  return HTTP_METHODS.filter((method) => exported.has(method));
}

/** A `route.ts` exporting at least one HTTP-verb handler. */
export function isRouteHandler(sourceFile: SourceFile): boolean {
  return routeHandlerMethods(sourceFile).length > 0;
}

function functionName(node: FunctionLike): string {
  if (Node.isFunctionDeclaration(node) && node.isDefaultExport()) {
    return node.getName() ?? "default";
  }
  if (Node.isFunctionDeclaration(node) || Node.isFunctionExpression(node)) {
    const name = node.getName();
    if (name) return name;
  }
  const parent = node.getParent();
  if (Node.isVariableDeclaration(parent)) return parent.getName();
  if (Node.isExportAssignment(parent)) return "default";
  return "<anonymous>";
}

/** Every Server Action in the file, including ones nested inside components. */
export function listServerActions(sourceFile: SourceFile): ServerActionInfo[] {
  const candidates: FunctionLike[] = [
    ...sourceFile.getDescendantsOfKind(SyntaxKind.FunctionDeclaration),
    ...sourceFile.getDescendantsOfKind(SyntaxKind.ArrowFunction),
    ...sourceFile.getDescendantsOfKind(SyntaxKind.FunctionExpression),
  ];
  return candidates.filter(isServerAction).map((node) => ({
    name: functionName(node),
    line: node.getStartLineNumber(),
    node,
  }));
}

export function classifyFile(sourceFile: SourceFile): FileClassification {
  return {
    filePath: sourceFile.getFilePath(),
    boundary: isClientBoundary(sourceFile) ? "client" : "server",
    isServerActionModule: isServerActionModule(sourceFile),
    isRouteHandler: isRouteHandler(sourceFile),
    routeMethods: routeHandlerMethods(sourceFile),
    serverActions: listServerActions(sourceFile).map(({ name, line }) => ({
      name,
      line,
    })),
  };
}
