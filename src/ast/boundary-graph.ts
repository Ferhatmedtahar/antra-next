import type { SourceFile } from "ts-morph";

import type { FileClassification } from "./boundary-classifier.js";
import { collectJsxSinks } from "./render-graph.js";

export type EdgeKind = "renders" | "calls-action";

/**
 * A directed link between two project files: `from` renders a component
 * declared in `to`, or `from` imports a server action declared in `to`.
 * Plain module imports are deliberately not edges — thousands of them,
 * and none of them is a boundary.
 */
export interface BoundaryEdge {
  from: string;
  to: string;
  kind: EdgeKind;
  /** Component tags or action names on this edge, deduplicated. */
  names: string[];
  /** Individual JSX elements / imported names behind the edge. */
  count: number;
}

/** The render graph as data (P1 in docs/c4): what Studio draws and `--format json` exposes. */
export function collectEdges(
  files: readonly SourceFile[],
  classifications: ReadonlyMap<string, FileClassification>,
): BoundaryEdge[] {
  const edges = new Map<string, BoundaryEdge>();
  const add = (from: string, to: string, kind: EdgeKind, name: string) => {
    const key = `${kind}\n${from}\n${to}`;
    const edge = edges.get(key) ?? { from, to, kind, names: [], count: 0 };
    edge.count += 1;
    if (!edge.names.includes(name)) edge.names.push(name);
    edges.set(key, edge);
  };

  for (const file of files) {
    const from = file.getFilePath();

    for (const sink of collectJsxSinks(file)) {
      if (sink.intrinsic || !sink.targetFilePath) continue;
      if (sink.targetFilePath === from) continue;
      if (!classifications.has(sink.targetFilePath)) continue;
      add(from, sink.targetFilePath, "renders", sink.tagName);
    }

    for (const declaration of file.getImportDeclarations()) {
      const target = declaration.getModuleSpecifierSourceFile()?.getFilePath();
      if (!target || target === from) continue;
      const classification = classifications.get(target);
      if (!classification) continue;
      const actionNames = new Set(
        classification.serverActions.map((action) => action.name),
      );
      if (!classification.isServerActionModule && actionNames.size === 0) {
        continue;
      }
      const imported = [
        ...declaration.getNamedImports().map((named) => named.getName()),
        ...(declaration.getDefaultImport() ? ["default"] : []),
      ];
      const names = classification.isServerActionModule
        ? imported.length > 0
          ? imported
          : ["*"]
        : imported.filter((name) => actionNames.has(name));
      for (const name of names) add(from, target, "calls-action", name);
    }
  }

  return [...edges.values()].sort(
    (a, b) =>
      a.from.localeCompare(b.from) ||
      a.to.localeCompare(b.to) ||
      a.kind.localeCompare(b.kind),
  );
}
