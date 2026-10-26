import type { Point } from '../core/point';
import type { Random } from '../core/random';
import type { VeinLink } from './vein-link';

/** How many of its nearest neighbors a junction may have an extra vein to. */
const NEIGHBORS = 3;

const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

/**
 * Plans which junctions the veins join. The tree is the shortest set of links
 * that joins all junctions, which makes the web one piece. The extras are the
 * other links between near neighbors, shortest first, with a little shuffling
 * so that the web is not regular.
 */
export function planVeinLinks(
  junctions: readonly Point[],
  random: Random,
): { tree: VeinLink[]; extras: VeinLink[] } {
  const link = (from: number, to: number): VeinLink => ({
    from,
    to,
    length: distance(
      junctions[from] ?? { x: 0, y: 0 },
      junctions[to] ?? { x: 0, y: 0 },
    ),
  });
  // Prim's algorithm: `reach[to]` is the shortest link from the tree to `to`
  const tree: VeinLink[] = [];
  const reach: VeinLink[] = junctions.map((_, to) => link(0, to));
  const joined = new Set([0]);
  while (joined.size < junctions.length) {
    let best: VeinLink | undefined;
    for (const candidate of reach) {
      if (
        !joined.has(candidate.to) &&
        (!best || candidate.length < best.length)
      ) {
        best = candidate;
      }
    }
    if (!best) {
      break;
    }
    tree.push(best);
    joined.add(best.to);
    for (const [to, current] of reach.entries()) {
      const candidate = link(best.to, to);
      if (!joined.has(to) && candidate.length < current.length) {
        reach[to] = candidate;
      }
    }
  }

  const taken = new Set(
    tree.map(
      ({ from, to }) =>
        `${String(Math.min(from, to))},${String(Math.max(from, to))}`,
    ),
  );
  const extras: VeinLink[] = [];
  junctions.forEach((_, from) => {
    const nearest = junctions
      .map((__, to) => to)
      .filter((to) => to !== from)
      .map((to) => link(from, to))
      .sort((a, b) => a.length - b.length)
      .slice(0, NEIGHBORS);
    for (const candidate of nearest) {
      const key = `${String(Math.min(candidate.from, candidate.to))},${String(Math.max(candidate.from, candidate.to))}`;
      if (!taken.has(key)) {
        taken.add(key);
        extras.push(candidate);
      }
    }
  });
  const keyed = extras.map((extra) => ({
    extra,
    key: extra.length * (0.8 + 0.4 * random()),
  }));
  keyed.sort((a, b) => a.key - b.key);
  return { tree, extras: keyed.map(({ extra }) => extra) };
}
