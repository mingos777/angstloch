import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../test-helpers/mulberry32';
import { buildStreams } from './build-streams';
import type { StreamOptions } from './stream-options';

function lay(options: StreamOptions, seed = 1) {
  return buildStreams(100, 70, mulberry32(seed), options);
}

describe('buildStreams', () => {
  it('lays a stream from one border to the opposite one', () => {
    // given
    const options = { angle: 0, windiness: 0 };

    // when
    const { map } = lay(options);

    // then
    const points = map.roads[0]?.points ?? [];
    expect(points[0]?.x).toBe(0);
    expect(points[points.length - 1]?.x).toBe(99);
  });

  it('makes the water flow the way of the angle', () => {
    // given
    const options = { angle: 90, windiness: 0 };

    // when
    const { map } = lay(options);

    // then
    const points = map.roads[0]?.points ?? [];
    expect(points[0]?.y).toBe(0);
    expect(points[points.length - 1]?.y).toBe(69);
  });

  it('picks the width from the range', () => {
    // given
    const options = { width: { min: 4, max: 4 } };

    // when
    const { map } = lay(options);

    // then
    expect(map.roads[0]?.width).toBe(4);
  });

  it('marks the tiles of the stream as water', () => {
    // given
    const options = { angle: 0, windiness: 0, width: { min: 1, max: 1 } };

    // when
    const { water } = lay(options);

    // then
    expect(water.reduce((sum, tile) => sum + tile, 0)).toBe(100);
  });

  it('puts deep water in the middle of a wide stream', () => {
    // given
    const options = { angle: 0, windiness: 0, width: { min: 3, max: 3 } };

    // when
    const { deep } = lay(options);

    // then
    expect(deep.reduce((sum, tile) => sum + tile, 0)).toBe(100);
  });

  it('gives a narrow stream no deep water', () => {
    // given
    const options = { width: { min: 2, max: 2 } };

    // when
    const { deep } = lay(options);

    // then
    expect(deep.reduce((sum, tile) => sum + tile, 0)).toBe(0);
  });

  it('gives the same stream for the same seed', () => {
    // given
    const options = { windiness: 0.8 };

    // when
    const first = lay(options, 7);
    const second = lay(options, 7);

    // then
    expect(first.map.roads).toEqual(second.map.roads);
  });

  it('lays no tributary by default', () => {
    // given
    const options = {};

    // when
    const { streams } = lay(options);

    // then
    expect(streams).toHaveLength(1);
  });

  it('lays the tributaries asked for', () => {
    // given
    const options = { tributaries: { min: 2, max: 2 } };

    // when
    const { streams } = lay(options);

    // then
    expect(streams.map(({ kind }) => kind)).toEqual([
      'road',
      'branch',
      'branch',
    ]);
  });

  it('picks the width of a tributary from its own range', () => {
    // given
    const options = {
      width: { min: 3, max: 3 },
      tributaries: { min: 1, max: 1 },
      tributaryWidth: { min: 2, max: 2 },
    };

    // when
    const { streams } = lay(options);

    // then
    expect(streams.map(({ width }) => width)).toEqual([3, 2]);
  });

  it('ends a tributary in the stream it joins', () => {
    // given
    const options = {
      angle: 0,
      windiness: 0,
      tributaries: { min: 1, max: 1 },
    };

    // when
    const { streams } = lay(options);

    // then
    const [main, tributary] = streams;
    const mouth = tributary?.points.at(-1);
    expect(main?.points).toContainEqual(mouth);
  });

  it('makes a tributary join at the angle, flowing the same way as the stream', () => {
    // given
    const options = {
      angle: 0,
      windiness: 0,
      tributaries: { min: 1, max: 1 },
      tributaryAngle: { min: 45, max: 45 },
    };

    // when
    const { streams } = lay(options);

    // then: from its source to the mouth the tributary goes right, and at 45 degrees
    const points = streams[1]?.points ?? [];
    const source = points[0] ?? { x: 0, y: 0 };
    const mouth = points.at(-1) ?? { x: 0, y: 0 };
    const degrees =
      (Math.atan2(mouth.y - source.y, mouth.x - source.x) * 180) / Math.PI;
    expect(Math.abs(degrees)).toBeGreaterThan(40);
    expect(Math.abs(degrees)).toBeLessThan(50);
  });

  it('starts a tributary in the forest when it has a length', () => {
    // given
    const options = {
      tributaries: { min: 1, max: 1 },
      tributaryLength: { min: 10, max: 10 },
    };

    // when
    const { streams } = lay(options);

    // then
    const source = streams[1]?.points[0] ?? { x: 0, y: 0 };
    expect(source.x > 0 && source.y > 0 && source.x < 99 && source.y < 69).toBe(
      true,
    );
  });

  it('makes the water of a tributary part of the stream', () => {
    // given
    const options = {
      tributaries: { min: 1, max: 1 },
      width: { min: 1, max: 1 },
    };

    // when
    const { water, streams } = lay(options);

    // then
    const source = streams[1]?.points[0] ?? { x: 0, y: 0 };
    expect(water[source.y * 100 + source.x]).toBe(1);
  });

  it('starts a stream at a spring in the forest', () => {
    // given
    const options = { angle: 0, windiness: 0, spring: true };

    // when
    const { streams } = lay(options);

    // then: the first point is inside the map and the last is on the border
    const points = streams[0]?.points ?? [];
    const spring = points[0] ?? { x: 0, y: 0 };
    expect(spring.x).toBeGreaterThan(0);
    expect(spring.x).toBeLessThan(99);
    expect(points.at(-1)?.x).toBe(99);
  });

  it('lays no water upstream of a spring', () => {
    // given
    const options = { angle: 0, windiness: 0, spring: true };

    // when
    const { streams, water } = lay(options);

    // then
    const spring = streams[0]?.points[0] ?? { x: 0, y: 0 };
    expect(water[spring.y * 100 + spring.x - 3]).toBe(0);
  });
});
