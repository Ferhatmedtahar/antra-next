# Contributing to Antra

Thank you for your interest in contributing to Antra. Antra is an open source static analysis security tool created by Ferhat (Ferhatmedtahar).

We welcome contributions from developers of all backgrounds. This guide will walk you through setting up your local development environment, understanding the codebase architecture, adding new rules or schema providers, and submitting your changes.

## Prerequisites

Before working on the codebase, please ensure you have the following installed on your machine:

1. Node.js version 20 or higher.
2. pnpm package manager (version 11.24 or newer; `corepack enable` picks up the pinned version).
3. Git version control.

## Setting Up Your Local Environment

To clone the repository and install all workspace dependencies, execute the following commands in your terminal:

```bash
git clone https://github.com/Ferhatmedtahar/Antra.git
cd Antra
pnpm install
pnpm test
```

All workspace packages will be linked automatically.

## Codebase Architecture

The project is structured as a pnpm monorepo consisting of three main areas:

1. Core Engine and CLI (src directory):
   The core scanning engine that parses TypeScript AST with ts-morph, computes the render graph, traces taint propagation across trust boundaries, executes security rules, and stores scan history in an internal SQLite database.

2. Antra Studio (apps/studio directory):
   A modern single page application dashboard built with Vite, React 19, Tailwind CSS, Radix UI, Tabler Icons, and XYFlow. It provides interactive visualizations of the component render graph, route trees, and code frames.

3. Documentation and Web (apps/web directory):
   The documentation and marketing web application built with Next.js App Router and MDX.

4. Test Suite and Fixtures (tests directory):
   Unit and integration test suites using Vitest, accompanied by realistic Next.js fixture applications in tests/fixtures/.

## Common Development Commands

The following commands are available from the root of the repository:

| Command                       | Purpose                                                                                              |
| ----------------------------- | ---------------------------------------------------------------------------------------------------- |
| `pnpm dev <command>`          | Runs the CLI directly from TypeScript source code. Example: `pnpm dev scan tests/fixtures/rules-app` |
| `pnpm test`                   | Runs the entire test suite using Vitest.                                                             |
| `pnpm typecheck`              | Runs TypeScript type checking across both the CLI engine and the Studio SPA.                         |
| `pnpm build`                  | Compiles the CLI engine with tsup and builds the Studio SPA into dist/.                              |
| `pnpm --filter studio dev`    | Starts the Studio frontend development server on port 5173 with hot module replacement.              |
| `pnpm --filter studio build`  | Compiles the Studio frontend production assets.                                                      |
| `pnpm --filter web dev`       | Starts the Next.js documentation server on port 3000.                                                |
| `pnpm --filter web typecheck` | Validates TypeScript types across the documentation site.                                            |

## How to Add a New Security Rule

If you would like to contribute a new security check, follow these steps:

1. Create a new rule definition file inside `src/rules/` named after the rule identifier, such as `bg-005.ts`.
2. Implement the `Rule` interface. Each rule declares an identifier, a severity level (error or warning), a human readable description, and a `run(file, context)` function.
3. Use the taint resolver and JSX sink utilities provided in the context rather than traversing the raw AST manually.
4. Register the new rule in the central list located at `src/rules/index.ts`.
5. Add a representative code snippet inside the test fixture project located at `tests/fixtures/rules-app/`.
6. Write a comprehensive unit test inside `tests/unit/rules/` verifying that the rule flags the leak and produces accurate origin to sink traces.

## How to Add a Schema Provider

Antra extracts database schemas to identify sensitive column names. To add support for a new database ORM or schema format:

1. Create a new provider module in `src/schema/providers/<provider-id>.ts`.
2. Implement the `SchemaProvider` interface:
   The `detect(rootDir)` function checks if the provider is present in the project.
   The `configFields()` function defines the paths and options needed in the configuration file.
   The `extract(rootDir, config)` function parses the schema files and returns an array of field names and origin identifiers.
3. Register the new provider inside `src/schema/providers/index.ts`.
4. Add a sample schema fixture under `tests/fixtures/schemas/`.
5. Add a test verifying extraction inside `tests/unit/schema/`.

## Reporting False Positives and Bugs

False positive reports are extremely valuable. If Antra flags a value that is safe, please open an issue on GitHub with:

1. The exact rule identifier and terminal output.
2. A minimal code snippet demonstrating the component and data flow.
3. An explanation of why the value is safe to cross the client boundary.

## Pull Request Guidelines

Before submitting a pull request:

1. Run `pnpm typecheck` and ensure there are zero type errors.
2. Run `pnpm lint` and `pnpm format:check`; CI runs both.
3. Run `pnpm test` and ensure all tests pass.
4. Use conventional commit messages (`feat(engine): ...`, `fix(studio): ...`); commitlint checks them on every pull request.
5. Keep pull requests focused on a single feature or fix.
6. Maintain high documentation standards without using emojis or dashes.

Antra is maintained by Ferhat (Ferhatmedtahar) and the open source community. Thank you for making React and Next.js applications more secure.
