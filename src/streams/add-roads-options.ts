import type { Range } from '../core/range';
import type { Tile } from '../core/tile';
import type { RoadOptions } from '../roads/road-options';
import type { Verge } from '../roads/verge';

/**
 * Options of `addRoads`: the `RoadOptions` of the roads, the tiles of the
 * road and of a bridge, how roads cross a stream, and the verge that is kept
 * clear of trees beside the roads, whose fields are listed here as well
 * (`clearance`, `falloff`, `distance`).
 */
export interface AddRoadsOptions extends RoadOptions, Verge {
  /** The tile for a road. Defaults to `Tile.Road`. */
  roadTile?: Tile;
  /** The tile for a bridge, where a road crosses water. Defaults to `Tile.Bridge`. */
  bridgeTile?: Tile;
  /** The angle in whole degrees, from 1 to 179, at which a generated road meets a stream, as a `Range`. A road that would cross at another angle is bent to cross at one of these. It is picked at random, to the left or the right. The roads of `specs` are not bent, and are bridged where they happen to meet a stream. Without streams in the state it has no effect. Defaults to `{ min: 75, max: 90 }`. */
  bridgeAngle?: Range;
}
