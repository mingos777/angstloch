import { describe, expect, it } from 'vitest';
import { Grid } from '../core/grid';
import { Tile } from '../core/tile';
import { emptyMap } from '../pipeline/empty-map';
import { pipeline } from '../pipeline/pipeline';
import { Reserve } from '../pipeline/reserve';
import { step } from '../pipeline/step';
import { countAsymmetry } from '../test-helpers/count-asymmetry';
import { mulberry32 } from '../test-helpers/mulberry32';
import { withCaves } from '../test-helpers/with-caves';
import type { RoomShape } from '../rooms/room-shape';
import { TemplateCell } from '../rooms/templates/template-cell';
import { findCaveRegions } from './find-cave-regions';
import { digCellularCave } from './dig-cellular-cave';
import type { DigCellularCaveOptions } from './dig-cellular-cave-options';

const base = emptyMap({ width: 60, height: 40, tile: Tile.Wall });

function cave(options: DigCellularCaveOptions = {}, seed = 1) {
  return withCaves(
    pipeline(base, [digCellularCave(options)], {
      random: mulberry32(seed),
    }),
  );
}

/** A step that reserves every tile of the map. */
const reserveAll = step('reserveAll', {}, ({ reserved }) => {
  reserved.fill(Reserve.Solid);
  return {};
});

/** The tiles of a box of the grid, as a grid of their own. */
function cut(
  grid: Grid,
  box: { x: number; y: number; width: number; height: number },
): Grid {
  const part = new Grid(box.width, box.height);
  for (let y = 0; y < box.height; ++y) {
    for (let x = 0; x < box.width; ++x) {
      part.set(x, y, grid.get(box.x + x, box.y + y));
    }
  }
  return part;
}

/** How many times a row changes between wall and floor, summed over the rows. */
function transitions(grid: Grid): number {
  let count = 0;
  for (let y = 0; y < grid.height; ++y) {
    for (let x = 1; x < grid.width; ++x) {
      count += grid.get(x, y) === grid.get(x - 1, y) ? 0 : 1;
    }
  }
  return count;
}

describe('digCellularCave', () => {
  it('grows the same cave from the same seed', () => {
    // given
    const seed = 3;

    // when
    const first = cave({}, seed);
    const second = cave({}, seed);

    // then
    expect(first.grid.toString()).toBe(second.grid.toString());
    expect(first.caverns).toEqual([{ x: 0, y: 0, width: 60, height: 40 }]);
  });

  it('keeps the border of its area solid by default', () => {
    // given
    const options = { fillChance: 0, iterations: 0 };

    // when
    const { grid } = cave(options);

    // then
    const rows = grid.toString().split('\n');
    expect(rows[0]).toBe('#'.repeat(60));
    expect(rows[20]).toBe(`#${'.'.repeat(58)}#`);
  });

  it('lets floor reach the border without borderWalls', () => {
    // given
    const options = { fillChance: 0, iterations: 0, borderWalls: false };

    // when
    const { grid } = cave(options);

    // then
    expect(grid.toString()).not.toContain('#');
  });

  it('makes a map of all walls with a fill chance of 1', () => {
    // given
    const options = { fillChance: 1, iterations: 0 };

    // when
    const { grid } = cave(options);

    // then
    expect(grid.toString()).not.toContain('.');
  });

  it('turns everything into floor when the limits can never be reached', () => {
    // given
    const options = { birthLimit: 9, survivalLimit: 9, borderWalls: false };

    // when
    const { grid } = cave(options);

    // then
    expect(grid.toString()).not.toContain('#');
  });

  it('uses lower default limits for the von Neumann neighborhood', () => {
    // given
    const neighborhood = 'von-neumann';

    // when
    const byDefault = cave({ neighborhood });
    const explicit = cave({ neighborhood, birthLimit: 3, survivalLimit: 2 });

    // then
    expect(byDefault.grid.toString()).toBe(explicit.grid.toString());
  });

  it('smooths the noise into larger clumps', () => {
    // given
    const raw = cave({ iterations: 0 }, 9);

    // when
    const smooth = cave({ iterations: 4 }, 9);

    // then
    expect(transitions(smooth.grid)).toBeLessThan(transitions(raw.grid) / 2);
  });

  it('honors the neighborhood', () => {
    // given
    const moore = cave({}, 4);

    // when
    const neumann = cave({ neighborhood: 'von-neumann' }, 4);

    // then
    expect(moore.grid.toString()).not.toBe(neumann.grid.toString());
  });

  it.each(['horizontal', 'vertical', 'both', 'rotational'] as const)(
    'grows a perfectly %s cave at chance 1',
    (symmetry) => {
      // given
      const seeds = [1, 2, 3];

      // when
      const caves = seeds.map((seed) => cave({ symmetry }, seed));

      // then
      for (const { grid } of caves) {
        expect(countAsymmetry(grid, symmetry)).toBe(0);
      }
    },
  );

  it('is less symmetric at a chance below 1', () => {
    // given
    const asymmetryAt = (symmetryChance: number) =>
      countAsymmetry(cave({ symmetry: 'both', symmetryChance }).grid, 'both');

    // when
    const loose = asymmetryAt(0.5);

    // then
    expect(loose).toBeGreaterThan(asymmetryAt(1));
  });

  it('mirrors about the center of its area', () => {
    // given
    const options = {
      symmetry: 'both',
      area: { width: { min: 21, max: 21 }, height: { min: 15, max: 15 } },
    } as const;

    // when
    const { grid, caverns } = cave(options, 2);

    // then
    const [box] = caverns;
    expect(box).toBeDefined();
    if (box) {
      expect(countAsymmetry(cut(grid, box), 'both')).toBe(0);
    }
  });

  it('leaves out the caverns below minRegionSize', () => {
    // given
    const loose = cave({}, 5);

    // when
    const { grid } = cave({ minRegionSize: 30 }, 5);

    // then
    expect(findCaveRegions(loose.grid).some((r) => r.length < 30)).toBe(true);
    expect(findCaveRegions(grid).every((r) => r.length >= 30)).toBe(true);
  });

  it('keeps only the largest cavern with largestOnly', () => {
    // given
    const loose = cave({}, 5);

    // when
    const { grid } = cave({ largestOnly: true }, 5);

    // then
    expect(findCaveRegions(loose.grid).length).toBeGreaterThan(1);
    expect(findCaveRegions(grid)).toHaveLength(1);
  });

  it('keeps the largest piece of a cave in an area and leaves the rest of the map alone', () => {
    // given
    const options = {
      largestOnly: true,
      area: { width: { min: 20, max: 20 }, height: { min: 16, max: 16 } },
    };

    // when
    const { grid, caverns } = cave(options, 6);

    // then
    const [box] = caverns;
    expect(caverns).toHaveLength(1);
    expect(box).toMatchObject({ width: 20, height: 16 });
    const regions = findCaveRegions(grid);
    expect(regions).toHaveLength(1);
    for (const { x, y } of regions[0] ?? []) {
      expect(x > (box?.x ?? 0) && x < (box?.x ?? 0) + 19).toBe(true);
      expect(y > (box?.y ?? 0) && y < (box?.y ?? 0) + 15).toBe(true);
    }
  });

  it('grows a cave in each of two areas, appended to the caverns before', () => {
    // given
    const area = { width: { min: 15, max: 15 }, height: { min: 15, max: 15 } };
    const steps = [
      digCellularCave({ area }),
      digCellularCave({ area, count: { min: 2, max: 2 } }),
    ] as const;

    // when
    const { caverns } = withCaves(
      pipeline(base, steps, { random: mulberry32(1) }),
    );

    // then
    expect(caverns).toHaveLength(3);
  });

  it('carves no floor on a reserved tile', () => {
    // given
    const block = step('block', {}, ({ grid, reserved }) => {
      for (let y = 10; y < 30; ++y) {
        for (let x = 20; x < 40; ++x) {
          reserved[y * grid.width + x] = Reserve.Solid;
        }
      }
      return {};
    });

    // when
    const { grid } = pipeline(base, [block, digCellularCave()], {
      random: mulberry32(1),
    });

    // then
    for (let y = 10; y < 30; ++y) {
      for (let x = 20; x < 40; ++x) {
        expect(grid.get(x, y)).toBe(Tile.Wall);
      }
    }
  });

  it('keeps the floor that was there, and counts it as part of its caverns', () => {
    // given
    // a corridor along row 20 joins every cavern it crosses into one
    const corridor = step('corridor', {}, ({ grid }) => {
      for (let x = 1; x < 59; ++x) {
        grid.set(x, 20, Tile.Floor);
      }
      return {};
    });
    const steps = [corridor, digCellularCave({ largestOnly: true })] as const;

    // when
    const { grid } = pipeline(base, steps, { random: mulberry32(5) });

    // then
    expect(grid.toString().split('\n')[20]).toBe(`#${'.'.repeat(58)}#`);
    expect(findCaveRegions(grid)).toHaveLength(1);
  });

  describe('caverns as rooms', () => {
    /** The floor tiles of a shape, in the coordinates of the map. */
    const floorOf = (shape: RoomShape) =>
      shape.cells.flatMap((row, dy) =>
        row.flatMap((cell, dx) =>
          cell === TemplateCell.Floor
            ? [`${String(shape.x + dx)},${String(shape.y + dy)}`]
            : [],
        ),
      );

    it('lists one room of kind cavern for each cavern, in the group of its cave', () => {
      // given
      const options = { minRegionSize: 10 };

      // when
      const { grid, rooms, roomGroups } = cave(options, 2);

      // then
      expect(rooms).toHaveLength(findCaveRegions(grid).length);
      expect(
        rooms.every(({ kind, group }) => kind === 'cavern' && group === 0),
      ).toBe(true);
      expect(roomGroups).toEqual([
        { kind: 'cave', area: { x: 0, y: 0, width: 60, height: 40 } },
      ]);
    });

    it('gives every cavern its floor as its shape and the bounds of that floor as its box', () => {
      // given
      const options = { minRegionSize: 10 };

      // when
      const { grid, rooms, roomShapes } = cave(options, 2);

      // then
      const regions = findCaveRegions(grid).map((tiles) =>
        tiles.map(({ x, y }) => `${String(x)},${String(y)}`).sort(),
      );
      roomShapes.forEach((shape, id) => {
        const floor = floorOf(shape).sort();
        const xs = floor.map((key) => Number(key.split(',')[0]));
        const ys = floor.map((key) => Number(key.split(',')[1]));
        expect(regions).toContainEqual(floor);
        expect(rooms[id]).toMatchObject({
          x: Math.min(...xs),
          y: Math.min(...ys),
          width: Math.max(...xs) - Math.min(...xs) + 1,
          height: Math.max(...ys) - Math.min(...ys) + 1,
        });
      });
    });

    it('reserves no tile of its caverns', () => {
      // given
      const options = {};

      // when
      const { reserved } = cave(options, 2);

      // then
      expect(reserved.every((value) => value === Reserve.None)).toBe(true);
    });

    it('leaves the floor that was there out of the shapes of its caverns', () => {
      // given
      const corridor = step('corridor', {}, ({ grid }) => {
        for (let x = 1; x < 59; ++x) {
          grid.set(x, 20, Tile.Floor);
        }
        return {};
      });
      const steps = [corridor, digCellularCave({ largestOnly: true })] as const;

      // when
      const { roomShapes } = pipeline(base, steps, { random: mulberry32(5) });

      // then
      const floor = roomShapes.flatMap(floorOf);
      expect(floor.some((key) => key.endsWith(',20'))).toBe(false);
    });
  });

  describe('placement', () => {
    /** A corridor along row 20, from the left edge to the right. */
    const corridor = step('corridor', {}, ({ grid }) => {
      for (let x = 1; x < 59; ++x) {
        grid.set(x, 20, Tile.Floor);
      }
      return {};
    });
    const small = {
      area: { width: { min: 14, max: 14 }, height: { min: 14, max: 14 } },
    };

    it('keeps a wall between a cave placed beside and the floor that was there', () => {
      // given
      const steps = [
        corridor,
        digCellularCave({ ...small, placement: 'beside', largestOnly: true }),
      ] as const;

      // when
      const runs = [1, 2, 3, 4].map((seed) =>
        withCaves(pipeline(base, steps, { random: mulberry32(seed) })),
      );

      // then
      for (const { grid, caverns } of runs) {
        expect(caverns).toHaveLength(1);
        expect(findCaveRegions(grid)).toHaveLength(2);
        for (let x = 0; x < 60; ++x) {
          expect(grid.get(x, 19)).toBe(Tile.Wall);
          expect(grid.get(x, 21)).toBe(Tile.Wall);
        }
      }
    });

    it('places a cave beside as near the floor that was there as it finds', () => {
      // given
      const steps = [
        corridor,
        digCellularCave({ ...small, placement: 'beside', largestOnly: true }),
      ] as const;

      // when
      const { grid } = pipeline(base, steps, { random: mulberry32(1) });

      // then
      const rows = grid.toString().split('\n');
      const near = [16, 17, 18, 22, 23, 24].some((y) => rows[y]?.includes('.'));
      expect(near).toBe(true);
    });

    it('fails the attempt when a cave it needs finds no spot beside', () => {
      // given
      const steps = [
        reserveAll,
        digCellularCave({ ...small, placement: 'beside' }),
      ] as const;

      // when
      const run = () => pipeline(base, steps, { random: mulberry32(1) });

      // then
      expect(run).toThrow(/No spot beside the dug ground.*count\.min/);
    });

    it('leaves out a cave above count.min that finds no spot beside', () => {
      // given
      const steps = [
        reserveAll,
        digCellularCave({
          ...small,
          placement: 'beside',
          count: { min: 0, max: 2 },
        }),
      ] as const;

      // when
      const { caverns, attempts } = withCaves(
        pipeline(base, steps, {
          random: mulberry32(1),
        }),
      );

      // then
      expect(caverns).toEqual([]);
      expect(attempts).toBe(1);
    });

    it('runs a cave placed with overlap into the floor that was there', () => {
      // given
      const steps = [
        corridor,
        digCellularCave({
          area: { width: { min: 30, max: 30 }, height: { min: 30, max: 30 } },
          placement: 'overlap',
          largestOnly: true,
        }),
      ] as const;

      // when
      const { grid, caverns } = withCaves(
        pipeline(base, steps, {
          random: mulberry32(2),
        }),
      );

      // then
      expect(caverns).toHaveLength(1);
      expect(findCaveRegions(grid)).toHaveLength(1);
    });

    it('carves no floor on a reserved tile with overlap, and makes no cave', () => {
      // given
      const steps = [
        reserveAll,
        digCellularCave({ ...small, placement: 'overlap' }),
      ] as const;

      // when
      const { grid, caverns } = withCaves(
        pipeline(base, steps, {
          random: mulberry32(1),
        }),
      );

      // then
      expect(caverns).toEqual([]);
      expect(grid.toString()).not.toContain('.');
    });
  });

  it('needs a map that starts as wall', () => {
    // given
    const grass = emptyMap({ width: 40, height: 30, tile: Tile.Grass });

    // when
    const run = () => pipeline(grass, [digCellularCave()]);

    // then
    expect(run).toThrow(/digCellularCave digs its floor out of rock/);
  });

  it.each([
    { fillChance: 2 },
    { iterations: -1 },
    { birthLimit: 1.5 },
    { neighborhood: 'hex' as 'moore' },
    { symmetry: 'diagonal' as 'both' },
    { symmetryChance: -0.5 },
    { minRegionSize: -1 },
    { count: { min: 2, max: 1 } },
    { placement: 'anywhere' as 'free' },
  ])('throws a RangeError at once for %o', (options) => {
    // given
    const bad: DigCellularCaveOptions = options;

    // when
    const make = () => digCellularCave(bad);

    // then
    expect(make).toThrow(RangeError);
  });
});
