import type { Point } from '../core/point';
import type { CatacombSegment } from '../rooms/catacomb-segment';
import type { CatacombSide } from '../rooms/catacomb-side';
import type { LatticeEdge } from './lattice';

/** A dead end of a gallery: the wall that closes it. */
export interface DeadEnd {
  /** The tile of the end wall in the middle of the gallery, where a chamber's door goes. */
  door: Point;
  /** Which way the gallery ends. */
  side: CatacombSide;
  /** The index of the segment that ends there. */
  segment: number;
}

/**
 * Lists the dead ends of the dug edges of a lattice, the nodes that only one
 * edge reaches, in the order of their nodes, each with the segment that runs
 * into it, among `segments`, those of the same edges.
 */
export function listDeadEnds(
  edges: readonly LatticeEdge[],
  segments: readonly Pick<CatacombSegment, 'floor' | 'orientation'>[],
): DeadEnd[] {
  const reaching = new Map<number, LatticeEdge[]>();
  for (const edge of edges) {
    for (const node of [edge.from, edge.to]) {
      reaching.set(node, [...(reaching.get(node) ?? []), edge]);
    }
  }
  return [...reaching.entries()]
    .sort(([p], [q]) => p - q)
    .flatMap(([node, [edge, ...others]]) => {
      if (!edge || others.length > 0) {
        return [];
      }
      const { span, between, line, horizontal } = edge;
      const middle = line.start + Math.floor((line.width - 1) / 2);
      const atStart = edge.from === node;
      const [door, side]: [Point, CatacombSide] = horizontal
        ? [
            { x: atStart ? span.x - 1 : span.x + span.width, y: middle },
            atStart ? 'left' : 'right',
          ]
        : [
            { x: middle, y: atStart ? span.y - 1 : span.y + span.height },
            atStart ? 'top' : 'bottom',
          ];
      const segment = segments.findIndex(
        ({ floor, orientation }) =>
          (orientation === 'horizontal') === horizontal &&
          between.x >= floor.x &&
          between.y >= floor.y &&
          between.x < floor.x + floor.width &&
          between.y < floor.y + floor.height,
      );
      return [{ door, side, segment }];
    });
}
