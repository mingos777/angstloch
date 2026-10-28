import type { Area } from '../core/area';
import { assertFraction } from '../core/assert-fraction';
import { assertWholeNumber } from '../core/assert-whole-number';
import { assertAreaSize } from '../pipeline/assert-area-size';
import { assertWallBase } from '../pipeline/assert-wall-base';
import type { MapStep } from '../pipeline/map-step';
import { step } from '../pipeline/step';
import { assertCaveAreaOptions } from './assert-cave-area-options';
import { CAVE_DEFAULT_LIMITS } from './cave-default-limits';
import { carveCaveInAreas } from './carve-cave-in-areas';
import { createCaveNoise } from './create-cave-noise';
import type { GrowCaveOptions } from './grow-cave-options';
import { smoothCave } from './smooth-cave';

/**
 * A step that grows a cave with a cellular automaton: the area starts as
 * random noise and is smoothed over a number of passes until walls and floors
 * clump into caverns. The caverns are not joined; `largestOnly` keeps one of
 * them, and a tunnel step joins them. No floor is carved on a reserved tile.
 * A smaller `area` goes where `placement` says: on a free spot, beside the
 * dug ground with a wall between, or over what is there.
 *
 * It uses `caverns`, from the steps before it, and adds it again with the box
 * of each new cave appended. The map has to start as wall, which `pipeline`
 * checks before the first attempt. Throws a `RangeError` at once for a bad
 * option.
 */
export function growCave(
  options: GrowCaveOptions = {},
): MapStep<Partial<{ caverns: Area[] }>, { caverns: Area[] }> {
  const {
    fillChance = 0.45,
    iterations = 4,
    neighborhood = 'moore',
    borderWalls = true,
    symmetry = 'none',
    symmetryChance = 1,
    minRegionSize = 0,
    largestOnly = false,
    placement = 'free',
    area = {},
    count = { min: 1, max: 1 },
  } = options;
  // widened, since the neighborhoods may be added to
  const named: string = neighborhood;
  if (named !== 'moore' && named !== 'von-neumann') {
    throw new RangeError(
      `neighborhood must be 'moore' or 'von-neumann', got ${named}`,
    );
  }
  const {
    birthLimit = CAVE_DEFAULT_LIMITS[neighborhood].birthLimit,
    survivalLimit = CAVE_DEFAULT_LIMITS[neighborhood].survivalLimit,
  } = options;
  assertFraction('fillChance', fillChance);
  assertWholeNumber('iterations', iterations, 0);
  assertWholeNumber('birthLimit', birthLimit, 0);
  assertWholeNumber('survivalLimit', survivalLimit, 0);
  assertCaveAreaOptions(options);
  const rules = { birthLimit, survivalLimit, neighborhood, borderWalls };

  return step<Partial<{ caverns: Area[] }>, { caverns: Area[] }>(
    'growCave',
    {
      adds: ['caverns'],
      validate: (state) => {
        assertWallBase('growCave', state);
        assertAreaSize(area, count, state.grid.width, state.grid.height);
      },
    },
    (state, { random }) => ({
      caverns: carveCaveInAreas(
        state,
        random,
        { area, count, minRegionSize, largestOnly, placement },
        ({ width, height }) => {
          let grid = createCaveNoise(random, {
            width,
            height,
            fillChance,
            borderWalls,
            symmetry,
            symmetryChance,
          });
          for (let i = 0; i < iterations; ++i) {
            grid = smoothCave(grid, rules);
          }
          return grid;
        },
      ),
    }),
  );
}
