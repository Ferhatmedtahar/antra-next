import { Graph, layout } from "@dagrejs/dagre";

export type Direction = "LR" | "TB";

export interface LayoutBox {
  id: string;
  width: number;
  height: number;
}

/** Layered (Sugiyama) layout — server on the left, what it renders to the right. */
export function layoutDagre(
  boxes: readonly LayoutBox[],
  links: readonly { from: string; to: string }[],
  direction: Direction,
  options: { nodesep?: number; ranksep?: number } = {},
): Map<string, { x: number; y: number }> {
  const graph = new Graph();
  graph.setGraph({
    rankdir: direction,
    nodesep: options.nodesep ?? 28,
    ranksep: options.ranksep ?? 96,
    marginx: 24,
    marginy: 24,
  });
  graph.setDefaultEdgeLabel(() => ({}));
  const known = new Set<string>();
  for (const box of boxes) {
    graph.setNode(box.id, { width: box.width, height: box.height });
    known.add(box.id);
  }
  for (const link of links) {
    if (known.has(link.from) && known.has(link.to) && link.from !== link.to) {
      graph.setEdge(link.from, link.to);
    }
  }
  layout(graph);
  return new Map(
    boxes.map((box) => {
      const placed = graph.node(box.id) as
        { x?: number; y?: number } | undefined;
      return [
        box.id,
        {
          x: (placed?.x ?? 0) - box.width / 2,
          y: (placed?.y ?? 0) - box.height / 2,
        },
      ];
    }),
  );
}
