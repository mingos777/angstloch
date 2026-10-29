import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../test-helpers/mulberry32';
import { clearRoadEnd } from './clear-road-end';
import { createStreamTerrain } from './create-stream-terrain';
import { buildStreams } from './build-streams';

/** A straight stream, 1 tile wide, that runs top to bottom on a map of 40 by 30 tiles. */
const terrain = createStreamTerrain(
  buildStreams(40, 30, mulberry32(3), {
    angle: 90,
    windiness: 0,
    width: { min: 1, max: 1 },
  }),
);
const streamX = terrain.centers.find(({ y }) => y === 0)?.x ?? 0;
const verge = terrain.verge(2);
const right = terrain.pieces[streamX + 5] ?? -1;

describe('clearRoadEnd', () => {
  it('leaves an end that is clear of the verge where it is', () => {
    // given
    const tile = { x: streamX + 5, y: 0 };

    // when
    const end = clearRoadEnd(terrain, tile, right, verge);

    // then
    expect(end).toEqual(tile);
  });

  it('leaves an end inside the map where it is', () => {
    // given
    const tile = { x: streamX, y: 10 };

    // when
    const end = clearRoadEnd(terrain, tile, right, verge);

    // then
    expect(end).toEqual(tile);
  });

  it('moves an end in the water along its side to the nearest clear tile of the land the road is on', () => {
    // given
    const tile = { x: streamX, y: 0 };

    // when
    const end = clearRoadEnd(terrain, tile, right, verge);

    // then
    expect(end).toEqual({ x: streamX + 3, y: 0 });
  });

  it('moves it to the other land when the road is on that', () => {
    // given
    const tile = { x: streamX, y: 0 };
    const left = terrain.pieces[streamX - 5] ?? -1;

    // when
    const end = clearRoadEnd(terrain, tile, left, verge);

    // then
    expect(end).toEqual({ x: streamX - 3, y: 0 });
  });
});
