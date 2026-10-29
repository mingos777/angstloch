import type { Grid } from '../core/grid';
import type { Point } from '../core/point';
import type { PipelineFailure } from '../pipeline/pipeline-failure';
import type { Exit } from '../rooms/exit';
import type { Room } from '../rooms/room';
import type { RoomGroup } from '../rooms/room-group';
import type { RoomShape } from '../rooms/room-shape';
import type { MinePassage } from '../veins/mine-passage';

export interface MineResult {
  /** The generated map. */
  grid: Grid;
  /** The tunnels in the order they were dug: those of the layout first (a fishbone's main shaft, then its adits), then the tunnels that join the rooms. Each has the tiles along its middle, from where it starts to where it ends. The tunnels that join the caverns are not listed. */
  passages: MinePassage[];
  /** The rooms of the mine, with ids in this order: the halls of a `pillars` mine (kind `'pillarHall'`), then the caverns (kind `'cavern'`), then the rooms of `rooms` (kind `'room'`), templated ones first. A hall's `x`, `y`, `width` and `height` are the box it was dug in and a cavern's the smallest rectangle that holds its floor, so their corners and edges may be wall; an ordinary room's describe its floor, and a templated room's its bounding box, walls included. */
  rooms: Room[];
  /** The shape of every room, by its id: a hall's or cavern's is its floor, every other cell `Unused`. */
  roomShapes: RoomShape[];
  /** The groups of the rooms: a `'pillarHalls'` group with the box the halls were dug in, and a `'cave'` group for each cavern, with the box it was dug in. */
  roomGroups: RoomGroup[];
  /** The openings of the rooms, each an `Exit` whose `door` says whether it got a door, the places where a vein or a tunnel enters a hall or a cavern included. They are not the `exits` on the map border. */
  roomExits: Exit[];
  /** Door tiles on the map border, one per exit. Empty without `exits`. */
  exits: Point[];
  /** How many times the mine was built, 1 or more: a map is built again when a step throws, up to 3 in all. */
  attempts: number;
  /** One entry per failed attempt, also when a later attempt succeeded. */
  failures: PipelineFailure[];
}
