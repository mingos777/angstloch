import type { Area } from '../core/area';
import type { Grid } from '../core/grid';
import type { Point } from '../core/point';
import { Tile } from '../core/tile';
import { createSimplexNoise } from '../noise/create-simplex-noise';
import type { MapStep } from '../pipeline/map-step';
import { step } from '../pipeline/step';
import { assertHallVeinOptions } from './assert-hall-vein-options';
import type { DigHallVeinsOptions } from './dig-hall-veins-options';
import { LANE_SPACING } from './dig-vein';
import { findOutsideRock } from './find-outside-rock';
import { growHallNetwork } from './grow-hall-network';
import type { MinePassage } from './mine-passage';

/** The tiles of floor inside the box of a hall, which are the hall less its pillars. */
function floorOf(grid: Grid, hall: Area): Point[] {
  const floor: Point[] = [];
  for (let y = hall.y; y < hall.y + hall.height; ++y) {
    for (let x = hall.x; x < hall.x + hall.width; ++x) {
      if (grid.get(x, y) === Tile.Floor) {
        floor.push({ x, y });
      }
    }
  }
  return floor;
}

/**
 * A step that joins the halls of `digPillarHalls` into one network of veins
 * routed through the rock around them. The two halls nearest each other are
 * joined first, then the hall nearest the network to the nearest tile of any
 * hall or vein in it, so a vein may end on another vein. Last, extra veins
 * make loops until `hallVeins` is reached. A vein leaves a hall from a tile of
 * its outer boundary, never one beside a pillar, and runs round the halls and
 * never across one. No vein digs a reserved tile.
 *
 * It needs `halls`, joins all of them wherever they were dug, and adds
 * `passages` again with its own appended. A hall that no vein can reach, which
 * should not happen, is filled in and dropped from `halls`. The map has to
 * start as wall. Throws a `RangeError` at once for a bad option.
 */
export function digHallVeins(
  options: DigHallVeinsOptions = {},
): MapStep<
  { halls: Area[] } & Partial<{ passages: MinePassage[] }>,
  { passages: MinePassage[]; halls: Area[] }
> {
  const {
    hallVeins = { min: 2, max: 4 },
    hallEntrances = 'facing',
    veinWidth = { min: 1, max: 2 },
    veinWindiness = 0.5,
  } = options;
  assertHallVeinOptions(options);

  return step<
    { halls: Area[] } & Partial<{ passages: MinePassage[] }>,
    { passages: MinePassage[]; halls: Area[] }
  >(
    'digHallVeins',
    { needs: ['halls'], adds: ['passages', 'halls'] },
    (state, { random }) => {
      const { grid, halls } = state;
      const passages = state.passages ?? [];
      const floors = halls.map((hall) => floorOf(grid, hall));
      const { passages: dug, joined } = growHallNetwork(
        grid,
        random,
        createSimplexNoise(random),
        halls,
        floors,
        {
          hallVeins,
          hallEntrances,
          veinWidth,
          veinWindiness,
          lane: 0.5 + passages.length * LANE_SPACING,
          protect: state.reserved,
          outside: findOutsideRock(grid),
        },
      );
      // a hall that no vein could reach, which should not happen, is filled in
      for (const [index, tiles] of floors.entries()) {
        if (!joined.has(index)) {
          for (const { x, y } of tiles) {
            grid.set(x, y, Tile.Wall);
          }
        }
      }
      return {
        passages: [...passages, ...dug],
        halls: halls.filter((_, index) => joined.has(index)),
      };
    },
  );
}
