import { describe, expect, it } from 'vitest';
import type { Point } from '../core/point';
import { traceTiles } from '../roads/trace-tiles';
import { mulberry32 } from '../test-helpers/mulberry32';
import { createStreamTerrain } from './create-stream-terrain';
import { layStreams } from './lay-streams';
import { planCrossings } from './plan-crossings';

/** A straight stream, 1 tile wide, that runs top to bottom on a map of 100 by 70 tiles. */
const terrain = createStreamTerrain(
  layStreams(100, 70, mulberry32(3), {
    angle: 90,
    windiness: 0,
    width: { min: 1, max: 1 },
  }),
);
const streamX = terrain.centers.find(({ y }) => y === 0)?.x ?? 0;
const RIGHT_ANGLE = { min: 90, max: 90 };

function plan(points: Point[], width = 3) {
  return planCrossings(terrain, points, width, mulberry32(1), RIGHT_ANGLE);
}

const diagonal = traceTiles({ x: 0, y: 10 }, { x: 99, y: 60 });

describe('planCrossings', () => {
  it('plans one crossing for a road that crosses the stream once', () => {
    // when
    const planned = plan(diagonal);

    // then
    expect(planned?.crossings).toHaveLength(1);
  });

  it('crosses at the angle, in a straight line from the approach to the departure', () => {
    // when
    const crossing = plan(diagonal)?.crossings[0];

    // then: square to a stream that runs top to bottom is along a row
    const { approach, entry, exit, departure } = crossing ?? {};
    expect(
      new Set([approach, entry, exit, departure].map((tile) => tile?.y)).size,
    ).toBe(1);
    expect(Math.abs(Math.cos(crossing?.direction ?? 0))).toBeCloseTo(1);
  });

  it('puts the bridge between tiles clear of the verge on both banks', () => {
    // when
    const crossing = plan(diagonal)?.crossings[0];

    // then
    expect(crossing?.entry.x).toBe(streamX - 3);
    expect(crossing?.exit.x).toBe(streamX + 3);
  });

  it('plans one crossing for a road that weaves over the stream', () => {
    // given
    const weave = [
      ...traceTiles({ x: 0, y: 20 }, { x: streamX + 8, y: 24 }),
      ...traceTiles({ x: streamX + 8, y: 24 }, { x: streamX - 8, y: 28 }).slice(
        1,
      ),
      ...traceTiles({ x: streamX - 8, y: 28 }, { x: 99, y: 40 }).slice(1),
    ];

    // when
    const planned = plan(weave);

    // then
    expect(planned?.crossings).toHaveLength(1);
  });

  it('plans no crossing for a road that comes near the stream and goes back', () => {
    // given
    const road = [
      ...traceTiles({ x: streamX + 20, y: 0 }, { x: streamX + 1, y: 35 }),
      ...traceTiles(
        { x: streamX + 1, y: 35 },
        { x: streamX + 20, y: 69 },
      ).slice(1),
    ];

    // when
    const planned = plan(road);

    // then
    expect(planned?.crossings).toEqual([]);
  });

  it('keeps an end inside the map, and the road as grown up to its first tile clear of the verge', () => {
    // given
    const branch = traceTiles({ x: streamX + 1, y: 30 }, { x: 99, y: 30 });

    // when
    const planned = plan(branch);

    // then
    expect(planned?.head).toEqual(branch.slice(0, 2));
    expect(planned?.start).toEqual({ x: streamX + 3, y: 30 });
  });

  it('keeps a moved end on its side of the map', () => {
    // given
    const road = traceTiles({ x: streamX, y: 0 }, { x: streamX + 12, y: 69 });

    // when
    const planned = plan(road);

    // then
    expect(planned?.start.y).toBe(0);
    expect(Math.abs((planned?.start.x ?? streamX) - streamX)).toBeGreaterThan(
      2,
    );
  });

  it('gives up on a road that never leaves the verge', () => {
    // given
    const road = traceTiles({ x: streamX, y: 10 }, { x: streamX, y: 20 });

    // when
    const planned = plan(road);

    // then
    expect(planned).toBeUndefined();
  });

  it('keeps a road of width 1 closer to the water', () => {
    // when
    const crossing = plan(diagonal, 1)?.crossings[0];

    // then
    expect(crossing?.entry.x).toBe(streamX - 2);
  });
});
