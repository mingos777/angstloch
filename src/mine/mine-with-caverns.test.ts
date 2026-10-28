import { describe, expect, it } from 'vitest';
import { carveNoiseCave } from '../cave/carve-noise-cave';
import { digCaveTunnels } from '../cave/dig-cave-tunnels';
import { findCaveRegions } from '../cave/find-cave-regions';
import { Tile } from '../core/tile';
import { emptyMap } from '../pipeline/empty-map';
import { pipeline } from '../pipeline/pipeline';
import { mulberry32 } from '../test-helpers/mulberry32';
import { digFishbone } from './dig-fishbone';

const base = emptyMap({ width: 80, height: 50, tile: Tile.Wall });
const steps = [
  digFishbone({
    area: { width: { min: 40, max: 40 }, height: { min: 26, max: 26 } },
  }),
  carveNoiseCave({
    largestOnly: true,
    area: { width: { min: 16, max: 16 }, height: { min: 12, max: 12 } },
    count: { min: 2, max: 2 },
  }),
] as const;

describe('a mine with caverns', () => {
  it.each([1, 2, 3, 4])(
    'is joined into one piece by digCaveTunnels (seed %i)',
    (seed) => {
      // given
      const apart = pipeline(base, steps, { random: mulberry32(seed) });

      // when
      const { grid } = pipeline(base, [...steps, digCaveTunnels()], {
        random: mulberry32(seed),
      });

      // then
      expect(findCaveRegions(apart.grid).length).toBeGreaterThanOrEqual(3);
      expect(findCaveRegions(grid)).toHaveLength(1);
    },
  );
});
