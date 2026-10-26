import type { Area } from '../core/area';
import type { Grid } from '../core/grid';
import type { Point } from '../core/point';
import type { Exit } from '../rooms/exit';
import type { Room } from '../rooms/room';
import type { MinePassage } from './mine-passage';

export interface MineResult {
  /** The generated map. */
  grid: Grid;
  /** The tunnels in the order they were dug: the main shaft first, then the adits. Each has the tiles along its middle, from where it starts to where it ends. */
  passages: MinePassage[];
  /** The halls of a `pillars` mine, each as the smallest rectangle that holds it. Its edges are ragged, so the corners may be wall. Empty for the other layouts. */
  halls: Area[];
  /** The caverns that were dug, each as the smallest rectangle that holds it. Empty without `caverns`. */
  caverns: Area[];
  /** The rooms of the mine: templated ones first, then ordinary ones, with ids in that order. An ordinary room's `x`, `y`, `width` and `height` describe its floor, and a templated room's its bounding box, walls included. Empty without `rooms` and `templates`. */
  rooms: Room[];
  /** The openings of the rooms, each an `Exit` whose `door` says whether it got a door. They are not the `exits` on the map border. */
  roomExits: Exit[];
  /** Door tiles on the map border, one per exit. */
  exits: Point[];
}
