import type { BaseOptions } from '../core/base-options';
import type { Range } from '../core/range';
import type { RoomTemplate } from '../rooms/templates/room-template';
import type { MineRoomOptions } from './mine-room-options';
import type { MineLayout } from './mine-layout';
import type { MineRingShape } from './mine-ring-shape';

export interface MineOptions extends BaseOptions {
  /** The overall shape of the mine. The options of the other layouts are ignored. Defaults to `fishbone`. */
  layout?: MineLayout;
  /** The share of the map that is floor, from 0 to 1. It is a target, met as far as the map has room: the mine gets more tunnels until it is reached, and stops short when no more fit. The main shaft is always dug, so a low density does not remove it. Defaults to 0.15, to 0.35 for `pillars`, whose halls need room, and to 0.3 for `rings`, which only uses it to pick how many rings to dig. */
  density?: number;
  /** Fishbone only. Width of the main shaft in whole tiles, as a `Range`. One is picked at random. Defaults to `{ min: 2, max: 3 }`. */
  shaftWidth?: Range;
  /** Fishbone only. How much the main shaft winds, from 0 (straight) to 1. Defaults to 0.1. */
  shaftWindiness?: number;
  /** Fishbone only. Direction of the main shaft in degrees, clockwise from east, so 0 runs left to right and 90 top to bottom. `random` picks an angle. Defaults to `random`. */
  angle?: number | 'random';
  /** Fishbone only. Width of the side tunnels, the adits, in whole tiles, as a `Range`. One is picked for every adit. Defaults to `{ min: 1, max: 2 }`. */
  aditWidth?: Range;
  /** Fishbone only. How much the adits wind, from 0 (straight) to 1. Defaults to 0.4. */
  aditWindiness?: number;
  /** Fishbone only. Length of an adit in whole tiles, as a `Range`, measured along the line it follows, so an adit at a diagonal covers up to about 40% more tiles. One is picked for every adit, and an adit that is stopped short by another tunnel or the edge of the map and ends shorter than the minimum is not dug. Defaults to `{ min: 15, max: 50 }`. */
  aditLength?: Range;
  /** Fishbone only. The angle in whole degrees, from 1 to 179, between an adit and the tunnel it leaves, as a `Range`. It is picked at random, and the adit leaves along the tunnel or against it, to the left or the right. Defaults to `{ min: 45, max: 90 }`. */
  branchAngle?: Range;
  /** Fishbone only. The chance, from 0 to 1, that an adit that runs into another tunnel breaks through and joins it, which makes a loop, instead of stopping short and ending in a dead end. Defaults to 0, which makes no loops. */
  loops?: number;
  /** Pillars only. How many halls to dig, as a `Range`. One is picked. A hall that finds no room, at least 4 tiles of wall away from the others, is left out, so a crowded map gets fewer. Defaults to `{ min: 2, max: 4 }`. */
  halls?: Range;
  /** Pillars only. How many veins to dig between the halls in all, as a `Range`. One is picked. The shortest set of veins that joins every hall is always dug, so a mine with many halls has at least that many, and the rest are extra veins between neighboring halls, which may join the same two halls more than once. Each vein runs between a random tile of one hall and a random tile of the other. Defaults to `{ min: 2, max: 4 }`. */
  hallVeins?: Range;
  /** Pillars only. The width and the height of a hall in whole tiles, as a `Range`. Each side of each hall gets its own size, and a side is cut down to what the map has room for. Defaults to a size that makes the halls fill about the `density` of the map. */
  hallSize?: Range;
  /** Pillars only. How ragged the edges of the halls are, from 0 (clean rectangles) to 1. Defaults to 0.5. */
  hallRagged?: number;
  /** Pillars only. The width and the height of a pillar in whole tiles, as a `Range`. Each side of each pillar gets its own size. Defaults to `{ min: 2, max: 5 }`. */
  pillarSize?: Range;
  /** Pillars only. The gap between neighboring pillars in whole tiles, as a `Range`, picked once for each hall. Defaults to `{ min: 2, max: 4 }`. */
  pillarSpacing?: Range;
  /** Pillars only. How ragged the edges of the pillars are, from 0 (clean rectangles) to 1. Pillars of 2 tiles are too small to be ragged. Defaults to 0.5. */
  pillarRagged?: number;
  /** Pillars only. How far the pillars stray from a regular pattern, from 0 (a perfect grid) to 1 (as far as they can without touching). Defaults to 0.5. */
  pillarJitter?: number;
  /** Rings only. How many concentric rings to dig, as a `Range`. One is picked, and fewer are dug when the map is too small to space them. Defaults to a count that makes the rings and their spokes fill about the `density` of the map. */
  rings?: Range;
  /** Rings only. `oval` fits the rings to the map, so they are as wide and as tall as it is. `circle` makes them round, as large as the shorter side of the map allows, centered, which leaves the ends of a wide or tall map as rock. The `density` keeps its meaning, so a circle on a very wide map may stop short of it. Defaults to `oval`. */
  ringShape?: MineRingShape;
  /** Rings only. Width of a ring in whole tiles, as a `Range`. One is picked for every ring. Defaults to `{ min: 2, max: 3 }`. */
  ringWidth?: Range;
  /** Rings only. How far the rings stray from perfect ovals, from 0 (perfect) to 1 (as far as they can without nearing the next ring). Defaults to 0.5. */
  ringWobble?: number;
  /** Rings only. How many spokes join each ring to the next, as a `Range`. One is picked for every pair of rings, and every pair gets one at least, so a `min` of 0 is the same as 1. Defaults to `{ min: 1, max: 3 }`. */
  spokes?: Range;
  /** Veins, pillars and rings. Width of a vein in whole tiles, as a `Range`. One is picked for every vein. Defaults to `{ min: 1, max: 2 }`. */
  veinWidth?: Range;
  /** Veins, pillars and rings. How much the veins wind, from 0 (straight) to 1. Defaults to 0.5. */
  veinWindiness?: number;
  /** Veins only. About how far apart the junctions of the web lie, in tiles, a whole number of at least 3. A larger value makes a coarser web with longer veins. Defaults to 16. */
  veinSpacing?: number;
  /** How many caverns to dig, as a `Range` of whole numbers, 0 or more. One is picked. A cavern is a blob of floor made by the noise cave generator, dug into the rock beside the mine and joined to it, for any layout. A cavern that finds no room is left out. Defaults to `{ min: 0, max: 0 }`, which digs none. */
  caverns?: Range;
  /** The width and the height of a cavern in whole tiles, 3 or more, as a `Range`. Each side of each cavern gets its own size, and a side is cut down to what the map has room for. Defaults to `{ min: 12, max: 24 }`. */
  cavernSize?: Range;
  /** The share of a cavern's box that is wall, from 0 to 1, as `fill` of the noise cave. A higher share makes smaller, thinner caverns. Defaults to 0.45. */
  cavernFill?: number;
  /** Ordinary rectangular rooms to place in the mine, for any layout. They are dug into the rock beside the tunnels once the rest is done, never over floor, and joined to the mine by a tunnel from each of their exits. A room that finds no room is left out. Defaults to no rooms. */
  rooms?: MineRoomOptions;
  /** Prefabricated rooms, placed like the ordinary ones, before them, and joined to the mine from their exits. A template that cannot be placed or joined throws a `TemplatePlacementError`. Defaults to none. */
  templates?: RoomTemplate[];
  /** Number of openings per room, a `Range` of whole numbers, 1 or more. The fixed exits of a template count, and more are opened from the optional ones. Defaults to 1 to 3. */
  exitsPerRoom?: Range;
  /** Chance that a room's opening gets a door, from 0 to 1. Openings without a door are plain gaps in the wall. Defaults to 1. */
  doorChance?: number;
  /** Minimum number of exits to add on the map border. Defaults to 0. */
  minExits?: number;
  /** Maximum number of exits to add. Defaults to `minExits`. */
  maxExits?: number;
}
