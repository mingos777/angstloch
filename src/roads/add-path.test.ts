import { describe, expect, it } from 'vitest';
import { createSimplexNoise } from '../noise/create-simplex-noise';
import { mulberry32 } from '../test-helpers/mulberry32';
import { addPath } from './add-path';
import { addRoad } from './add-road';
import type { RoadMap } from './road-map';

function emptyMap(windiness = 0, size = 41): RoadMap {
  return {
    mapWidth: size,
    mapHeight: size,
    windiness,
    noise: createSimplexNoise(mulberry32(1)),
    covered: new Uint8Array(size * size),
    owner: new Int32Array(size * size).fill(-1),
    roads: [],
    junctions: [],
  };
}

const PATH = {
  kind: 'branch',
  width: 1,
  from: { x: 5.5, y: 20.5 },
  to: { x: 30.5, y: 20.5 },
} as const;

describe('addPath', () => {
  it('adds the path to the map and returns it', () => {
    // given
    const map = emptyMap();

    // when
    const road = addPath(map, PATH);

    // then
    expect(map.roads).toEqual([road]);
    expect(road.kind).toBe('branch');
    expect(road.width).toBe(1);
  });

  it('runs from one end to the other', () => {
    // given
    const map = emptyMap(1);

    // when
    const { points } = addPath(map, PATH);

    // then
    expect(points[0]).toEqual({ x: 5, y: 20 });
    expect(points[points.length - 1]).toEqual({ x: 30, y: 20 });
  });

  it('moves one tile at a time along an edge', () => {
    // given
    const map = emptyMap(1);

    // when
    const { points } = addPath(map, PATH);

    // then
    for (let i = 1; i < points.length; ++i) {
      const a = points[i - 1];
      const b = points[i];
      expect(
        Math.abs((a?.x ?? 0) - (b?.x ?? 0)) +
          Math.abs((a?.y ?? 0) - (b?.y ?? 0)),
      ).toBe(1);
    }
  });

  it('covers the tiles of the path', () => {
    // given
    const map = emptyMap();

    // when
    addPath(map, PATH);

    // then
    expect(map.covered[20 * 41 + 5]).toBe(1);
    expect(map.covered[20 * 41 + 30]).toBe(1);
    expect(map.covered[19 * 41 + 15]).toBe(0);
  });

  it('makes a junction where it meets a road', () => {
    // given
    const map = emptyMap();
    addRoad(map, {
      kind: 'road',
      width: 1,
      origin: { x: 15.5, y: 20.5 },
      angle: Math.PI / 2,
      directions: [-1, 1],
    });

    // when
    addPath(map, PATH);

    // then
    expect(map.junctions).toEqual([{ x: 15, y: 20 }]);
  });

  it('ends a road at the end of a path', () => {
    // given
    const map = emptyMap();
    const road = addRoad(map, {
      kind: 'road',
      width: 1,
      origin: { x: 5.5, y: 5.5 },
      angle: 0,
      directions: [1],
      maxLength: 10,
    });
    const end = road.points[road.points.length - 1];

    // when
    const { points } = addPath(map, {
      kind: 'branch',
      width: 1,
      from: { x: (end?.x ?? 0) + 0.5, y: (end?.y ?? 0) + 0.5 },
      to: { x: 30.5, y: 30.5 },
    });

    // then
    expect(points[0]).toEqual(end);
  });
});
