import {
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  forceX,
  forceY,
  type SimulationLinkDatum,
  type SimulationNodeDatum,
} from "d3-force";

import type { GraphNodeKind } from "../../../../../src/studio/types.js";

interface ForceBox {
  id: string;
  kind: GraphNodeKind;
  width: number;
  height: number;
}

interface SimNode extends SimulationNodeDatum {
  id: string;
  kind: GraphNodeKind;
  radius: number;
}

/** Where each kind is pulled: server on the left, client on the right, the rest between. */
const KIND_X: Record<GraphNodeKind, number> = {
  server: -1,
  action: -0.35,
  route: 0.35,
  client: 1,
};

/**
 * Force-directed layout, run to completion synchronously so the result is
 * stable and needs no animation. A horizontal pull per kind keeps the
 * server → client direction readable inside the cloud. Deterministic: the
 * seed positions come from the index, not Math.random.
 */
export function layoutForce(
  boxes: readonly ForceBox[],
  links: readonly { from: string; to: string }[],
): Map<string, { x: number; y: number }> {
  if (boxes.length === 0) return new Map();
  const spread = Math.max(400, Math.sqrt(boxes.length) * 150);
  const nodes: SimNode[] = boxes.map((box, index) => ({
    id: box.id,
    kind: box.kind,
    radius: Math.max(box.width, box.height) / 2 + 10,
    x: KIND_X[box.kind] * spread + ((index * 53) % 120) - 60,
    y: ((index * 97) % (spread * 2)) - spread,
  }));
  const ids = new Set(nodes.map((node) => node.id));
  const simLinks: SimulationLinkDatum<SimNode>[] = links
    .filter(
      (link) => ids.has(link.from) && ids.has(link.to) && link.from !== link.to,
    )
    .map((link) => ({ source: link.from, target: link.to }));

  const simulation = forceSimulation(nodes)
    .force(
      "link",
      forceLink<SimNode, SimulationLinkDatum<SimNode>>(simLinks)
        .id((node) => node.id)
        .distance(180)
        .strength(0.5),
    )
    .force("charge", forceManyBody<SimNode>().strength(-900).distanceMax(900))
    .force(
      "collide",
      forceCollide<SimNode>()
        .radius((node) => node.radius)
        .iterations(2),
    )
    .force(
      "x",
      forceX<SimNode>((node) => KIND_X[node.kind] * spread).strength(0.08),
    )
    .force("y", forceY<SimNode>(0).strength(0.03))
    .stop();

  const ticks = Math.ceil(
    Math.log(simulation.alphaMin()) / Math.log(1 - simulation.alphaDecay()),
  );
  for (let i = 0; i < Math.min(ticks, 300); i++) simulation.tick();

  const byId = new Map(boxes.map((box) => [box.id, box]));
  return new Map(
    nodes.map((node) => {
      const box = byId.get(node.id);
      return [
        node.id,
        {
          x: (node.x ?? 0) - (box?.width ?? 0) / 2,
          y: (node.y ?? 0) - (box?.height ?? 0) / 2,
        },
      ];
    }),
  );
}
