import path from "path";

import { afterEach, describe, expect, it } from "vitest";

import {
  DEFAULT_KEYWORDS,
  DEFAULT_SANITIZERS,
} from "../../../src/config/defaults.js";
import { writeConfig, writeSnapshot } from "../../../src/config/write.js";
import { runScan, type ScanResult } from "../../../src/engine.js";
import type { Finding } from "../../../src/rules/index.js";
import {
  copyFixture,
  makeTempProject,
  NEXT_APP_FILES,
  type TempProject,
} from "../../helpers/fixture.js";

async function initFixture(project: TempProject): Promise<void> {
  await writeConfig(
    project.dir,
    {
      version: 1,
      frameworkAdapter: "nextjs-app-router",
      providers: [],
      keywords: { include: [...DEFAULT_KEYWORDS] },
      sensitiveFields: { include: [], exclude: [] },
      sanitizers: [...DEFAULT_SANITIZERS],
      rules: { "BG-001": true, "BG-002": true, "BG-003": true, "BG-004": true },
    },
    { overwrite: false },
  );
  await writeSnapshot(project.dir, {
    generatedAt: "2026-09-05T00:00:00.000Z",
    sources: [
      { field: "password_hash", origin: "prisma:User.password_hash" },
      { field: "email", origin: "prisma:User.email" },
      { field: "name", origin: "prisma:User.name" },
    ],
  });
}

const brief = (finding: Finding, rootDir: string) =>
  `${finding.ruleId} ${path.relative(rootDir, finding.filePath)}:${finding.line} ${finding.snippet}`;

describe("rules end to end (rules-app fixture)", () => {
  let project: TempProject | undefined;
  let result: ScanResult | undefined;

  afterEach(() => {
    project?.cleanup();
    project = undefined;
    result = undefined;
  });

  async function scan(
    extra: { onlyRules?: ("BG-001" | "BG-002" | "BG-003" | "BG-004")[] } = {},
  ) {
    project = copyFixture("rules-app");
    await initFixture(project);
    result = await runScan({ rootDir: project.dir, ...extra });
    return { project, result };
  }

  it("finds every planted leak and nothing else", async () => {
    const { project, result } = await scan();

    expect(result.rulesRun).toEqual(["BG-001", "BG-002", "BG-003", "BG-004"]);
    expect(result.findings.map((f) => brief(f, project.dir))).toEqual([
      "BG-002 app/actions.ts:11 export async function deleteAccount(userId: string) {",
      "BG-002 app/api/users/route.ts:1 export async function POST(request: Request) {",
      "BG-001 app/page.tsx:16 hash={user.password_hash}",
      "BG-001 app/page.tsx:17 token={me.auth_token}",
      "BG-003 app/page.tsx:18 profile={me}",
      "BG-001 app/page.tsx:20 secret={process.env.STRIPE_SECRET_KEY}",
      "BG-001 app/page.tsx:23 hashed={hashed}",
      "BG-003 app/page.tsx:24 rest",
      "BG-004 app/page.tsx:26 user.password_hash",
      "BG-001 app/page.tsx:29 user.password_hash",
    ]);
  });

  it("labels provenance correctly", async () => {
    const { result } = await scan();
    const byLine = (line: number) =>
      result.findings.find(
        (f) => f.line === line && f.filePath.endsWith("page.tsx"),
      );

    expect(byLine(16)?.message).toContain(
      'Schema field "password_hash" (prisma:User.password_hash)',
    );
    expect(
      byLine(16)?.trace.map((s) => (typeof s === "string" ? s : s.text)),
    ).toEqual([
      "user.password_hash",
      "user ← await db.user.findUnique({ where: { id: 1 } })",
      "db.user.findUnique({ where: { id: 1 } })",
    ]);
    expect(byLine(17)?.message).toContain('Field "auth_token" (keyword match)');
    expect(byLine(18)?.message).toContain("Unprojected result of res.json()");
    expect(byLine(20)?.message).toContain(
      "Environment variable process.env.STRIPE_SECRET_KEY",
    );
    expect(
      byLine(23)?.trace.map((s) => (typeof s === "string" ? s : s.text)),
    ).toEqual([
      "password_hash: hashed ← user",
      "user ← await db.user.findUnique({ where: { id: 1 } })",
      "db.user.findUnique({ where: { id: 1 } })",
    ]);
  });

  it("suppresses with an inline directive and keeps the reason", async () => {
    const { result } = await scan();

    expect(result.suppressed).toHaveLength(1);
    expect(result.suppressed[0]).toMatchObject({
      ruleId: "BG-001",
      line: 28,
      suppressed: { reason: "public share token" },
    });
  });

  it("honours --rule filtering", async () => {
    const { result } = await scan({ onlyRules: ["BG-002"] });

    expect(result.rulesRun).toEqual(["BG-002"]);
    expect(result.findings.every((f) => f.ruleId === "BG-002")).toBe(true);
    expect(result.findings).toHaveLength(2);
  });

  it("still catches keyword-named leaks with no config at all (zero-schema mode)", async () => {
    project = copyFixture("rules-app");
    result = await runScan({ rootDir: project.dir });

    expect(result.configPresent).toBe(false);
    const page = result.findings.filter((f) => f.filePath.endsWith("page.tsx"));
    expect(page.map((f) => `${f.ruleId}:${f.line}`)).toEqual([
      "BG-001:16",
      "BG-001:17",
      "BG-003:18",
      "BG-001:20",
      "BG-001:23",
      "BG-003:24",
      "BG-004:26",
      "BG-001:29",
    ]);
    expect(page.find((f) => f.line === 16)?.message).toContain(
      "(keyword match)",
    );
  });

  it("follows a value into a local helper's props and flags the leak there", async () => {
    project = makeTempProject({
      ...NEXT_APP_FILES,
      "components/ClientCard.tsx":
        '"use client";\nexport const ClientCard = (props: any) => null;\n',
      "app/page.tsx": [
        'import { ClientCard } from "../components/ClientCard";',
        "",
        "function Row({ user }: { user: any }) {",
        "  return <ClientCard hash={user.password_hash} />;",
        "}",
        "",
        "export default async function Page() {",
        "  const row = await db.user.findUnique({ where: { id: 1 } });",
        "  return <Row user={row} />;",
        "}",
        "",
      ].join("\n"),
    });

    result = await runScan({ rootDir: project.dir, store: false });

    const [finding] = result.findings;
    expect(result.findings).toHaveLength(1);
    expect(finding?.ruleId).toBe("BG-001");
    // Reported where the value crosses, inside the helper, not at the call.
    expect(finding?.line).toBe(4);
    expect(
      finding?.trace.map((s) => (typeof s === "string" ? s : s.text)),
    ).toEqual([
      "user.password_hash",
      "user ← row (parameter of Row)",
      "row ← await db.user.findUnique({ where: { id: 1 } })",
      "db.user.findUnique({ where: { id: 1 } })",
    ]);
  });

  it("leaves a helper alone when no caller in the file supplies a tainted value", async () => {
    project = makeTempProject({
      ...NEXT_APP_FILES,
      "components/ClientCard.tsx":
        '"use client";\nexport const ClientCard = (props: any) => null;\n',
      "app/page.tsx": [
        'import { ClientCard } from "../components/ClientCard";',
        "",
        "function Row({ user }: { user: any }) {",
        "  return <ClientCard hash={user.password_hash} />;",
        "}",
        "",
        "export default function Page() {",
        '  return <Row user={{ name: "ada" }} />;',
        "}",
        "",
      ].join("\n"),
    });

    result = await runScan({ rootDir: project.dir, store: false });

    expect(result.findings).toEqual([]);
  });
});

describe("rules precision (false positives found on real apps)", () => {
  let project: TempProject | undefined;

  afterEach(() => {
    project?.cleanup();
    project = undefined;
  });

  const CLIENT_CARD = {
    "components/ClientCard.tsx":
      '"use client";\nexport const ClientCard = (props: any) => null;\n',
  };

  async function scanFiles(files: Record<string, string>, withSchema = false) {
    const temp = makeTempProject({
      ...NEXT_APP_FILES,
      ...CLIENT_CARD,
      ...files,
    });
    project = temp;
    if (withSchema) await initFixture(temp);
    const result = await runScan({ rootDir: temp.dir, store: false });
    return result.findings.map((f) => brief(f, temp.dir));
  }

  it("ignores a NODE_ENV guard in a client error page", async () => {
    const findings = await scanFiles({
      "app/error.tsx": [
        '"use client";',
        "export default function Error({ error }: { error: Error }) {",
        "  return (",
        "    <div>",
        '      {process.env.NODE_ENV === "development" && <pre>{error.stack}</pre>}',
        "      <p>{process.env.SECRET_NAME}</p>",
        "    </div>",
        "  );",
        "}",
      ].join("\n"),
    });
    expect(findings).toEqual([]);
  });

  it("doesn't flag keyword look-alikes rendered from fetched data", async () => {
    const findings = await scanFiles({
      "app/usage/page.tsx": [
        "export default async function Page() {",
        '  const usage = await fetch("https://api.test/usage").then((r) => r.json());',
        "  return (",
        "    <section>",
        "      <span>{usage.totalTokens}</span>",
        "      <a href={usage.commitHash}>commit</a>",
        "      <p>{usage.secretaryName}</p>",
        "      <p>{usage.accessToken}</p>",
        "    </section>",
        "  );",
        "}",
      ].join("\n"),
    });
    expect(findings).toEqual(["BG-004 app/usage/page.tsx:8 usage.accessToken"]);
  });

  it("doesn't flag a client login form or a page echoing its own search params", async () => {
    const findings = await scanFiles(
      {
        "components/LoginForm.tsx": [
          '"use client";',
          'import { useState } from "react";',
          "export function LoginForm() {",
          '  const [values, setValues] = useState({ password_hash: "" });',
          "  return <input value={values.password_hash} />;",
          "}",
        ].join("\n"),
        "app/settings/page.tsx": [
          'import { ClientCard } from "../../components/ClientCard";',
          "export default function Page({ searchParams }: any) {",
          "  return <ClientCard p={searchParams.password_hash} />;",
          "}",
        ].join("\n"),
      },
      true,
    );
    expect(findings).toEqual([]);
  });

  it("BG-002: only the handler's own request body counts as input", async () => {
    const findings = await scanFiles({
      "app/api/proxy/route.ts": [
        "export async function POST() {",
        '  const r = await fetch("https://internal.test/x");',
        "  const data = await r.json();",
        "  return Response.json({ ok: !!data });",
        "}",
      ].join("\n"),
      "app/api/wrapped/route.ts": [
        "declare function withAuth<T>(fn: T): T;",
        "export const POST = withAuth(async (req: Request) => {",
        "  const body = await req.json();",
        "  return Response.json({ id: body.id });",
        "});",
      ].join("\n"),
    });
    expect(findings).toEqual([
      "BG-002 app/api/wrapped/route.ts:2 async (req: Request) => {",
    ]);
  });

  it("BG-002: a parse call only validates when it actually receives the input", async () => {
    const findings = await scanFiles({
      "app/actions.ts": [
        '"use server";',
        'import { z } from "zod";',
        "const schema = z.object({ name: z.string() });",
        "export async function viaDate(name: string) {",
        "  const at = Date.parse(name);",
        "}",
        "export async function viaUnrelated(name: string) {",
        '  schema.parse({ name: "fixed" });',
        "}",
        "export async function viaSchema(formData: FormData) {",
        "  const raw = Object.fromEntries(formData);",
        "  const input = schema.safeParse(raw);",
        "}",
      ].join("\n"),
    });
    expect(findings).toEqual([
      "BG-002 app/actions.ts:4 export async function viaDate(name: string) {",
      "BG-002 app/actions.ts:7 export async function viaUnrelated(name: string) {",
    ]);
  });
});

describe("rules recall (leak shapes common in real apps)", () => {
  let project: TempProject | undefined;

  afterEach(() => {
    project?.cleanup();
    project = undefined;
  });

  const BASE = {
    ...NEXT_APP_FILES,
    "components/ClientCard.tsx":
      '"use client";\nexport function ClientCard(props: any) { return null; }\n',
    "lib/db.ts": "export const prisma: any = {};\n",
  };

  async function scanFiles(files: Record<string, string>) {
    const temp = makeTempProject({ ...BASE, ...files });
    project = temp;
    const result = await runScan({ rootDir: temp.dir, store: false });
    return result.findings.map((f) => brief(f, temp.dir));
  }

  it("follows t3-env, destructured and aliased process.env", async () => {
    const findings = await scanFiles({
      "lib/env.ts": [
        "declare function createEnv(x: any): any;",
        "export const env = createEnv({",
        "  server: { STRIPE_SECRET_KEY: 1 },",
        "  client: { NEXT_PUBLIC_SITE: 1, PUBLIC_WIDGET_ID: 1 },",
        "  runtimeEnv: process.env,",
        "});",
      ].join("\n"),
      "app/page.tsx": [
        'import { env } from "../lib/env";',
        'import { ClientCard } from "../components/ClientCard";',
        "const { DATABASE_URL } = process.env;",
        "const vars = process.env;",
        "export default function Page() {",
        "  return (",
        "    <>",
        "      <ClientCard a={env.STRIPE_SECRET_KEY} />",
        "      <ClientCard b={DATABASE_URL} />",
        "      <ClientCard c={vars.SESSION_SECRET} />",
        "      <ClientCard d={env.PUBLIC_WIDGET_ID} />",
        "      <ClientCard e={env.NEXT_PUBLIC_SITE} />",
        "    </>",
        "  );",
        "}",
      ].join("\n"),
    });
    expect(findings).toEqual([
      "BG-001 app/page.tsx:8 a={env.STRIPE_SECRET_KEY}",
      "BG-001 app/page.tsx:9 b={DATABASE_URL}",
      "BG-001 app/page.tsx:10 c={vars.SESSION_SECRET}",
    ]);
  });

  it("follows a data layer two modules deep", async () => {
    const findings = await scanFiles({
      "lib/raw.ts": [
        'import { prisma } from "./db";',
        "export async function getUserRaw() { return prisma.user.findFirst(); }",
      ].join("\n"),
      "lib/users.ts": [
        'import { getUserRaw } from "./raw";',
        "export async function getUser() { return getUserRaw(); }",
      ].join("\n"),
      "app/page.tsx": [
        'import { getUser } from "../lib/users";',
        'import { ClientCard } from "../components/ClientCard";',
        "export default async function Page() {",
        "  const user = await getUser();",
        "  return <ClientCard u={user} h={user.passwordHash} />;",
        "}",
      ].join("\n"),
    });
    expect(findings).toEqual([
      "BG-003 app/page.tsx:5 u={user}",
      "BG-001 app/page.tsx:5 h={user.passwordHash}",
    ]);
  });

  it("sees through React cache() and unstable_cache wrappers", async () => {
    const findings = await scanFiles({
      "lib/queries.ts": [
        'import { cache } from "react";',
        'import { unstable_cache } from "next/cache";',
        'import { prisma } from "./db";',
        "export const getMe = cache(async () => prisma.user.findFirst());",
        "async function loadTeam() { return prisma.team.findMany(); }",
        'export const getTeam = unstable_cache(loadTeam, ["team"]);',
      ].join("\n"),
      "app/page.tsx": [
        'import { getMe, getTeam } from "../lib/queries";',
        'import { ClientCard } from "../components/ClientCard";',
        "export default async function Page() {",
        "  const me = await getMe();",
        "  const team = await getTeam();",
        "  return <ClientCard me={me} team={team} />;",
        "}",
      ].join("\n"),
    });
    expect(findings).toEqual([
      "BG-003 app/page.tsx:6 me={me}",
      "BG-003 app/page.tsx:6 team={team}",
    ]);
  });

  it("follows props into a server component declared in another file", async () => {
    const findings = await scanFiles({
      "components/ServerWrapper.tsx": [
        'import { ClientCard } from "./ClientCard";',
        "export function ServerWrapper({ user }: { user: any }) {",
        "  return <ClientCard secret={user.passwordHash} />;",
        "}",
      ].join("\n"),
      "app/page.tsx": [
        'import { prisma } from "../lib/db";',
        'import { ServerWrapper } from "../components/ServerWrapper";',
        "export default async function Page() {",
        "  const user = await prisma.user.findFirst();",
        "  return <ServerWrapper user={user} />;",
        "}",
      ].join("\n"),
    });
    expect(findings).toEqual([
      "BG-001 components/ServerWrapper.tsx:3 secret={user.passwordHash}",
    ]);
  });

  it("resolves next/dynamic and React.lazy client components", async () => {
    const findings = await scanFiles({
      "app/page.tsx": [
        'import dynamic from "next/dynamic";',
        'import { lazy } from "react";',
        'import { prisma } from "../lib/db";',
        'const Lazy = dynamic(() => import("../components/ClientCard").then((m) => m.ClientCard));',
        'const Suspended = lazy(() => import("../components/ClientCard"));',
        "export default async function Page() {",
        "  const user = await prisma.user.findFirst();",
        "  return (",
        "    <>",
        "      <Lazy h={user.passwordHash} />",
        "      <Suspended h={user.passwordHash} />",
        "    </>",
        "  );",
        "}",
      ].join("\n"),
    });
    expect(findings).toEqual([
      "BG-001 app/page.tsx:10 h={user.passwordHash}",
      "BG-001 app/page.tsx:11 h={user.passwordHash}",
    ]);
  });

  it("treats Server Action returns and route handler responses as client sinks", async () => {
    const findings = await scanFiles({
      "app/actions.ts": [
        '"use server";',
        'import { prisma } from "../lib/db";',
        "export async function getProfile() { return prisma.user.findFirst(); }",
        "export async function getHash() { const u = await prisma.user.findFirst(); return u.passwordHash; }",
        "export async function getName() { const u = await prisma.user.findFirst(); return { name: u.name }; }",
      ].join("\n"),
      "app/api/me/route.ts": [
        'import { NextResponse } from "next/server";',
        'import { prisma } from "../../../lib/db";',
        "export async function GET() {",
        "  const user = await prisma.user.findFirst();",
        '  if (!user) return NextResponse.json({ error: "none" }, { status: 404 });',
        "  return Response.json(user);",
        "}",
        "export async function PUT() {",
        "  const user = await prisma.user.findFirst();",
        "  return new Response(JSON.stringify(user.apiToken));",
        "}",
      ].join("\n"),
    });
    expect(findings).toEqual([
      "BG-003 app/actions.ts:3 prisma.user.findFirst()",
      "BG-001 app/actions.ts:4 u.passwordHash",
      "BG-003 app/api/me/route.ts:6 user",
      "BG-001 app/api/me/route.ts:10 JSON.stringify(user.apiToken)",
    ]);
  });
});
