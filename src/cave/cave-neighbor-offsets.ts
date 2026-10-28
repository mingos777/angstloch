import type { CaveNeighborhood } from './cave-neighborhood';
import { DIRECTIONS } from '../core/directions';
import type { Point } from '../core/point';

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
