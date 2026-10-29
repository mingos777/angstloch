import { describe, expect, it } from 'vitest';
import { addRoad } from '../roads/add-road';
import { createRoadMap } from '../roads/create-road-map';
import { mulberry32 } from '../test-helpers/mulberry32';
import { buildClearingPaths } from './build-clearing-paths';

const PATH = { width: 1, windiness: 0, clearing: 0 };

function emptyMap(size = 61) {
  return createRoadMap(size, size, mulberry32(1), 0);
}

describe('buildClearingPaths', () => {
  it('starts a path at the nearest road tile', () => {
    // given
    const map = emptyMap();
    addRoad(map, {
      kind: 'road',
      width: 1,
      origin: { x: 10.5, y: 30.5 },
      angle: Math.PI / 2,
      directions: [-1, 1],
    });

    // when
    buildClearingPaths(map, [{ ...PATH, to: { x: 40, y: 20 } }]);

    // then
    const path = map.roads[1];
    expect(path?.points[0]).toEqual({ x: 10, y: 20 });
    expect(path?.points[path.points.length - 1]).toEqual({ x: 40, y: 20 });
  });

  it('stops a path at the tile before the first one it may not enter', () => {
    // given
    const map = emptyMap();
    addRoad(map, {
      kind: 'road',
      width: 1,
      origin: { x: 10.5, y: 30.5 },
      angle: Math.PI / 2,
      directions: [-1, 1],
    });
    const stopAt = (x: number) => x >= 34;

    // when
    buildClearingPaths(map, [{ ...PATH, to: { x: 40, y: 20 }, stopAt }]);

    // then
    const path = map.roads[1];
    expect(path?.points[path.points.length - 1]).toEqual({ x: 33, y: 20 });
  });

  it('lays a path to the center when it is never stopped', () => {
    // given
    const map = emptyMap();
    addRoad(map, {
      kind: 'road',
      width: 1,
      origin: { x: 10.5, y: 30.5 },
      angle: Math.PI / 2,
      directions: [-1, 1],
    });

    // when
    buildClearingPaths(map, [
      { ...PATH, to: { x: 40, y: 20 }, stopAt: () => false },
    ]);

    // then
    const path = map.roads[1];
    expect(path?.points[path.points.length - 1]).toEqual({ x: 40, y: 20 });
  });

  it('makes the path a branch of the width that was asked for', () => {
    // given
    const map = emptyMap();
    addRoad(map, {
      kind: 'road',
      width: 1,
      origin: { x: 10.5, y: 30.5 },
      angle: Math.PI / 2,
      directions: [-1, 1],
    });

    // when
    buildClearingPaths(map, [
      { to: { x: 40, y: 20 }, width: 2, windiness: 0, clearing: 0 },
    ]);

    // then
    expect(map.roads[1]).toMatchObject({ kind: 'branch', width: 2 });
  });

  it('starts a path at the nearest border when there are no roads', () => {
    // given
    const map = emptyMap();

    // when
    buildClearingPaths(map, [{ ...PATH, to: { x: 50, y: 30 } }]);

    // then
    const path = map.roads[0];
    expect(path?.points[0]).toEqual({ x: 60, y: 30 });
    expect(path?.points[path.points.length - 1]).toEqual({ x: 50, y: 30 });
  });

  it('lays a path to every clearing', () => {
    // given
    const map = emptyMap();

    // when
    buildClearingPaths(map, [
      { ...PATH, to: { x: 50, y: 30 } },
      { ...PATH, to: { x: 30, y: 8 } },
    ]);

    // then
    expect(map.roads).toHaveLength(2);
  });

  it('lets a later path start at an earlier one', () => {
    // given
    const map = emptyMap();

    // when
    buildClearingPaths(map, [
      { ...PATH, to: { x: 30, y: 30 } },
      { ...PATH, to: { x: 30, y: 36 } },
    ]);

    // then
    expect(map.roads[1]?.points[0]).toEqual({ x: 30, y: 36 - 6 });
  });

  it('lays no path to a clearing with a road through its center', () => {
    // given
    const map = emptyMap();
    addRoad(map, {
      kind: 'road',
      width: 1,
      origin: { x: 10.5, y: 30.5 },
      angle: Math.PI / 2,
      directions: [-1, 1],
    });

    // when
    buildClearingPaths(map, [{ ...PATH, to: { x: 10, y: 30 } }]);

    // then
    expect(map.roads).toHaveLength(1);
  });
});
