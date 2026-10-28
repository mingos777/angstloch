import { describe, expect, it } from 'vitest';
import { digNoiseCave } from '../cave/dig-noise-cave';
import { digCaveTunnels } from '../cave/dig-cave-tunnels';
import { findCaveRegions } from '../cave/find-cave-regions';
import { digCellularCave } from '../cave/dig-cellular-cave';
import type { Grid } from '../core/grid';
import { Tile } from '../core/tile';
import { digCorridors } from '../dungeon/dig-corridors';
import { placeClusteredRooms } from '../dungeon/place-clustered-rooms';
import { placeScatteredRooms } from '../dungeon/place-scattered-rooms';
import { emptyMap } from '../pipeline/empty-map';
import { pipeline } from '../pipeline/pipeline';
import type { AnyStep } from '../pipeline/pipeline-chain';
import { SEEDS } from '../test-helpers/dungeon-checks';
import { mulberry32 } from '../test-helpers/mulberry32';
import { digFishbone } from './dig-fishbone';
import { digPillarHalls } from './dig-pillar-halls';

const base = emptyMap({ width: 61, height: 41, tile: Tile.Wall });

/** The number of pieces that the tiles that are not wall make, joined along edges. */
function pieces(grid: Grid): number {
  const open = grid.clone();
  for (let y = 0; y < grid.height; ++y) {
    for (let x = 0; x < grid.width; ++x) {
      if (grid.get(x, y) !== Tile.Wall) {
        open.set(x, y, Tile.Floor);
      }
    }
  }
  return findCaveRegions(open).length;
}

function build(steps: AnyStep[], seed: number) {
  return pipeline(base, steps, { random: mulberry32(seed) });
}

describe('features with rooms', () => {
  it.each([
    [
      'a pillar hall in an area and scattered rooms',
      () => [
        digPillarHalls({
          area: { width: { min: 16, max: 16 }, height: { min: 12, max: 12 } },
        }),
        placeScatteredRooms(),
        digCorridors(),
      ],
    ],
    [
      'a noise cavern in an area and grown rooms',
      () => [
        digNoiseCave({
          largestOnly: true,
          area: { width: { min: 16, max: 16 }, height: { min: 12, max: 12 } },
        }),
        placeClusteredRooms(),
        digCorridors(),
      ],
    ],
    [
      'a whole mine and scattered rooms',
      () => [
        digFishbone(),
        placeScatteredRooms({ roomCount: { min: 4, max: 6 } }),
        digCorridors(),
      ],
    ],
    [
      'a cavern in an area and scattered rooms, joined by cave tunnels',
      () => [
        digCellularCave({
          fillChance: 0.5,
          area: { width: { min: 24, max: 24 }, height: { min: 16, max: 16 } },
        }),
        placeScatteredRooms({ roomCount: { min: 4, max: 6 } }),
        digCaveTunnels(),
      ],
    ],
  ] as [string, () => AnyStep[]][])(
    'joins %s into one piece',
    (_name, steps) => {
      // when
      const results = SEEDS.map((seed) => build(steps(), seed));

      // then
      expect(results.map(({ grid }) => pieces(grid))).toEqual(
        SEEDS.map(() => 1),
      );
    },
  );

  it('lists only the rooms of the room step as rooms', () => {
    // given
    const rooms = { roomCount: { min: 5, max: 5 } };

    // when
    const results = SEEDS.map(
      (seed) =>
        build(
          [digFishbone(), placeScatteredRooms(rooms), digCorridors()],
          seed,
        ) as {
          rooms?: unknown[];
          roomShapes?: unknown[];
        },
    );

    // then
    for (const { rooms: listed, roomShapes } of results) {
      expect(listed).toHaveLength(5);
      expect(roomShapes).toHaveLength(5);
    }
  });

  it.each(SEEDS)('joins pillar halls with no rooms at all, seed %i', (seed) => {
    // given
    const steps = [digPillarHalls(), digCorridors()] as const;

    // when
    const { grid, rooms } = pipeline(base, steps, {
      random: mulberry32(seed),
    });

    // then
    expect(rooms).toEqual([]);
    expect(pieces(grid)).toBe(1);
  });
});
