import type { RoadNetwork } from './road-network';

/** A road network together with the tiles that its roads cover. */
export interface LaidRoads extends RoadNetwork {
  /** One byte per tile, row by row: 1 where a road runs, 0 elsewhere. */
  covered: Uint8Array;
}
