import type { Area } from '../core/area';
import type { CatacombSegment } from '../rooms/catacomb-segment';
import type { LatticeEdge } from './lattice';

/**
 * Lists the segments of the dug edges of a lattice, in the order of their
 * first edges: each a straight run of edges along one row or column, through
 * every node where the gallery only runs on, up to a node where it turns,
 * meets another or ends. Its floor is that of its edges and of the nodes it
 * runs through, not those at its ends.
 */
export function listCatacombSegments(
  edges: readonly LatticeEdge[],
): Omit<CatacombSegment, 'character'>[] {
  const [forward, backward] = [
    new Map<string, LatticeEdge>(),
    new Map<string, LatticeEdge>(),
  ];
  const key = (node: number, horizontal: boolean) =>
    `${String(node)}${horizontal ? 'h' : 'v'}`;
  for (const edge of edges) {
    forward.set(key(edge.from, edge.horizontal), edge);
    backward.set(key(edge.to, edge.horizontal), edge);
  }
  /** Whether the gallery only runs on through the node, the way given. */
  const runsOn = (node: number, horizontal: boolean) =>
    forward.has(key(node, horizontal)) &&
    backward.has(key(node, horizontal)) &&
    !forward.has(key(node, !horizontal)) &&
    !backward.has(key(node, !horizontal));

  const listed = new Set<LatticeEdge>();
  const segments: Omit<CatacombSegment, 'character'>[] = [];
  for (const edge of edges) {
    if (listed.has(edge)) {
      continue;
    }
    const { horizontal, line } = edge;
    let first = edge;
    while (runsOn(first.from, horizontal)) {
      first = backward.get(key(first.from, horizontal)) as LatticeEdge;
    }
    const run = [first];
    for (let last = first; runsOn(last.to, horizontal); run.push(last)) {
      last = forward.get(key(last.to, horizontal)) as LatticeEdge;
    }
    for (const part of run) {
      listed.add(part);
    }
    const start = run[0]?.between as Area;
    const end = run[run.length - 1]?.between as Area;
    segments.push({
      floor: {
        x: start.x,
        y: start.y,
        width: end.x + end.width - start.x,
        height: end.y + end.height - start.y,
      },
      orientation: horizontal ? 'horizontal' : 'vertical',
      width: line.width,
      main: line.main,
    });
  }
  return segments;
}
