import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../test-helpers/mulberry32';
import { createRoadMap } from './create-road-map';
import { layRoadNetwork } from './lay-road-network';
import { rebuildRoadMap } from './rebuild-road-map';

function lay(seed: number) {
  const map = createRoadMap(80, 50, mulberry32(seed), 0.3);
  layRoadNetwork(map, mulberry32(seed + 100), {
    crossings: { min: 2, max: 2 },
    branches: { min: 3, max: 3 },
  });
  return map;
}

describe('rebuildRoadMap', () => {
  it.each([1, 2, 3, 4, 5])(
    'rebuilds the covered tiles of seed %i exactly',
    (seed) => {
      // given
      const laid = lay(seed);

      // when
      const rebuilt = rebuildRoadMap(laid.roads, 80, 50, mulberry32(1));

      // then
      expect(rebuilt.covered).toEqual(laid.covered);
    },
  );

  it('rebuilds the junctions and the owners of the tiles', () => {
    // given
    const laid = lay(2);

    // when
    const rebuilt = rebuildRoadMap(laid.roads, 80, 50, mulberry32(1));

    // then
    expect(rebuilt.junctions).toEqual(laid.junctions);
    expect(rebuilt.owner).toEqual(laid.owner);
    expect(rebuilt.roads).toEqual(laid.roads);
  });

  it('makes an empty map from no roads', () => {
    // given
    const roads = [] as const;

    // when
    const rebuilt = rebuildRoadMap(roads, 10, 10, mulberry32(1));

    // then
    expect(rebuilt.roads).toEqual([]);
    expect(rebuilt.covered.every((tile) => tile === 0)).toBe(true);
  });

  it('takes the windiness it is given', () => {
    // given
    const roads = lay(1).roads;

    // when
    const rebuilt = rebuildRoadMap(roads, 80, 50, mulberry32(1), 0.8);

    // then
    expect(rebuilt.windiness).toBe(0.8);
  });
});
