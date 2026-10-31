import type { Point } from '../core/point';

/** A canal of a sewer of `digSewers`: a straight stretch of `ShallowWater`. */
export interface SewerCanal {
  /** `'trunk'` for the canal that the branches grow from, `'branch'` for every other. */
  level: 'trunk' | 'branch';
  /** The tiles of its middle line, from one end to the other: a branch's from the tile beside the canal it meets, or from the ledge of the cistern where it meets it, out to its mouth, the trunk's from its left or top end. With an even width, the line nearer the top or the left of the two middle ones. Bridges cross it, so a tile may be a `Bridge`. */
  centerline: Point[];
  /** How many tiles wide the water is. */
  width: number;
  /** Index into `canals` of the canal a branch meets at right angles. Absent for the trunk. */
  parent?: number;
}
