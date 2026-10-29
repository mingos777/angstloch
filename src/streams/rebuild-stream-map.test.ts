import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../test-helpers/mulberry32';
import { buildStreams } from './build-streams';
import { rebuildStreamMap } from './rebuild-stream-map';

function lay(seed: number) {
  return buildStreams(80, 50, mulberry32(seed), {
    tributaries: { min: 2, max: 2 },
    width: { min: 2, max: 3 },
  });
}

describe('rebuildStreamMap', () => {
  it.each([1, 2, 3, 4, 5])('rebuilds the water of seed %i exactly', (seed) => {
    // given
    const laid = lay(seed);

    // when
    const rebuilt = rebuildStreamMap(laid.streams, 80, 50);

    // then
    expect(rebuilt.water).toEqual(laid.water);
  });

  it('rebuilds the roads of the map in the order they were grown', () => {
    // given
    const laid = lay(1);

    // when
    const rebuilt = rebuildStreamMap(laid.streams, 80, 50);

    // then
    expect(rebuilt.map.roads).toEqual(laid.map.roads);
  });

  it('rebuilds the junctions and the owners of the tiles', () => {
    // given
    const laid = lay(2);

    // when
    const rebuilt = rebuildStreamMap(laid.streams, 80, 50);

    // then
    expect(rebuilt.map.junctions).toEqual(laid.map.junctions);
    expect(rebuilt.map.owner).toEqual(laid.map.owner);
  });

  it('keeps the streams as they were reported', () => {
    // given
    const laid = lay(1);

    // when
    const rebuilt = rebuildStreamMap(laid.streams, 80, 50);

    // then
    expect(rebuilt.streams).toEqual(laid.streams);
  });

  it('does not change the streams it is given', () => {
    // given
    const laid = lay(1);
    const before = structuredClone(laid.streams);

    // when
    rebuildStreamMap(laid.streams, 80, 50);

    // then
    expect(laid.streams).toEqual(before);
  });
});
