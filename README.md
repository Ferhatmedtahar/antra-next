<p align="center">
  <img src="docs/antra.png" alt="Antra Logo" width="180" />
</p>

<h1 align="center">Antra</h1>

<p align="center">
  <strong>Open source static analysis security scanner for React Server Components and the Next.js App Router.</strong>
</p>

<p align="center">
  Created by Ferhat (Ferhatmedtahar) as a free and open source security tool.
</p>

<p align="center">
  <a href="https://github.com/Ferhatmedtahar/antra-sec/actions/workflows/ci.yml">
    <img src="https://github.com/Ferhatmedtahar/antra-sec/actions/workflows/ci.yml/badge.svg" alt="CI Status" />
  </a>
  <a href="./LICENSE">
    <img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="MIT License" />
  </a>
</p>

## What is Antra

Antra is an automated security analysis tool built specifically for modern React and Next.js applications using the App Router.

It inspects your source code before you build or deploy. Its primary purpose is to stop sensitive server side data from accidentally leaking to client browsers across the server and client boundary.

Antra was created by Ferhat (Ferhatmedtahar) as an open source utility to bring automated boundary security to the React ecosystem.

## Why Antra Exists: The Problem Explained Simply

React Server Components introduce a powerful model where components can run on your server and directly access databases, private microservices, and secret environment variables.

In Next.js App Router applications, you write Server Components and Client Components in the same codebase. A component becomes a Client Component whenever you place the "use client" directive at the top of its file.

Here is where the security risk occurs:

Whenever a Server Component renders a Client Component and passes props to it, React serializes every single prop into a text payload called the React Server Component payload. This serialized data is transmitted over the public internet directly to the user browser.

Consider this common code pattern:

```tsx
// app/page.tsx (Server Component running on the server)
import { db } from "@/lib/db";
import { UserProfileCard } from "@/components/user-profile-card"; // "use client"

export default async function Page() {
  const user = await db.user.findUnique({ where: { id: 1 } });
  return <UserProfileCard user={user} />;
}
```

Even if `UserProfileCard` only displays the user first name on the screen, the entire `user` database record is sent to the browser. This includes sensitive fields such as:

1. password hash
2. billing customer identifier
3. session tokens
4. internal security roles
5. private personal notes

Standard linters like ESLint cannot catch this because the syntax is valid. TypeScript cannot catch this because the types match perfectly. Antra exists to solve this exact problem by understanding your data schema, tracing the flow of sensitive values, and warning you before the code reaches production.

## What Antra Does

Antra operates as an intelligent boundary guard through five core capabilities:

1. Automatic Schema Discovery: Antra reads your existing schemas from Prisma, Supabase, Drizzle, Zod, and OpenAPI to learn exactly which database columns and types exist.
2. Sensitivity Identification: Antra marks confidential fields by examining schema definitions, custom configurations, and industry standard naming patterns such as tokens, secrets, credentials, and passwords.
3. AST Dataflow Tracing: Antra parses your TypeScript code and tracks values through assignments, variable declarations, object destructuring, function returns, and component invocations.
4. Boundary Crossing Verification: Whenever a confidential value crosses from a server file into a client component prop, is returned from a Server Action, is sent in a route handler response, or is rendered directly into public markup, Antra flags it as a violation.
5. Interactive Visual Studio: Antra includes a built in local web application that displays your application dependency graph, route trees, and exact source code frames for every finding.

## Quick Start

You can install and run Antra in your project in less than two minutes.

### Step 1: Install Antra as a Development Dependency

```bash
npm install --save-dev antra-sec
```

If you use pnpm:

```bash
pnpm add -D antra-sec
```

If you use yarn:

```bash
yarn add -D antra-sec
```

The package is named `antra-sec`; the command it installs is `antra`. Install it
first: running `npx antra` without installing would fetch an unrelated package
that already owns that name on npm.

With pnpm 10 or newer, allow the SQLite dependency to build once, or `antra`
will refuse to start:

```bash
pnpm approve-builds   # select better-sqlite3
```

or add it to `pnpm-workspace.yaml`:

```yaml
allowBuilds:
  better-sqlite3: true
```

npm needs no extra step.

### Step 2: Initialize Your Project

Run the initialization wizard in your project root:

```bash
npx antra init
```

The init command performs three tasks:

1. It confirms that your project uses the Next.js App Router.
2. It detects your database or schema provider (such as Prisma, Supabase, Drizzle, or Zod) and creates a schema snapshot file at `.antra/contract-snapshot.json`.
3. It creates an initial configuration file named `antra.config.json` and adds internal database files to your `.gitignore`.

### Step 3: Run Your First Security Scan

Execute the scanner:

```bash
npx antra scan
```

Antra will scan your project and display any boundary leaks directly in your terminal with code snippets, line numbers, and the complete origin to sink data flow path.

### Step 4: Open the Antra Studio Dashboard

Launch the interactive local web dashboard:

```bash
npx antra studio
```

Your browser will open `http://127.0.0.1:8080`, giving you an overview of all findings, visual dependency graphs, and configuration controls.

## Security Rules Explained Simply

Antra checks your codebase against four specialized security rules:

### Rule BG-001: Sensitive Value Passed Across Client Boundary

Severity: Error

This rule triggers when a sensitive value (such as a database password hash, secret token, or private environment variable) leaves the server where the browser can read it: as a prop, spread attribute, or child element of a component marked with "use client", as the return value of a Server Action, or in a route handler response (`Response.json`, `NextResponse.json`, `new Response(...)`).

Why this matters: Any prop passed into a client component is sent in clear text in the network payload to the browser.

### Rule BG-002: Missing Input Validation on Server Ingress

Severity: Error

This rule triggers when a Server Action accepts parameters, or a Route Handler reads its request body, and that input is never passed to a configured validator (Zod and next-safe-action by default; Valibot, Yup, Joi, ArkType or your own function names when added under `sanitizers`). Query strings and route params are not checked.

Why this matters: Server actions and route handlers are public HTTP endpoints. Unvalidated inputs can lead to injection attacks and logic flaws.

### Rule BG-003: Unprojected Database or Fetch Result

Severity: Warning

This rule triggers when a complete database query result or raw fetch response is sent whole to the client (as a client component prop, a Server Action return value, or a route handler response) rather than projecting only the specific properties required by the user interface.

Why this matters: Even if a database model does not currently contain secret columns, future schema migrations that add private fields will automatically leak them if whole records are passed blindly.

### Rule BG-004: Sensitive Value Rendered in Markup

Severity: Error

This rule triggers when a confidential variable is placed directly inside JSX elements, such as inside a paragraph tag or inside HTML attributes that get rendered to the client.

Why this matters: Secret values should never be rendered into HTML that reaches the client browser.

## Step by Step Trace Example

When Antra finds a leak, it shows you the exact path the data took through your code.

Here is an example terminal output:

```
app/page.tsx:16:19  BG-001  error  new
  Field "password_hash" (keyword match) is passed as prop "hash" to client component <ClientCard>

    15 |     <main>
  > 16 |       <ClientCard hash={user.password_hash} />
       |                   ^^^^^^^^^^^^^^^^^^^^^^^^^
    17 |       <ClientCard token={me.auth_token} />

  Path, origin to sink:
    1. db.user.findUnique({ where: { id: 1 } }) (app/page.tsx:7)
    2. user <- await db.user.findUnique({ where: { id: 1 } }) (app/page.tsx:7)
    3. user.password_hash (app/page.tsx:16)
    sink: hash={user.password_hash}
```

You can also run the trace command directly for any file and line number:

```bash
npx antra trace app/page.tsx:16
```

## Configuration Guide

Antra creates a configuration file named `antra.config.json` in your root directory.

Here is an annotated configuration example:

```json
{
  "version": 1,
  "frameworkAdapter": "nextjs-app-router",
  "providers": [
    {
      "id": "supabase",
      "typesPath": "types/database.types.ts"
    }
  ],
  "keywords": {
    "include": ["password", "secret", "token", "credit_card", "api_key"]
  },
  "sensitiveFields": {
    "include": ["supabase:public.users.billing_address"],
    "exclude": ["public_token"]
  },
  "sanitizers": ["zod", "next-safe-action", "maskSecret"],
  "rules": {
    "BG-003": true
  }
}
```

Configuration options explained:

1. providers: Lists your schema sources, such as Prisma schemas, Supabase generated TypeScript definitions, or Drizzle schema files.
2. keywords.include: Words that automatically flag a variable as sensitive. Words with four or more letters match substrings; words with three or fewer letters, and the common English words `token`, `secret`, `salt`, `hash`, `key` and `pin`, match whole words only.
3. sensitiveFields.include: Explicit field identifiers that you want to always treat as sensitive.
4. sensitiveFields.exclude: Specific fields that are safe to expose publicly. Exclude always overrides keyword matches.
5. sanitizers: Function names or libraries that safely clean or validate data, stopping the taint tracking chain.
6. rules: Toggles to enable or disable specific rules.

To refresh your schema snapshot whenever your database tables change, run:

```bash
npx antra sync
```

## How to Handle Legitimate Exceptions

Sometimes a field name sounds sensitive but is genuinely intended for public display, such as a public avatar token or a public share link.

You can handle these in two ways:

### Method 1: Inline Source Code Suppression

Add an inline comment directly above the flagged line explaining the reason:

```tsx
{
  /* antra-disable-next-line BG-001 reason="public sharing token" */
}
<ShareWidget token={document.public_share_token} />;
```

### Method 2: Baseline Existing Codebases

If you are introducing Antra to an existing project with many legacy warnings, you can create a baseline snapshot of current findings so that your build only fails on newly introduced leaks:

```bash
npx antra baseline
```

This records existing findings in `.antra/baseline.json`. Commit this file to git. Future scans will treat those existing items as accepted and only alert you when new violations appear.

## Continuous Integration Setup

You can run Antra in GitHub Actions or any continuous integration system to prevent security leaks from merging into your main branch.

Here is a sample GitHub Actions workflow:

```yaml
name: Security Audit

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  antra-scan:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20

      - name: Install dependencies
        run: npm ci

      - name: Run Antra security scan
        run: npx antra scan --fail-on-violation --format sarif --output antra.sarif

      - name: Upload SARIF report to GitHub Security tab
        uses: github/codeql-action/upload-sarif@v3
        if: always()
        with:
          sarif_file: antra.sarif
```

Useful command line flags for continuous integration:

1. `--fail-on-violation`: Returns an exit code of 1 if active findings are detected.
2. `--strict`: Ensures the scan fails if the project was never properly initialized.
3. `--staged`: Scans only files currently staged in git (ideal for pre-commit hooks).
4. `--diff`: Scans only files changed relative to a git branch.
5. `--format`: Chooses between pretty console text, raw json, or security standard sarif output.

## Full Command Reference

| Command                                 | Description                                                           |
| --------------------------------------- | --------------------------------------------------------------------- |
| `init [path]`                           | Runs the setup wizard, detects schemas, and creates config files.     |
| `scan [path]`                           | Scans the application and reports all boundary violations.            |
| `studio [path]`                         | Starts the local interactive web dashboard on localhost.              |
| `trace <file:line> [path]`              | Explains the complete data flow path for a specific line of code.     |
| `sync [path]`                           | Re-extracts database schemas and updates the snapshot.                |
| `baseline [path]`                       | Saves current findings as accepted so only new issues trigger alerts. |
| `doctor [path]`                         | Runs diagnostic health checks on your configuration and environment.  |
| `query [sql] [path]`                    | Executes read-only SQL queries across your historical scan database.  |
| `watch [path]`                          | Watches project files and rescans automatically whenever you save.    |
| `fix --suppress <rule> --reason <text>` | Automatically adds suppression comments for a selected rule.          |

## Current Scope and Limitations

To be completely clear and transparent about current boundaries:

1. Target Framework: Antra is currently designed specifically for Next.js App Router projects. It does not support Pages Router or other meta frameworks.
2. Hop Tracking Depth: Antra traces values through assignments, destructuring, object properties, function returns (including wrappers such as `cache()` and `unstable_cache`), up to three hops through named imports, and one level of parameter passing, including into an exported component's props from another file. It intentionally bounds interprocedural analysis beyond that for performance and deterministic execution speed. A component imported under an alias is not followed.
3. Network Access: `antra scan` makes no network calls. `init` and `sync` only reach out when you configure a Supabase project or an OpenAPI spec URL.
4. Keyword Matching: Custom domain-specific abbreviations for confidential data (such as internal project codenames) must be declared in your configuration keywords list so Antra knows to track them.

## Contributing

Antra is an open source project created by Ferhat (Ferhatmedtahar).

Contributions from the community are warmly welcome. Whether you want to add support for a new database provider, create new security rules, fix a false positive, or improve documentation, please read our contribution guide:

Please check [CONTRIBUTING.md](./CONTRIBUTING.md) for full instructions on setting up your local development environment, running vitest suites, and submitting pull requests.

## License

This project is licensed under the terms of the MIT License. See the [LICENSE](./LICENSE) file for details.
