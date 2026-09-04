import path from "path";
import { fileURLToPath } from "url";

import { Project, type SourceFile } from "ts-morph";
import { describe, expect, it } from "vitest";

import {
  classifyFile,
  isClientBoundary,
  isRouteHandler,
  isServerAction,
  isServerActionModule,
  listServerActions,
  routeHandlerMethods,
} from "../../../src/ast/boundary-classifier.js";
import { loadProject } from "../../../src/ast/project.js";

const FIXTURES = fileURLToPath(
  new URL("../../fixtures/components/", import.meta.url),
);

const { project } = loadProject(FIXTURES);
const fixture = (name: string): SourceFile =>
  project.getSourceFileOrThrow(path.join(FIXTURES, name));

/** Parses a snippet in an isolated in-memory project. */
function parse(fileName: string, code: string): SourceFile {
  return new Project({ useInMemoryFileSystem: true }).createSourceFile(
    fileName,
    code,
  );
}

describe("boundary classifier — fixtures", () => {
  it("ClientCard.tsx is a client boundary and nothing else", () => {
    const file = fixture("ClientCard.tsx");

    expect(isClientBoundary(file)).toBe(true);
    expect(classifyFile(file)).toMatchObject({
      boundary: "client",
      isServerActionModule: false,
      isRouteHandler: false,
      routeMethods: [],
      serverActions: [],
    });
  });

  it("ServerPage.tsx is a server component with one inline server action", () => {
    const file = fixture("ServerPage.tsx");

    expect(isClientBoundary(file)).toBe(false);
    expect(isServerActionModule(file)).toBe(false);
    expect(isServerAction(file.getFunctionOrThrow("ServerPage"))).toBe(false);
    expect(listServerActions(file).map((action) => action.name)).toEqual([
      "saveDraft",
    ]);
    expect(classifyFile(file).boundary).toBe("server");
  });

  it("actions.ts: every exported function is a server action, helpers are not", () => {
    const file = fixture("actions.ts");

    expect(isServerActionModule(file)).toBe(true);
    expect(isServerAction(file.getFunctionOrThrow("updateProfile"))).toBe(true);
    expect(isServerAction(file.getFunctionOrThrow("internalHelper"))).toBe(
      false,
    );
    expect(listServerActions(file).map((action) => action.name)).toEqual([
      "updateProfile",
      "deleteAccount",
    ]);
    expect(classifyFile(file)).toMatchObject({
      boundary: "server",
      isServerActionModule: true,
      isRouteHandler: false,
    });
  });

  it("route.ts is a route handler exposing exactly its HTTP-verb exports", () => {
    const file = fixture("route.ts");

    expect(isRouteHandler(file)).toBe(true);
    expect(routeHandlerMethods(file)).toEqual([
      "POST",
      "PUT",
      "PATCH",
      "DELETE",
    ]);
    expect(classifyFile(file)).toMatchObject({
      boundary: "server",
      isRouteHandler: true,
      serverActions: [],
    });
  });

  it("handlers.ts exports POST but isn't route.ts, so it's not a handler", () => {
    expect(isRouteHandler(fixture("handlers.ts"))).toBe(false);
  });

  it("lib.ts is a plain server module", () => {
    expect(classifyFile(fixture("lib.ts"))).toMatchObject({
      boundary: "server",
      isServerActionModule: false,
      isRouteHandler: false,
      routeMethods: [],
      serverActions: [],
    });
  });
});

describe("boundary classifier — directive edge cases", () => {
  it("accepts single quotes and a leading comment", () => {
    const file = parse(
      "a.tsx",
      "// header comment\n'use client';\nexport const A = () => null;\n",
    );
    expect(isClientBoundary(file)).toBe(true);
  });

  it("ignores a directive that isn't in the prologue", () => {
    const file = parse(
      "b.tsx",
      'import x from "x";\n"use client";\nexport const B = () => x;\n',
    );
    expect(isClientBoundary(file)).toBe(false);
  });

  it("ignores the string appearing inside a function body", () => {
    const file = parse(
      "c.tsx",
      'export function C() { const s = "use client"; return s; }\n',
    );
    expect(isClientBoundary(file)).toBe(false);
  });

  it("recognises several directives in one prologue", () => {
    const file = parse(
      "d.ts",
      '"use strict";\n"use server";\nexport async function d() {}\n',
    );
    expect(isServerActionModule(file)).toBe(true);
  });
});

describe("boundary classifier — server action edge cases", () => {
  it("names a default-exported arrow action 'default'", () => {
    const file = parse(
      "e.ts",
      'export default async (formData: FormData) => { "use server"; void formData; };\n',
    );
    expect(listServerActions(file).map((action) => action.name)).toEqual([
      "default",
    ]);
  });

  it("treats `export { fn }` as exported in a use-server module", () => {
    const file = parse(
      "f.ts",
      '"use server";\nasync function save() {}\nexport { save };\n',
    );
    expect(isServerAction(file.getFunctionOrThrow("save"))).toBe(true);
  });

  it("does not treat an expression-bodied arrow as an action without a module directive", () => {
    const file = parse("g.ts", "export const g = async () => 1;\n");
    expect(listServerActions(file)).toEqual([]);
  });
});

describe("boundary classifier — route handler edge cases", () => {
  it("accepts `export { POST }` re-export form", () => {
    const file = parse(
      "route.ts",
      "async function POST() {}\nexport { POST };\n",
    );
    expect(routeHandlerMethods(file)).toEqual(["POST"]);
  });

  it("rejects route.ts with no HTTP-verb exports", () => {
    const file = parse("route.ts", "export const helper = 1;\n");
    expect(isRouteHandler(file)).toBe(false);
  });

  it("rejects route.tsx — Next.js only recognises route.ts/.js", () => {
    const file = parse("route.tsx", "export async function GET() {}\n");
    expect(isRouteHandler(file)).toBe(false);
  });
});
