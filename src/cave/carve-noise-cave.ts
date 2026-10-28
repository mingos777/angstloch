import type { Area } from '../core/area';
import { assertFraction } from '../core/assert-fraction';
import { assertWholeNumber } from '../core/assert-whole-number';
import { createFractalNoise } from '../noise/create-fractal-noise';
import { createSimplexNoise } from '../noise/create-simplex-noise';
import { transformNoise } from '../noise/transform-noise';
import { assertAreaSize } from '../pipeline/assert-area-size';
import { assertWallBase } from '../pipeline/assert-wall-base';
import type { MapStep } from '../pipeline/map-step';
import { step } from '../pipeline/step';
import { assertCaveAreaOptions } from './assert-cave-area-options';
import { CAVE_DEFAULT_LIMITS } from './cave-default-limits';
import { carveCaveInAreas } from './carve-cave-in-areas';
import type { CarveNoiseCaveOptions } from './carve-noise-cave-options';
import { createNoiseCaveGrid } from './create-noise-cave-grid';
import { smoothCave } from './smooth-cave';

/**
 * A step that carves a cave by thresholding noise: the tiles with the lowest
 * noise become walls and the rest floor, which gives caverns that follow the
 * shapes of the noise. With `shape: 'veins'`, the floor follows the midpoint of
 * the noise instead, and makes winding corridors. The caverns are not joined;
 * `largestOnly` keeps one of them, and a tunnel step joins them. No floor is
 * carved on a reserved tile.
 * A smaller `area` goes where `placement` says: on a free spot, beside the
 * dug ground with a wall between, or over what is there.
 *
 * It uses `caverns`, from the steps before it, and adds it again with the box
 * of each new cave appended. The map has to start as wall, which `pipeline`
 * checks before the first attempt. Throws a `RangeError` at once for a bad
 * option.
 */
export function carveNoiseCave(
  options: CarveNoiseCaveOptions = {},
): MapStep<Partial<{ caverns: Area[] }>, { caverns: Area[] }> {
  const {
    shape = 'blobs',
    fill = 0.45,
    cornerBias = 4,
    scaleX = 12,
    scaleY = 12,
    rotation = 0,
    octaves = 3,
    persistence = 0.5,
    lacunarity = 2,
    iterations = 0,
    borderWalls = true,
    symmetry = 'none',
    symmetryChance = 1,
    minRegionSize = 0,
    largestOnly = false,
    placement = 'free',
    area = {},
    count = { min: 1, max: 1 },
  } = options;
  // widened, since the shapes may be added to
  const named: string = shape;
  if (named !== 'blobs' && named !== 'veins') {
    throw new RangeError(`shape must be 'blobs' or 'veins', got ${named}`);
  }
  assertFraction('fill', fill);
  assertWholeNumber('cornerBias', cornerBias, 0);
  assertWholeNumber('iterations', iterations, 0);
  assertCaveAreaOptions(options);
  // made once with a stand-in noise, so that a bad noise option throws at once
  transformNoise(
    createFractalNoise(() => 0, { octaves, persistence, lacunarity }),
    { scaleX, scaleY, rotation },
  );
  const rules = {
    ...CAVE_DEFAULT_LIMITS.moore,
    neighborhood: 'moore',
    borderWalls,
  } as const;

  return step<Partial<{ caverns: Area[] }>, { caverns: Area[] }>(
    'carveNoiseCave',
    {
      adds: ['caverns'],
      validate: (state) => {
        assertWallBase('carveNoiseCave', state);
        assertAreaSize(area, count, state.grid.width, state.grid.height);
      },
    },
    (state, { random }) => {
      const noise = transformNoise(
        options.noise ??
          createFractalNoise(createSimplexNoise(random), {
            octaves,
            persistence,
            lacunarity,
          }),
        { scaleX, scaleY, rotation },
      );
      return {
        caverns: carveCaveInAreas(
          state,
          random,
          { area, count, minRegionSize, largestOnly, placement },
          (box) => {
            let grid = createNoiseCaveGrid(random, {
              width: box.width,
              height: box.height,
              // sampled where the tile is on the map, so that copies differ
              noise: (x, y) => noise(x + box.x, y + box.y),
              shape,
              fill,
              cornerBias,
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
      };
    },
  );
}
