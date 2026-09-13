import { Project, SyntaxKind, type Node, type SourceFile } from "ts-morph";
import { describe, expect, it } from "vitest";

import { TaintResolver, detectIngress } from "../../../src/ast/render-graph.js";
import { createSanitizerMatcher } from "../../../src/classification/sanitizers.js";
import { DEFAULT_KEYWORDS } from "../../../src/config/defaults.js";

const resolver = new TaintResolver({
  sensitivity: {
    keywords: DEFAULT_KEYWORDS,
    pinned: ["iban"],
    ignored: ["source_hash"],
  },
  taintSources: [
    { field: "password_hash", origin: "prisma:User.password_hash" },
  ],
  sanitizer: createSanitizerMatcher(["zod", "sanitizeUser"]),
});

function parse(code: string): SourceFile {
  return new Project({ useInMemoryFileSystem: true }).createSourceFile(
    "a.tsx",
    code,
  );
}

/**
 * The innermost node whose text is exactly `text` — so `data` yields the
 * identifier, not the binding element wrapping it, while `a.b` still yields
 * the property access.
 */
function expr(file: SourceFile, text: string): Node {
  const node = file
    .getDescendants()
    .find(
      (n) =>
        n.getText() === text &&
        !n.getChildren().some((child) => child.getText() === text),
    );
  if (!node) throw new Error(`no node with text ${text}`);
  return node;
}

describe("TaintResolver", () => {
  it("labels a schema field, a keyword field, env, and ingress", () => {
    const file = parse(`
      const user = await fetch("/u").then((r) => r.json());
      const a = user.password_hash;
      const b = user.api_token;
      const c = process.env.SECRET;
      const d = process.env.NEXT_PUBLIC_URL;
      const raw = await fetch("/u");
    `);
    expect(resolver.resolve(expr(file, "user.password_hash"))?.origin).toEqual({
      kind: "schema-field",
      field: "password_hash",
      origins: ["prisma:User.password_hash"],
    });
    expect(resolver.resolve(expr(file, "user.api_token"))?.origin).toEqual({
      kind: "lexical",
      field: "api_token",
    });
    expect(resolver.resolve(expr(file, "process.env.SECRET"))?.origin).toEqual({
      kind: "env",
      name: "SECRET",
    });
    expect(
      resolver.resolve(expr(file, "process.env.NEXT_PUBLIC_URL")),
    ).toBeNull();
    expect(resolver.resolve(expr(file, "raw"))).toMatchObject({
      opaque: true,
      origin: { kind: "ingress" },
    });
  });

  it("follows identifiers, destructuring, rest, and passthrough properties", () => {
    const file = parse(`
      const res = await fetch("/u");
      const { data } = await res.json();
      const { password_hash: pw } = data;
      const { ...everything } = data;
      const { name } = data;
      const copy = pw;
      const arr = [name, copy];
    `);
    expect(resolver.resolve(expr(file, "copy"))?.origin.kind).toBe(
      "schema-field",
    );
    expect(resolver.resolve(expr(file, "everything"))?.opaque).toBe(true);
    expect(resolver.resolve(expr(file, "data"))?.opaque).toBe(true);
    expect(resolver.resolve(expr(file, "name"))).toBeNull();
    expect(resolver.resolve(expr(file, "arr"))?.origin.kind).toBe(
      "schema-field",
    );
  });

  it("treats explicit projection as safe but nested opaque/sensitive values as tainted", () => {
    const file = parse(`
      const user = await db.user.findUnique({});
      const safe = { name: user.name, email: user.email };
      const leaky = { name: user.name, hash: user.password_hash };
      const nested = { profile: user };
      const spread = { ...user };
    `);
    expect(resolver.resolve(expr(file, "safe"))).toBeNull();
    expect(resolver.resolve(expr(file, "leaky"))?.opaque).toBe(false);
    expect(resolver.resolve(expr(file, "nested"))?.opaque).toBe(true);
    expect(resolver.resolve(expr(file, "spread"))?.opaque).toBe(true);
  });

  it("breaks the chain at a sanitizer and honours pins/ignores", () => {
    const file = parse(`
      const user = await db.user.findUnique({});
      const clean = schema.parse(user);
      const custom = sanitizeUser(user);
      const a = user.iban;
      const b = user.source_hash;
      const c = user.password_hash ? "x" : user.api_key;
    `);
    expect(resolver.resolve(expr(file, "clean"))).toBeNull();
    expect(resolver.resolve(expr(file, "custom"))).toBeNull();
    expect(resolver.resolve(expr(file, "user.iban"))?.origin.kind).toBe(
      "lexical",
    );
    expect(resolver.resolve(expr(file, "user.source_hash"))).toBeNull();
    // Only the branches flow into the value, never the condition.
    expect(resolver.resolve(expr(file, "c"))?.origin).toEqual({
      kind: "lexical",
      field: "api_key",
    });
  });

  it("stops at uncalled parameters and unknown calls (bounded by design)", () => {
    const file = parse(`
      function Comp({ user }: { user: any }) { return user.name; }
      const x = someHelper(process.env.SECRET);
      const y = JSON.parse(JSON.stringify(process.env.SECRET));
    `);
    // Nothing in this file renders <Comp/>, so the parameter has no value.
    expect(resolver.resolve(expr(file, "user"))).toBeNull();
    expect(resolver.resolve(expr(file, "x"))).toBeNull();
    expect(resolver.resolve(expr(file, "y"))?.origin.kind).toBe("env");
  });

  it("resolves a destructured prop from the JSX that renders the helper", () => {
    const file = parse(`
      function Row({ user }: { user: any }) {
        return <ClientCard hash={user.password_hash} />;
      }
      export default async function Page() {
        const row = await db.user.findUnique({ where: { id: 1 } });
        return <Row user={row} />;
      }
    `);
    const taint = resolver.resolve(expr(file, "user.password_hash"));
    expect(taint?.origin).toEqual({
      kind: "schema-field",
      field: "password_hash",
      origins: ["prisma:User.password_hash"],
    });
    expect(taint?.trace.map((s) => s.text)).toEqual([
      "user.password_hash",
      "user ← row (parameter of Row)",
      "row ← await db.user.findUnique({ where: { id: 1 } })",
      "db.user.findUnique({ where: { id: 1 } })",
    ]);
  });

  it("resolves a positional parameter from a plain call, and a spread prop", () => {
    const file = parse(`
      function render(value: any) { return value.api_token; }
      const out = render(await fetch("/u").then((r) => r.json()));

      function Card({ user }: { user: any }) { return user.api_token; }
      const props = { user: await fetch("/p").then((r) => r.json()) };
      const el = <Card {...props} />;
    `);
    // A keyword-only field needs provenance, so these only resolve because
    // the parameter walk reached the caller's fetch.
    const positional = resolver.resolve(expr(file, "value.api_token"));
    expect(positional?.origin).toEqual({ kind: "lexical", field: "api_token" });
    expect(positional?.trace.map((s) => s.text)).toContain(
      'value ← await fetch("/u").then((r) => r.json()) (parameter of render)',
    );
    const spread = resolver.resolve(expr(file, "user.api_token"));
    expect(spread?.origin.kind).toBe("lexical");
    expect(
      spread?.trace.some((step) => step.text.includes("parameter of Card")),
    ).toBe(true);
  });

  it("carries an opaque payload through a helper's props", () => {
    const file = parse(`
      function Panel({ user }: { user: any }) {
        return <ClientPanel user={user} />;
      }
      export default async function Page() {
        const data = await fetch("/api/me").then((r) => r.json());
        return <Panel user={data} />;
      }
    `);
    const taint = resolver.resolve(expr(file, "user"));
    expect(taint?.opaque).toBe(true);
    expect(taint?.origin.kind).toBe("ingress");
  });

  it("stops after one parameter hop", () => {
    const file = parse(`
      function Inner({ user }: { user: any }) { return <ClientCard user={user} />; }
      function Outer({ person }: { person: any }) { return <Inner user={person} />; }
      export default async function Page() {
        const data = await fetch("/api/me").then((r) => r.json());
        return <Outer person={data} />;
      }
    `);
    // Inner's caller is Outer, whose own parameter would be a second hop.
    expect(resolver.resolve(expr(file, "user"))).toBeNull();
  });

  it("requires provenance for keyword-only matches", () => {
    const file = parse(`
      const errors = useForm().formState.errors;
      const msg = errors.password;
      const user = await db.user.findUnique({});
      const real = user.password;
    `);
    expect(resolver.resolve(expr(file, "msg"))).toBeNull();
    expect(resolver.resolve(expr(file, "real"))?.origin.kind).toBe("lexical");
  });
});

describe("detectIngress", () => {
  it("recognises network, response-parse, ORM and query-builder calls; not Array.from", () => {
    const file = parse(`
      fetch("/a");
      axios.get("/a");
      res.json();
      JSON.parse("{}");
      prisma.user.findMany();
      supabase.from("users").select("*");
      db.select().from(users);
      Array.from(list);
      helper();
    `);
    // Only top-level statement expressions, so chained inner calls don't double-count.
    const byText = Object.fromEntries(
      file.getStatements().flatMap((statement) => {
        const call = statement.getFirstChildIfKind(SyntaxKind.CallExpression);
        return call ? [[call.getText(), detectIngress(call) !== null]] : [];
      }),
    );
    expect(byText).toEqual({
      'fetch("/a")': true,
      'axios.get("/a")': true,
      "res.json()": true,
      'JSON.parse("{}")': false,
      "prisma.user.findMany()": true,
      'supabase.from("users").select("*")': true,
      "db.select().from(users)": true,
      "Array.from(list)": false,
      "helper()": false,
    });
  });
});
