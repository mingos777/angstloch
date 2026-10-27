import { describe, expect, it } from 'vitest';
import { createSimplexNoise } from '../noise/create-simplex-noise';
import { mulberry32 } from '../test-helpers/mulberry32';
import { addRoad } from './add-road';
import type { RoadMap } from './road-map';

function emptyMap(size = 21): RoadMap {
  return {
    mapWidth: size,
    mapHeight: size,
    windiness: 0,
    noise: createSimplexNoise(mulberry32(1)),
    covered: new Uint8Array(size * size),
    owner: new Int32Array(size * size).fill(-1),
    roads: [],
    junctions: [],
  };
}

const HORIZONTAL = {
  kind: 'road',
  width: 1,
  origin: { x: 10.5, y: 10.5 },
  angle: 0,
  directions: [-1, 1],
} as const;

describe('addRoad', () => {
  it('adds the road to the map and returns it', () => {
    // given
    const map = emptyMap();

    // when
    const road = addRoad(map, HORIZONTAL);

    // then
    expect(map.roads).toEqual([road]);
    expect(road.kind).toBe('road');
    expect(road.width).toBe(1);
    expect(road.points).toHaveLength(21);
  });

  it('covers the tiles of the road', () => {
    // given
    const map = emptyMap();

    // when
    addRoad(map, HORIZONTAL);

    // then
    expect(map.covered.reduce((sum, c) => sum + c, 0)).toBe(21);
  });

  it('makes no junction for the first road', () => {
    // given
    const map = emptyMap();

    // when
    addRoad(map, HORIZONTAL);

    // then
    expect(map.junctions).toEqual([]);
  });

  it('makes a junction where a road crosses another', () => {
    // given
    const map = emptyMap();
    addRoad(map, HORIZONTAL);

    // when
    addRoad(map, {
      ...HORIZONTAL,
      origin: { x: 5.5, y: 5.5 },
      angle: Math.PI / 2,
    });

    // then
    expect(map.junctions).toEqual([{ x: 5, y: 10 }]);
  });

  it('makes a junction where a road starts on another', () => {
    // given
    const map = emptyMap();
    addRoad(map, HORIZONTAL);

    // when
    addRoad(map, {
      kind: 'branch',
      width: 1,
      origin: { x: 8.5, y: 10.5 },
      angle: -Math.PI / 2,
      directions: [1],
    });

    // then
    expect(map.junctions).toEqual([{ x: 8, y: 10 }]);
  });

  it('makes one junction for a stretch of tiles that two roads share', () => {
    // given
    const map = emptyMap();
    addRoad(map, HORIZONTAL);

    // when
    addRoad(map, {
      kind: 'branch',
      width: 1,
      origin: { x: 3.5, y: 10.5 },
      angle: 0,
      directions: [1],
      maxLength: 8,
    });

    // then
    expect(map.junctions).toEqual([{ x: 3, y: 10 }]);
  });

  it('makes no junction for roads that do not touch', () => {
    // given
    const map = emptyMap();
    addRoad(map, HORIZONTAL);

    // when
    addRoad(map, { ...HORIZONTAL, origin: { x: 10.5, y: 3.5 } });

    // then
    expect(map.junctions).toEqual([]);
  });

  it('stops a road that leaves the origin at its maximum length', () => {
    // given
    const map = emptyMap(41);

    // when
    const road = addRoad(map, {
      kind: 'branch',
      width: 1,
      origin: { x: 5.5, y: 20.5 },
      angle: 0,
      directions: [1],
      maxLength: 10,
    });

    // then
    expect(road.points).toHaveLength(11);
    expect(road.points[road.points.length - 1]).toEqual({ x: 15, y: 20 });
  });

  it('keeps going to the border when there is no maximum length', () => {
    // given
    const map = emptyMap(41);

    // when
    const road = addRoad(map, {
      kind: 'branch',
      width: 1,
      origin: { x: 5.5, y: 20.5 },
      angle: 0,
      directions: [1],
    });

    // then
    expect(road.points[road.points.length - 1]).toEqual({ x: 40, y: 20 });
  });

  it('gives roads different bends', () => {
    // given
    const bendy = { ...emptyMap(), windiness: 1 };
    const first = addRoad(bendy, {
      ...HORIZONTAL,
      origin: { x: 10.5, y: 5.5 },
    });

    // when
    const second = addRoad(bendy, {
      ...HORIZONTAL,
      origin: { x: 10.5, y: 15.5 },
    });

    // then
    const shape = (points: { y: number }[], base: number) =>
      points.map((p) => p.y - base).join();
    expect(shape(first.points, 5)).not.toBe(shape(second.points, 15));
  });

  it('covers the border where a road leaves the map as if it went on', () => {
    // given
    const map = emptyMap();

    // when
    addRoad(map, { ...HORIZONTAL, width: 3, angle: Math.PI / 6 });

    // then
    expect(map.covered[2 * 21 + 0]).toBe(1);
    expect(map.covered[19 * 21 + 20]).toBe(1);
  });
});
