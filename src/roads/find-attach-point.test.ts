import { describe, expect, it } from 'vitest';
import { createSimplexNoise } from '../noise/create-simplex-noise';
import { mulberry32 } from '../test-helpers/mulberry32';
import { findAttachPoint } from './find-attach-point';
import type { RoadMap } from './road-map';

function mapWith(
  points: { x: number; y: number }[],
  junctions: { x: number; y: number }[] = [],
): RoadMap {
  return {
    mapWidth: 60,
    mapHeight: 60,
    windiness: 0,
    noise: createSimplexNoise(mulberry32(1)),
    covered: new Uint8Array(60 * 60),
    owner: new Int32Array(60 * 60).fill(-1),
    roads: [{ kind: 'road', width: 1, points }],
    junctions,
  };
}

const line = (length: number) =>
  Array.from({ length }, (_, i) => ({ x: i, y: 30 }));

describe('findAttachPoint', () => {
  it('picks a tile of a road, away from its ends', () => {
    // given
    const map = mapWith(line(40));

    // when
    const found = Array.from({ length: 40 }, (_, seed) =>
      findAttachPoint(map, mulberry32(seed)),
    );

    // then
    for (const attach of found) {
      expect(attach?.tile.y).toBe(30);
      expect(attach?.tile.x).toBeGreaterThanOrEqual(6);
      expect(attach?.tile.x).toBeLessThanOrEqual(33);
    }
  });

  it('reports the heading of the road along its centerline', () => {
    // given
    const map = mapWith(line(40));

    // when
    const attach = findAttachPoint(map, mulberry32(1));

    // then
    expect(attach?.heading).toBeCloseTo(0);
  });

  it('reports a heading that follows a road going down', () => {
    // given
    const map = mapWith(
      Array.from({ length: 40 }, (_, i) => ({ x: 10, y: i })),
    );

    // when
    const attach = findAttachPoint(map, mulberry32(1));

    // then
    expect(attach?.heading).toBeCloseTo(Math.PI / 2);
  });

  it('finds nothing on a road that is too short', () => {
    // given
    const map = mapWith(line(12));

    // when
    const attach = findAttachPoint(map, mulberry32(1));

    // then
    expect(attach).toBeUndefined();
  });

  it('keeps away from junctions', () => {
    // given
    const map = mapWith(line(60), [{ x: 30, y: 30 }]);

    // when
    const found = Array.from({ length: 60 }, (_, seed) =>
      findAttachPoint(map, mulberry32(seed)),
    );

    // then
    for (const attach of found) {
      expect(Math.abs((attach?.tile.x ?? 30) - 30)).toBeGreaterThanOrEqual(8);
    }
  });

  it('finds nothing when junctions are all over the road', () => {
    // given
    const junctions = [10, 18, 26, 34, 42].map((x) => ({ x, y: 30 }));
    const map = mapWith(line(50), junctions);

    // when
    const attach = findAttachPoint(map, mulberry32(1));

    // then
    expect(attach).toBeUndefined();
  });

  it('prefers longer roads', () => {
    // given
    const map = mapWith(line(30));
    map.roads.push({
      kind: 'branch',
      width: 1,
      points: Array.from({ length: 200 }, (_, i) => ({ x: i % 60, y: 10 })),
    });

    // when
    let onLong = 0;
    for (let seed = 0; seed < 200; ++seed) {
      onLong += findAttachPoint(map, mulberry32(seed))?.tile.y === 10 ? 1 : 0;
    }

    // then
    expect(onLong).toBeGreaterThan(130);
  });
});
