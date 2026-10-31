import { pickRandom } from '../core/pick-random';
import type { Random } from '../core/random';
import { shuffle } from '../core/shuffle';
import { createRoots } from './create-roots';
import type { LatticeEdge } from './lattice';

/**
 * Picks the edges of a lattice to dig, out of the ones that may be dug: every
 * edge of a main gallery, then the edges of the side galleries in a random
 * order, each one kept when it joins nodes still apart and otherwise by
 * `loopChance`, making a loop. A node left with one edge, a dead end, stays
 * so by `deadEndChance`, and otherwise gets one more edge, where it has one
 * that may be dug. Returns the kept edges in the order of `edges`; they are
 * one piece unless `edges` leaves out some that would have joined them (see
 * `joinCatacombRooms`, which keeps the largest piece).
 *
 * `mirrors` map each node onto its twin, one function for each mirroring of a
 * symmetric lattice. Then an edge is decided together with its twins among
 * `edges`, kept when any of them joins nodes still apart, and a dead end
 * together with the dead ends at its twin nodes, so the kept edges are as
 * symmetric as `edges`.
 */
export function pruneLattice(
  random: Random,
  nodes: number,
  edges: readonly LatticeEdge[],
  loopChance: number,
  deadEndChance: number,
  mirrors: readonly ((node: number) => number)[] = [],
): LatticeEdge[] {
  const kept = new Set<LatticeEdge>();
  const degree = Array.from({ length: nodes }, () => 0);
  const keep = (edge: LatticeEdge) => {
    if (kept.has(edge)) {
      return;
    }
    kept.add(edge);
    for (const node of [edge.from, edge.to]) {
      degree[node] = (degree[node] ?? 0) + 1;
    }
  };
  const byNodes = new Map(
    edges.map((edge) => [`${String(edge.from)}-${String(edge.to)}`, edge]),
  );
  /** An edge and its twins among `edges`. */
  const twinsOf = (edge: LatticeEdge): LatticeEdge[] => [
    ...new Set([
      edge,
      ...mirrors.flatMap((mirror) => {
        const [a, b] = [mirror(edge.from), mirror(edge.to)];
        const twin = byNodes.get(
          `${String(Math.min(a, b))}-${String(Math.max(a, b))}`,
        );
        return twin ? [twin] : [];
      }),
    ]),
  ];
  const tree = createRoots(nodes);
  for (const edge of edges.filter(({ line }) => line.main)) {
    tree.join(edge.from, edge.to);
    keep(edge);
  }
  const decided = new Set<LatticeEdge>();
  for (const edge of shuffle(
    random,
    edges.filter(({ line }) => !line.main),
  )) {
    if (decided.has(edge)) {
      continue;
    }
    const twins = twinsOf(edge);
    const joined = twins
      .map((twin) => tree.join(twin.from, twin.to))
      .some(Boolean);
    for (const twin of twins) {
      decided.add(twin);
    }
    if (joined || random() < loopChance) {
      twins.forEach(keep);
    }
  }

  const ends = Array.from(degree.keys()).filter((node) => degree[node] === 1);
  const settled = new Set<number>();
  for (const node of shuffle(random, ends)) {
    if (settled.has(node) || degree[node] !== 1) {
      continue;
    }
    settled.add(node);
    for (const mirror of mirrors) {
      settled.add(mirror(node));
    }
    if (random() < deadEndChance) {
      continue;
    }
    const spare = edges.filter(
      (edge) => !kept.has(edge) && (edge.from === node || edge.to === node),
    );
    if (spare.length > 0) {
      twinsOf(pickRandom(random, spare)).forEach(keep);
    }
  }

  return edges.filter((edge) => kept.has(edge));
}
