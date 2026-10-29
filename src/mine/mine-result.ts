import type { Area } from '../core/area';
import type { Grid } from '../core/grid';
import type { Point } from '../core/point';
import type { PipelineFailure } from '../pipeline/pipeline-failure';
import type { Exit } from '../rooms/exit';
import type { Room } from '../rooms/room';
import type { MinePassage } from '../veins/mine-passage';

export interface MineResult {
  /** The generated map. */
  grid: Grid;
  /** The tunnels in the order they were dug: those of the layout first (a fishbone's main shaft, then its adits), then the tunnels that join the rooms. Each has the tiles along its middle, from where it starts to where it ends. The tunnels that join the caverns are not listed. */
  passages: MinePassage[];
  /** The halls of a `pillars` mine, each as the smallest rectangle that holds it. Its edges are ragged, so the corners may be wall. Empty for the other layouts. */
  halls: Area[];
  /** The area of every cavern, the box it was carved in. Empty without `caverns`. */
  caverns: Area[];
  /** The rooms of the mine: templated ones first, then ordinary ones, with ids in that order. An ordinary room's `x`, `y`, `width` and `height` describe its floor, and a templated room's its bounding box, walls included. Empty without `rooms`. */
  rooms: Room[];
  /** The openings of the rooms, each an `Exit` whose `door` says whether it got a door. They are not the `exits` on the map border. */
  roomExits: Exit[];
  /** Door tiles on the map border, one per exit. Empty without `exits`. */
  exits: Point[];
  /** How many times the mine was built, 1 or more: a map is built again when a step throws, up to 3 in all. */
  attempts: number;
  /** One entry per failed attempt, also when a later attempt succeeded. */
  failures: PipelineFailure[];
}
