import type { Grid } from '../core/grid';
import type { Point } from '../core/point';
import type { PipelineFailure } from '../pipeline/pipeline-failure';
import type { Exit } from '../rooms/exit';
import type { Room } from '../rooms/room';
import type { RoomGroup } from '../rooms/room-group';
import type { RoomShape } from '../rooms/room-shape';

export interface CaveResult {
  /** The generated map. */
  grid: Grid;
  /** The caverns as the cave step dug them, before the tunnels joined them: a room of kind `'cavern'` each, its `x`, `y`, `width` and `height` the smallest rectangle that holds its floor. Its `exits` are where the tunnels enter it. */
  rooms: Room[];
  /** The shape of every cavern, by its id: its floor, every other cell `Unused`. */
  roomShapes: RoomShape[];
  /** The `'cave'` group of the caverns, with the box the cave was dug in: the map, unless the step was given an `area`. */
  roomGroups: RoomGroup[];
  /** Where the tunnels enter the caverns, each an `Exit` with the caverns it enters; a tunnel that ends on another tunnel makes none. Empty without `tunnels`. They are not the `exits` on the map border. */
  roomExits: Exit[];
  /** Door tiles on the map border, one per exit. Empty without the `exits` option. */
  exits: Point[];
  /** How many times the cave was built, 1 or more: a map is built again when a step throws, up to 3 in all. */
  attempts: number;
  /** One entry per failed attempt, also when a later attempt succeeded. */
  failures: PipelineFailure[];
}
