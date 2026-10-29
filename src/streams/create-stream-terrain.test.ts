import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../test-helpers/mulberry32';
import { createStreamTerrain } from './create-stream-terrain';
import { buildStreams } from './build-streams';

/** A straight stream, 1 tile wide, that runs top to bottom on a map of 40 by 30 tiles. */
const laid = buildStreams(40, 30, mulberry32(3), {
  angle: 90,
  windiness: 0,
  width: { min: 1, max: 1 },
});
const streamX = laid.map.roads[0]?.points[0]?.x ?? 0;

describe('createStreamTerrain', () => {
  it('numbers the land on both sides of the stream as two pieces', () => {
    // when
    const { pieces, sizes } = createStreamTerrain(laid);

    // then
    expect(sizes).toHaveLength(2);
    expect(pieces[5 * 40 + streamX]).toBe(-1);
    expect(pieces[5 * 40 + streamX - 1]).not.toBe(pieces[5 * 40 + streamX + 1]);
  });

  it('knows the two pieces lie across the stream from each other', () => {
    // when
    const { neighbors } = createStreamTerrain(laid);

    // then
    expect([...(neighbors.get(0) ?? [])]).toEqual([1]);
    expect([...(neighbors.get(1) ?? [])]).toEqual([0]);
  });

  it('lists every tile of the centerline once, with the way the stream runs', () => {
    // when
    const { centers } = createStreamTerrain(laid);

    // then
    expect(centers).toHaveLength(30);
    expect(centers.every(({ heading }) => heading === Math.PI / 2)).toBe(true);
  });

  it('grows the water into a verge of the radius, once for each radius', () => {
    // given
    const terrain = createStreamTerrain(laid);

    // when
    const verge = terrain.verge(2);

    // then
    expect(verge[5 * 40 + streamX + 2]).toBe(1);
    expect(verge[5 * 40 + streamX + 3]).toBe(0);
    expect(terrain.verge(2)).toBe(verge);
  });
});
