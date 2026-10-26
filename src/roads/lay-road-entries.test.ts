import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../test-helpers/mulberry32';
import { assertRoadOptions } from './assert-road-options';
import { layRoads } from './lay-roads';
import type { RoadEntry } from './road-entry';
import type { RoadOptions } from './road-options';

function lay(specs: RoadEntry[], options: RoadOptions = {}) {
  return layRoads(100, 70, mulberry32(1), {
    windiness: 0,
    ...options,
    specs,
  });
}

describe('layRoads specs', () => {
  it('lays only the given roads and ignores the general settings', () => {
    // given
    const specs: RoadEntry[] = [{ origin: { x: 50, y: 35 }, angle: 0 }];

    // when
    const { roads } = lay(specs, { crossings: { min: 2, max: 2 } });

    // then
    expect(roads).toHaveLength(1);
  });

  it('lays no roads from an empty list', () => {
    // given / when
    const { roads, covered } = lay([]);

    // then
    expect(roads).toHaveLength(0);
    expect(covered.every((tile) => tile === 0)).toBe(true);
  });

  it('runs a road through its origin at the given angle', () => {
    // given
    const specs: RoadEntry[] = [
      { origin: { x: 50, y: 35 }, angle: 0, width: 1 },
    ];

    // when
    const { roads, exits } = lay(specs);

    // then
    const [road] = roads;
    expect(road?.points.every(({ y }) => y === 35)).toBe(true);
    expect(road?.points.some(({ x }) => x === 50)).toBe(true);
    expect(exits).toHaveLength(2);
  });

  it('uses the width of the entry', () => {
    // given
    const specs: RoadEntry[] = [{ origin: { x: 50, y: 35 }, width: 5 }];

    // when
    const { roads } = lay(specs);

    // then
    expect(roads[0]?.width).toBe(5);
  });

  it('defaults a branch to width 1', () => {
    // given
    const specs: RoadEntry[] = [
      { origin: { x: 50, y: 35 }, angle: 0 },
      { kind: 'branch', parent: 0 },
    ];

    // when
    const { roads } = lay(specs);

    // then
    expect(roads[1]).toMatchObject({ kind: 'branch', width: 1 });
  });

  it('attaches a road to its parent and makes a junction', () => {
    // given
    const specs: RoadEntry[] = [
      { origin: { x: 50, y: 35 }, angle: 0 },
      { parent: 0, at: 0.5, angle: 90 },
    ];

    // when
    const { roads, junctions } = lay(specs);

    // then
    expect(roads).toHaveLength(2);
    expect(junctions.length).toBeGreaterThan(0);
  });

  it('stops a branch at its length', () => {
    // given
    const specs: RoadEntry[] = [
      { origin: { x: 50, y: 35 }, angle: 0 },
      { kind: 'branch', parent: 0, angle: 90, length: 10 },
    ];

    // when
    const { roads } = lay(specs);

    // then
    expect(roads[1]?.points.length).toBeLessThanOrEqual(12);
  });

  it('runs a road to its end point', () => {
    // given
    const specs: RoadEntry[] = [
      { kind: 'branch', origin: { x: 10, y: 10 }, to: { x: 60, y: 50 } },
    ];

    // when
    const { roads } = lay(specs);

    // then
    const points = roads[0]?.points ?? [];
    expect(points[0]).toEqual({ x: 10, y: 10 });
    expect(points[points.length - 1]).toEqual({ x: 60, y: 50 });
  });

  it('moves an origin that is off the map onto it', () => {
    // given
    const specs: RoadEntry[] = [{ origin: { x: 500, y: -20 }, angle: 90 }];

    // when
    const { roads } = lay(specs);

    // then
    expect(roads).toHaveLength(1);
  });

  it('is deterministic', () => {
    // given
    const specs: RoadEntry[] = [{}, { parent: 0 }];

    // when
    const a = lay(specs);
    const b = lay(specs);

    // then
    expect(a.covered).toEqual(b.covered);
  });
});

describe('assertRoadOptions specs', () => {
  it.each<[string, RoadEntry[]]>([
    ['a parent that is not earlier', [{ parent: 0 }]],
    ['a fractional width', [{ width: 1.5 }]],
    ['an `at` above 1', [{}, { parent: 0, at: 2 }]],
    ['an end point without a start', [{ to: { x: 1, y: 1 } }]],
    ['an infinite angle', [{ angle: Infinity }]],
    ['a zero length', [{ length: 0 }]],
    ['a windiness above 1', [{ windiness: 2 }]],
    ['an unknown kind', [{ kind: 'river' as 'road' }]],
    ['a non-finite origin', [{ origin: { x: NaN, y: 0 } }]],
  ])('throws on %s', (_name, specs) => {
    // given
    const options = { specs };

    // when
    const act = () => {
      assertRoadOptions(options);
    };

    // then
    expect(act).toThrow(RangeError);
  });
});
