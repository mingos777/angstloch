import type { Point } from '../core/point';
import type { Road } from './road';

/** The roads that were laid and where they meet the outside world. */
export interface RoadNetwork {
  /** The roads, the main road first. */
  roads: Road[];
  /** The places where roads meet or cross. Empty while there is only one road. */
  junctions: Point[];
  /** The tiles on the map border where a road leaves the map. */
  exits: Point[];
}
