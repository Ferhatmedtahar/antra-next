# ADR-001: Static Source-Level Analysis Instead of Runtime Interception

## Status

Accepted

## Date

2026-09-03

## Context

In hybrid-rendering frameworks like Next.js's App Router, React Server Components (RSC) and Server Actions bridge two distinct security domains:

1. **Server domain:** Holds database connections, secrets, and internal business logic.
2. **Client domain:** The fundamentally untrusted browser environment.

Crossing between these domains appears as standard TypeScript function calls or JSX prop passing in source code, but underneath it is a serialization boundary mediated by React's Flight protocol.

To detect unguarded server-to-client data leakage or client-to-server unvalidated input, two architectural approaches were evaluated:

- **Approach A:** Static, source-level analysis inspecting code before it is run or compiled.
- **Approach B:** Runtime interception hooking React Flight's internal serialization stream inside a running application.

## Decision

We choose **Approach A: Static source-level analysis via TypeScript AST (`ts-morph`)**, executed at developer-time and CI/CD-time, requiring no build step and no live network traffic inspection.

## Consequences

### Positive

- **Decoupled from Framework Internals:** Operates against public TypeScript syntax and official React directives (`"use client"`, `"use server"`), surviving internal updates to React, Next.js, Webpack, or Turbopack.
- **Zero Production Runtime Overhead:** The scanner adds zero latency, zero dependencies, and zero code footprint to the deployed application bundle (satisfies NFR5).
- **Shift-Left Security:** Runs locally during development (pre-commit) and in restricted CI environments without requiring live database access or production credentials (satisfies NFR3).
- **Fast Feedback Loop:** Capable of scanning hundreds of files in single-digit seconds without running a bundler or compiler build pipeline (satisfies NFR1).

### Negative

- **Dynamic Value Blindspots:** Cannot evaluate runtime-only values (e.g., conditions where sensitivity depends on runtime evaluation rather than static code flow).
- **Heuristic False Negatives:** Column sensitivity matching relies on keyword heuristics and explicit overrides; business-sensitive fields with ambiguous names require manual configuration.
- **AST Aliasing Complexity:** Complex inter-module alias chains and dynamic destructuring require robust dataflow modeling.

## Alternatives Considered

- **Runtime Mandatory Access Control (MAC) Monitor:** Hooking React's Flight serialization engine directly.
  - _Rejected because:_ Requires reverse-engineering unstable, undocumented framework internals owned by Meta/Vercel. Verifying complete mediation and covert channel resistance presents research-level complexity that is disproportionate for a developer-facing tool. Explicit sensitivity tracking is better enforced statically.
