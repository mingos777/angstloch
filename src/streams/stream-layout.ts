import type { Road } from '../roads/road';
import type { RoadMap } from '../roads/road-map';

/** What the steering of roads, the terrain and the footbridges read of the streams of a map. */
export interface StreamLayout {
  /** The streams, as roads on a map of their own. */
  map: RoadMap;
  /** The streams as the result lists them, the main stream first, and each one's `points` running with the water: a tributary from its source to where it joins. */
  streams: Road[];
  /** One byte per tile, row by row: 1 where there is water, deep or shallow. */
  water: Uint8Array;
}
