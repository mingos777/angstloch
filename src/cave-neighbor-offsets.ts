import type { CaveNeighborhood } from './cave-options';
import { DIRECTIONS } from './directions';
import type { Point } from './point';

const MOORE: readonly Point[] = [
  { x: -1, y: -1 },
  { x: 0, y: -1 },
  { x: 1, y: -1 },
  { x: -1, y: 0 },
  { x: 1, y: 0 },
  { x: -1, y: 1 },
  { x: 0, y: 1 },
  { x: 1, y: 1 },
];

/** Returns the offsets from a tile to its neighbors. */
export function caveNeighborOffsets(
  neighborhood: CaveNeighborhood,
): readonly Point[] {
  return neighborhood === 'moore' ? MOORE : DIRECTIONS;
}
