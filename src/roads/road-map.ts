import type { Point } from '../core/point';
import type { NoiseFunction } from '../noise/noise-function';
import type { Road } from './road';

/** The roads laid so far, which grows as roads are added. */
export interface RoadMap {
  mapWidth: number;
  mapHeight: number;
  /** How much every road winds, from 0 to 1. */
  windiness: number;
  /** Decides the bends of the roads. */
  noise: NoiseFunction;
  /** One byte per tile, row by row: 1 where a road runs. */
  covered: Uint8Array;
  /** The index in `roads` of the road whose centerline took each tile first, row by row, or -1. */
  owner: Int32Array;
  roads: Road[];
  junctions: Point[];
}
