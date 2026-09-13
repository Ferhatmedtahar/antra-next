# System Context — Schema-Optional Ingestion

Settled architecture for `antra`'s scan pipeline. Generalizes ingestion from "Prisma schema" to "any data contract, or none" (BFF / Express / NestJS backends, zero-schema `fetch()`-only apps). See [ADR-002](../adr/0002-schema-optional-ingestion-and-trust-tiers.md) for the reasoning and known limitations behind this shape.

Two additions versus the diagram this was drafted from:

1. **`P1` Taint / Render-Graph Tracker** is now its own node, not folded into the Boundary Classifier. Classifying a file as Server/Client/Action tells you nothing about whether a specific _binding_ traces back to a tainted source through destructuring, reassignment, or JSX composition — that's a distinct pass (`ast/render-graph.ts`) and deserves its own box so the diagram doesn't imply classification and taint propagation are the same algorithm.
2. **`E1` Suppressions & Baseline Filter** sits between the rules engine and storage. `engine.ts`'s own pipeline already does `applySuppressions(rawFindings, project)` before persisting — the earlier diagram routed `RulesEngine --> D1` directly, which contradicts that. In zero-schema / heuristic mode this stage isn't optional polish: lexical + ingress-tracking rules will over-fire on legitimate code, and without suppressions + `baseline` wired in from day one, the tool is too noisy to adopt.

```mermaid
---
config:
  theme: base
  layout: dagre
---
flowchart TB
 subgraph Contracts["Data Sources (Any or None)"]
        A2["Option A: Local DB / Prisma"]
        A3["Option B: Backend OpenAPI / Swagger (Nest/Express)"]
        A4["Option C: Shared Zod Schemas / DTOs"]
        A5["Option D: Zero-Schema (Pure AST Heuristics)"]
  end
 subgraph Zone1["1. Target Project & External Sources"]
    direction TB
        A1["Next.js App Source (.tsx/.ts)<br>- Server Components<br>- 'use client' Files<br>- 'use server' Actions / route.ts"]
        Contracts
  end
 subgraph Zone2["2. Policy & Contract Ingestion"]
        B1["CLI Dispatcher (scan, init, studio)"]
        B2["antra.config.json<br>(Keywords, Sanitizers, Policies)"]
        B3["Contract Ingestor Adapter<br>(Normalizes Prisma, OpenAPI, or Zod to TaintSources)"]
        B4["Schema / Contract Snapshot<br>.antra/contract-snapshot.json"]
  end
 subgraph TaintSources["Origin Identifiers"]
        S1["DB / Contract Fields (from Zone 2)"]
        S2["Server Ingress Calls (fetch / axios)"]
        S3["Server Secrets (process.env.*)"]
        S4["Lexical Sensitive Properties (.password, .token)"]
  end
 subgraph RulesEngine["Security Rules Engine"]
        R1["Rule BG-001: Prop Leak (Tainted field to Client)"]
        R2["Rule BG-002: Unvalidated Action / route.ts"]
        R3["Rule BG-003: Opaque Object Pass (Missing DTO)"]
        R4["Sanitizer Gate: Zod / DTO Projection"]
  end
 subgraph Zone3["3. Core AST Engine (ts-morph)"]
        C1["AST Parser & Import Graph Builder"]
        C2["Boundary Classifier<br>(Server vs Client vs Actions/route.ts)"]
        P1["Taint / Render-Graph Tracker<br>(binding provenance across assignment, destructuring, JSX composition)"]
        TaintSources
        RulesEngine
  end
 subgraph Zone4["4. Storage & Egress"]
        E1["Suppressions & Baseline Filter<br>(inline disables + .antra-baseline.json)"]
        D1[("SQLite Store<br>antra-findings.sqlite")]
        D2["Terminal Reporter"]
        D3["SARIF / CI PR Gate (Exit 0/1)"]
        D4["Studio Visualizer (:8080)"]
  end
    Contracts --> B3
    B3 --> B4
    B4 --> S1
    B1 --> B2
    B2 --> R4
    A1 --> C1
    C1 --> C2
    C1 --> S2 & S3 & S4
    C2 --> P1
    TaintSources --> P1
    P1 --> RulesEngine
    RulesEngine --> E1
    E1 --> D1
    D1 --> D2 & D3 & D4
```
