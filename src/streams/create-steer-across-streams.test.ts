import { describe, expect, it } from 'vitest';
import type { Point } from '../core/point';
import { traceTiles } from '../roads/trace-tiles';
import { mulberry32 } from '../test-helpers/mulberry32';
import { createSteerAcrossStreams } from './create-steer-across-streams';
import { layStreams } from './lay-streams';

/** A straight stream that runs top to bottom on a map of 100 by 70 tiles. */
const laid = layStreams(100, 70, mulberry32(3), {
  angle: 90,
  windiness: 0,
  width: { min: 1, max: 1 },
});
const streamX = laid.map.roads[0]?.points[0]?.x ?? 0;
const RIGHT_ANGLE = { min: 90, max: 90 };

const diagonal = traceTiles({ x: 0, y: 10 }, { x: 99, y: 60 });

describe('createSteerAcrossStreams', () => {
  it('makes a road cross the stream at the angle', () => {
    // given
    const steer = createSteerAcrossStreams(laid, mulberry32(1), RIGHT_ANGLE);

    // when
    const points = steer(diagonal);

    // then: the road runs straight across, along a row, near the stream
    const near = points.filter(({ x }) => Math.abs(x - streamX) <= 2);
    expect(new Set(near.map(({ y }) => y)).size).toBe(1);
  });

  it('keeps the road in one piece', () => {
    // given
    const steer = createSteerAcrossStreams(laid, mulberry32(1), RIGHT_ANGLE);

    // when
    const points = steer(diagonal);

    // then
    const gaps = points.filter(
      (tile, at) =>
        at > 0 &&
        Math.abs(tile.x - (points[at - 1] as Point).x) +
          Math.abs(tile.y - (points[at - 1] as Point).y) !==
          1,
    );
    expect(gaps).toEqual([]);
  });

  it('keeps the ends of the road where they were', () => {
    // given
    const steer = createSteerAcrossStreams(laid, mulberry32(1), RIGHT_ANGLE);

    // when
    const points = steer(diagonal);

    // then
    expect(points[0]).toEqual({ x: 0, y: 10 });
    expect(points[points.length - 1]).toEqual({ x: 99, y: 60 });
  });

  it('leaves a road that never meets the stream as it is', () => {
    // given
    const steer = createSteerAcrossStreams(laid, mulberry32(1), RIGHT_ANGLE);
    const road = traceTiles({ x: 1, y: 0 }, { x: 1, y: 69 });

    // when
    const points = steer(road);

    // then
    expect(points).toEqual(road);
  });

  it('keeps a road that starts beside the stream on the map', () => {
    // given
    const steer = createSteerAcrossStreams(laid, mulberry32(1), RIGHT_ANGLE);
    const road = traceTiles({ x: streamX - 1, y: 0 }, { x: streamX + 1, y: 4 });

    // when
    const points = steer(road);

    // then
    expect(
      points.every(({ x, y }) => x >= 0 && y >= 0 && x < 100 && y < 70),
    ).toBe(true);
  });

  it('keeps a road that runs beside the stream away from the water', () => {
    // given
    const steer = createSteerAcrossStreams(laid, mulberry32(1), RIGHT_ANGLE);
    const road = [
      ...traceTiles({ x: streamX + 12, y: 0 }, { x: streamX + 1, y: 35 }),
      ...traceTiles(
        { x: streamX + 1, y: 35 },
        { x: streamX + 12, y: 69 },
      ).slice(1),
    ];

    // when
    const points = steer(road);

    // then
    expect(points.filter(({ x }) => Math.abs(x - streamX) <= 2)).toEqual([]);
  });

  it('makes a road that weaves over the stream cross it once', () => {
    // given
    const steer = createSteerAcrossStreams(laid, mulberry32(1), RIGHT_ANGLE);
    const weave = [
      ...traceTiles({ x: streamX - 8, y: 20 }, { x: streamX + 8, y: 24 }),
      ...traceTiles({ x: streamX + 8, y: 24 }, { x: streamX - 8, y: 28 }).slice(
        1,
      ),
      ...traceTiles({ x: streamX - 8, y: 28 }, { x: streamX + 8, y: 32 }).slice(
        1,
      ),
    ];

    // when
    const points = steer(weave);

    // then: the road is at the stream's centerline on one row only
    expect(
      new Set(points.filter(({ x }) => x === streamX).map(({ y }) => y)).size,
    ).toBe(1);
  });

  it('moves along the edge a road end that lies in the water', () => {
    // given
    const steer = createSteerAcrossStreams(laid, mulberry32(1), RIGHT_ANGLE);
    const road = traceTiles({ x: streamX, y: 0 }, { x: streamX + 12, y: 69 });

    // when
    const points = steer(road);

    // then
    const start = points[0];
    expect(start?.y).toBe(0);
    expect(Math.abs((start?.x ?? 0) - streamX)).toBeGreaterThan(3);
  });
});
