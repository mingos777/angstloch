import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../test-helpers/mulberry32';
import { buildRoads } from './build-roads';
import type { RoadOptions } from './road-options';

function lay(options: RoadOptions, seed = 1, width = 100, height = 70) {
  return buildRoads(width, height, mulberry32(seed), options);
}

const STRAIGHT = { angle: 0, windiness: 0 };
const ONE = { min: 1, max: 1 };
const THREE = { min: 3, max: 3 };

/** The number of groups of road tiles that touch along an edge. */
function groups(covered: Uint8Array, width: number, height: number) {
  const seen = new Uint8Array(covered.length);
  let count = 0;
  for (let start = 0; start < covered.length; ++start) {
    if (!covered[start] || seen[start]) {
      continue;
    }
    ++count;
    const stack = [start];
    seen[start] = 1;
    for (let at = stack.pop(); at !== undefined; at = stack.pop()) {
      const x = at % width;
      const y = Math.floor(at / width);
      for (const [nx, ny] of [
        [x + 1, y],
        [x - 1, y],
        [x, y + 1],
        [x, y - 1],
      ] as const) {
        const next = ny * width + nx;
        if (
          nx >= 0 &&
          ny >= 0 &&
          nx < width &&
          ny < height &&
          covered[next] &&
          !seen[next]
        ) {
          seen[next] = 1;
          stack.push(next);
        }
      }
    }
  }
  return count;
}

describe('buildRoads crossings', () => {
  it('adds a road that crosses the main road', () => {
    // given
    const options = { ...STRAIGHT, crossings: ONE };

    // when
    const { roads } = lay(options);

    // then
    expect(roads.map((road) => road.kind)).toEqual(['road', 'road']);
  });

  it('crosses at the angle asked for', () => {
    // given
    const options = {
      ...STRAIGHT,
      crossings: ONE,
      crossingAngle: { min: 90, max: 90 },
    };

    // when
    const { roads } = lay(options);

    // then
    const crossing = roads[1]?.points ?? [];
    expect(new Set(crossing.map((p) => p.x)).size).toBe(1);
    const ends = [crossing[0]?.y, crossing[crossing.length - 1]?.y];
    expect(ends.sort((a, b) => (a ?? 0) - (b ?? 0))).toEqual([0, 69]);
  });

  it('makes a junction on both roads where they cross', () => {
    // given
    const options = {
      ...STRAIGHT,
      crossings: ONE,
      crossingAngle: { min: 90, max: 90 },
    };

    // when
    const { roads, junctions } = lay(options);

    // then
    expect(junctions).toHaveLength(1);
    const [junction] = junctions;
    for (const road of roads) {
      expect(road.points).toContainEqual(junction);
    }
  });

  it('leaves the map at both ends of a crossing road', () => {
    // given
    const options = {
      ...STRAIGHT,
      crossings: ONE,
      crossingAngle: { min: 90, max: 90 },
    };

    // when
    const { exits } = lay(options);

    // then
    expect(exits).toHaveLength(4);
  });

  it('gives a crossing road a width from the width range', () => {
    // given
    const options = { ...STRAIGHT, crossings: ONE, width: { min: 5, max: 5 } };

    // when
    const { roads } = lay(options);

    // then
    expect(roads[1]?.width).toBe(5);
  });

  it('adds as many crossings as asked for', () => {
    // given
    const options = { crossings: { min: 3, max: 3 }, windiness: 0.2 };

    // when
    const { roads } = lay(options, 2, 200, 140);

    // then
    expect(roads).toHaveLength(4);
  });
});

describe('buildRoads branches', () => {
  it('adds branches that are branches', () => {
    // given
    const options = { ...STRAIGHT, branches: THREE };

    // when
    const { roads } = lay(options);

    // then
    expect(roads.map((road) => road.kind)).toEqual([
      'road',
      'branch',
      'branch',
      'branch',
    ]);
  });

  it('starts every branch on another road', () => {
    // given
    const options = { branches: { min: 4, max: 4 }, crossings: ONE };

    // when
    const { roads } = lay(options, 3, 160, 110);

    // then
    roads.forEach((road, index) => {
      if (road.kind !== 'branch') {
        return;
      }
      const start = road.points[0];
      const touches = roads.some(
        (other, i) =>
          i !== index &&
          other.points.some((p) => p.x === start?.x && p.y === start.y),
      );
      expect(touches).toBe(true);
    });
  });

  it('leaves a branch at the angle asked for', () => {
    // given
    const options = {
      ...STRAIGHT,
      branches: ONE,
      branchAngle: { min: 45, max: 45 },
    };

    // when
    const { roads } = lay(options);

    // then
    const branch = roads[1]?.points ?? [];
    const first = branch[0];
    const last = branch[branch.length - 1];
    const dx = Math.abs((last?.x ?? 0) - (first?.x ?? 0));
    const dy = Math.abs((last?.y ?? 0) - (first?.y ?? 0));
    expect(dy).toBeGreaterThan(5);
    expect(Math.abs(dx - dy)).toBeLessThanOrEqual(2);
  });

  it('runs a branch to the edge of the map without a length', () => {
    // given
    const options = { ...STRAIGHT, branches: ONE };

    // when
    const { roads, exits } = lay(options);

    // then
    expect(exits).toHaveLength(3);
    const branch = roads[1]?.points ?? [];
    const last = branch[branch.length - 1];
    expect(
      last?.x === 0 || last?.y === 0 || last?.x === 99 || last?.y === 69,
    ).toBe(true);
  });

  it('ends a branch in the forest when it is not long enough to reach the edge', () => {
    // given
    const options = {
      ...STRAIGHT,
      branches: ONE,
      branchLength: { min: 10, max: 10 },
    };

    // when
    const { roads, exits } = lay(options);

    // then
    expect(exits).toHaveLength(2);
    const branch = roads[1]?.points ?? [];
    expect(branch.length).toBeGreaterThanOrEqual(11);
    expect(branch.length).toBeLessThanOrEqual(25);
  });

  it('picks the length of a branch from the range', () => {
    // given
    const lengths = new Set<number>();

    // when
    for (let seed = 1; seed <= 12; ++seed) {
      const { roads } = lay(
        { ...STRAIGHT, branches: ONE, branchLength: { min: 6, max: 30 } },
        seed,
      );
      lengths.add(roads[1]?.points.length ?? 0);
    }

    // then
    expect(lengths.size).toBeGreaterThan(4);
  });

  it('gives a branch a width of 1 by default and from branchWidth when set', () => {
    // given
    const plain = lay({ branches: ONE });
    const wide = lay({ branches: ONE, branchWidth: { min: 2, max: 2 } });

    // when
    const widths = [plain.roads[1]?.width, wide.roads[1]?.width];

    // then
    expect(widths).toEqual([1, 2]);
  });

  it('makes a junction where a branch leaves a road', () => {
    // given
    const options = { ...STRAIGHT, branches: ONE };

    // when
    const { roads, junctions } = lay(options);

    // then
    expect(junctions).toHaveLength(1);
    expect(roads[1]?.points[0]).toEqual(junctions[0]);
  });

  it('may leave a branch off a crossing', () => {
    // given
    const options = {
      crossings: ONE,
      branches: { min: 6, max: 6 },
      windiness: 0.1,
    };
    const onCrossing = (seed: number) => {
      const { roads } = lay(options, seed, 160, 110);
      const crossing = roads[1]?.points ?? [];
      return roads
        .filter((road) => road.kind === 'branch')
        .some((branch) => {
          const start = branch.points[0];
          return crossing.some((p) => p.x === start?.x && p.y === start.y);
        });
    };

    // when
    const found = [1, 2, 3, 4, 5, 6, 7, 8].some(onCrossing);

    // then
    expect(found).toBe(true);
  });
});

describe('buildRoads network', () => {
  it.each([1, 2, 3, 4, 5, 6])(
    'joins every road into one network (seed %i)',
    (seed) => {
      // given
      const options = {
        crossings: { min: 2, max: 2 },
        branches: { min: 4, max: 4 },
        windiness: 0.6,
      };

      // when
      const { covered } = lay(options, seed, 160, 110);

      // then
      expect(groups(covered, 160, 110)).toBe(1);
    },
  );

  it('puts every junction on the centerlines of at least two roads', () => {
    // given
    const options = {
      crossings: { min: 2, max: 2 },
      branches: { min: 4, max: 4 },
    };

    // when
    const { roads, junctions } = lay(options, 4, 160, 110);

    // then
    expect(junctions.length).toBeGreaterThanOrEqual(6);
    for (const junction of junctions) {
      const through = roads.filter((road) =>
        road.points.some((p) => p.x === junction.x && p.y === junction.y),
      );
      expect(through.length).toBeGreaterThanOrEqual(2);
    }
  });

  it('keeps every exit on the border', () => {
    // given
    const options = { crossings: ONE, branches: THREE };

    // when
    const { exits } = lay(options, 5);

    // then
    for (const { x, y } of exits) {
      expect(x === 0 || y === 0 || x === 99 || y === 69).toBe(true);
    }
  });

  it('lists no exit twice', () => {
    // given
    const options = { crossings: ONE, branches: THREE };

    // when
    const { exits } = lay(options, 5);

    // then
    expect(
      new Set(exits.map((e) => `${String(e.x)},${String(e.y)}`)).size,
    ).toBe(exits.length);
  });

  it('covers every tile of every centerline', () => {
    // given
    const options = { crossings: ONE, branches: THREE };

    // when
    const { roads, covered } = lay(options, 6);

    // then
    for (const road of roads) {
      expect(road.points.every((p) => covered[p.y * 100 + p.x] === 1)).toBe(
        true,
      );
    }
  });

  it('is deterministic', () => {
    // given
    const options = {
      crossings: ONE,
      branches: THREE,
      branchLength: { min: 5, max: 20 },
    };

    // when
    const a = lay(options, 7);
    const b = lay(options, 7);

    // then
    expect(a.roads).toEqual(b.roads);
    expect(a.junctions).toEqual(b.junctions);
  });

  it('makes fewer roads than asked for when the map has no room', () => {
    // given
    const options = { crossings: THREE, branches: THREE };

    // when
    const { roads } = buildRoads(10, 10, mulberry32(1), options);

    // then
    expect(roads).toHaveLength(1);
  });

  it('leaves the main road alone when no crossings or branches are asked for', () => {
    // given
    const plain = lay({}, 3);

    // when
    const none = lay(
      { crossings: { min: 0, max: 0 }, branches: { min: 0, max: 0 } },
      3,
    );

    // then
    expect(none.roads).toEqual(plain.roads);
    expect(none.junctions).toEqual([]);
  });

  it.each([
    ['roads.crossings', { crossings: { min: -1, max: 1 } }],
    ['roads.branches', { branches: { min: 3, max: 1 } }],
    ['roads.branchWidth', { branchWidth: { min: 0, max: 1 } }],
    ['roads.branchLength', { branchLength: { min: 0, max: 5 } }],
    ['roads.crossingAngle', { crossingAngle: { min: 0, max: 90 } }],
    ['roads.crossingAngle', { crossingAngle: { min: 45, max: 180 } }],
    ['roads.branchAngle', { branchAngle: { min: 20.5, max: 70 } }],
    ['roads.branchAngle', { branchAngle: { min: 20, max: 200 } }],
  ])('throws a RangeError for an invalid %s', (name, options) => {
    // given
    const generate = () => lay(options);

    // when / then
    expect(generate).toThrow(RangeError);
    expect(generate).toThrow(name);
  });
});
