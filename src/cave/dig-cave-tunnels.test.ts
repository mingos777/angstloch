import { describe, expect, it } from 'vitest';
import type { Grid } from '../core/grid';
import { Tile } from '../core/tile';
import { emptyMap } from '../pipeline/empty-map';
import { pipeline } from '../pipeline/pipeline';
import { Reserve } from '../pipeline/reserve';
import { step } from '../pipeline/step';
import { countAsymmetry } from '../test-helpers/count-asymmetry';
import { mulberry32 } from '../test-helpers/mulberry32';
import { digCaveTunnels } from './dig-cave-tunnels';
import type { DigCaveTunnelsOptions } from './dig-cave-tunnels-options';
import { findCaveRegions } from './find-cave-regions';
import { growCave } from './grow-cave';
import type { GrowCaveOptions } from './grow-cave-options';

const base = emptyMap({ width: 60, height: 40, tile: Tile.Wall });
const SEEDS = [1, 2, 3, 4, 5, 6, 7, 8];

function cave(
  tunnels: DigCaveTunnelsOptions | undefined,
  seed: number,
  grow: GrowCaveOptions = {},
) {
  const steps = tunnels
    ? [growCave({ fillChance: 0.5, ...grow }), digCaveTunnels(tunnels)]
    : [growCave({ fillChance: 0.5, ...grow })];
  return pipeline(base, steps, { random: mulberry32(seed) });
}

function floorCount(grid: Grid) {
  return grid.toString().split('.').length - 1;
}

/** A step that turns the tiles of a box into floor, and reserves them with `kind` unless it is `None`. */
function box(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  kind: Reserve = Reserve.None,
  tile: Tile = Tile.Floor,
) {
  return step('box', {}, ({ grid, reserved }) => {
    for (let y = y0; y <= y1; ++y) {
      for (let x = x0; x <= x1; ++x) {
        grid.set(x, y, tile);
        reserved[y * grid.width + x] = kind;
      }
    }
    return {};
  });
}

describe('digCaveTunnels', () => {
  it.each(SEEDS)('joins all caverns into one (seed %i)', (seed) => {
    // given
    const separate = cave(undefined, seed);

    // when
    const { grid } = cave({}, seed);

    // then
    expect(findCaveRegions(separate.grid).length).toBeGreaterThan(1);
    expect(findCaveRegions(grid)).toHaveLength(1);
  });

  it.each(['winding', 'direct'] as const)(
    'joins all caverns with %s tunnels',
    (style) => {
      // given
      const options = { style };

      // when
      const { grid } = cave(options, 7);

      // then
      expect(findCaveRegions(grid)).toHaveLength(1);
    },
  );

  it('keeps every floor tile that was there before', () => {
    // given
    const separate = cave(undefined, 3);

    // when
    const { grid } = cave({}, 3);

    // then
    expect(floorCount(grid)).toBeGreaterThan(floorCount(separate.grid));
    for (let y = 0; y < grid.height; ++y) {
      for (let x = 0; x < grid.width; ++x) {
        if (separate.grid.get(x, y) === Tile.Floor) {
          expect(grid.get(x, y)).toBe(Tile.Floor);
        }
      }
    }
  });

  it('keeps the border solid', () => {
    // given
    const options = { width: 3, windiness: 1, loops: 1 };

    // when
    const { grid } = cave(options, 4);

    // then
    const rows = grid.toString().split('\n');
    expect(rows[0]).toBe('#'.repeat(60));
    expect(rows[39]).toBe('#'.repeat(60));
    expect(rows.every((row) => row.startsWith('#') && row.endsWith('#'))).toBe(
      true,
    );
  });

  it('can tunnel along the border without borderWalls', () => {
    // given
    // two caverns that only the border ring joins, round a reserved wall
    const steps = [
      box(1, 1, 58, 38, Reserve.Solid, Tile.Wall),
      box(1, 1, 3, 3),
      box(56, 1, 58, 3),
    ] as const;
    const join = (borderWalls: boolean) =>
      pipeline(base, [...steps, digCaveTunnels({ borderWalls })], {
        random: mulberry32(1),
      }).grid;

    // when
    const open = join(false);

    // then
    expect(findCaveRegions(join(true))).toHaveLength(2);
    expect(findCaveRegions(open)).toHaveLength(1);
  });

  it('digs wider tunnels with width', () => {
    // given
    const options = { style: 'direct' } as const;

    // when
    const narrow = cave({ ...options, width: 1 }, 3);
    const wide = cave({ ...options, width: 3 }, 3);

    // then
    expect(floorCount(wide.grid)).toBeGreaterThan(floorCount(narrow.grid));
  });

  it('digs longer tunnels as the windiness grows', () => {
    // given
    const total = (windiness: number) =>
      SEEDS.reduce(
        (sum, seed) => sum + floorCount(cave({ windiness }, seed).grid),
        0,
      );

    // when
    const wandering = total(1);

    // then
    expect(wandering).toBeGreaterThan(total(0));
  });

  it('digs the same tunnels for the same seed', () => {
    // given
    const options = { windiness: 0.8, loops: 0.5 };

    // when
    const a = cave(options, 9);
    const b = cave(options, 9);

    // then
    expect(a.grid.toString()).toBe(b.grid.toString());
  });

  it('digs more tunnels than a tree needs with loops', () => {
    // given
    const total = (loops: number) =>
      SEEDS.reduce(
        (sum, seed) => sum + floorCount(cave({ loops }, seed).grid),
        0,
      );

    // when
    const looped = total(1);

    // then
    expect(looped).toBeGreaterThan(total(0));
  });

  it('keeps the caverns joined into one with loops', () => {
    // given
    const options = { loops: 1 };

    // when
    const grids = SEEDS.map((seed) => cave(options, seed).grid);

    // then
    for (const grid of grids) {
      expect(findCaveRegions(grid)).toHaveLength(1);
    }
  });

  it.each(['horizontal', 'vertical', 'both', 'rotational'] as const)(
    'digs perfectly %s tunnels at chance 1',
    (symmetry) => {
      // given
      const grow = { symmetry };

      // when
      const grids = [1, 2, 3].map(
        (seed) => cave({ symmetry, loops: 0.5, width: 2 }, seed, grow).grid,
      );

      // then
      for (const grid of grids) {
        expect(countAsymmetry(grid, symmetry)).toBe(0);
      }
    },
  );

  it('keeps wide direct tunnels symmetric', () => {
    // given
    const grow = { symmetry: 'both' } as const;

    // when
    const { grid } = cave(
      { symmetry: 'both', style: 'direct', width: 3 },
      2,
      grow,
    );

    // then
    expect(countAsymmetry(grid, 'both')).toBe(0);
  });

  it('digs tunnels without twins at chance 0', () => {
    // given
    const grow = { symmetry: 'both' } as const;

    // when
    const { grid } = cave({ symmetry: 'both', symmetryChance: 0 }, 1, grow);

    // then
    expect(countAsymmetry(grid, 'both')).toBeGreaterThan(0);
  });

  it('has nothing to join on a map without floor', () => {
    // given
    const steps = [digCaveTunnels()];

    // when
    const { grid } = pipeline(base, steps, { random: mulberry32(1) });

    // then
    expect(floorCount(grid)).toBe(0);
  });

  it('digs round a reserved tile', () => {
    // given
    // a reserved wall between two caverns, with a gap at the bottom
    const steps = [
      box(5, 5, 10, 10),
      box(45, 5, 50, 10),
      box(28, 1, 30, 33, Reserve.Solid, Tile.Wall),
      digCaveTunnels({ style: 'direct', width: 2 }),
    ] as const;

    // when
    const { grid } = pipeline(base, steps, { random: mulberry32(2) });

    // then
    expect(findCaveRegions(grid)).toHaveLength(1);
    for (let y = 1; y <= 33; ++y) {
      for (let x = 28; x <= 30; ++x) {
        expect(grid.get(x, y)).toBe(Tile.Wall);
      }
    }
  });

  it('leaves out a piece that only a reserved tile could reach, and joins the rest', () => {
    // given
    // a cavern shut in a reserved ring, and three caverns outside it
    const steps = [
      box(5, 5, 9, 9, Reserve.Solid, Tile.Wall),
      box(6, 6, 8, 8, Reserve.None),
      box(20, 5, 24, 9),
      box(40, 5, 44, 9),
      box(30, 30, 34, 34),
      digCaveTunnels(),
    ] as const;

    // when
    const { grid } = pipeline(base, steps, { random: mulberry32(3) });

    // then
    const sizes = findCaveRegions(grid).map((tiles) => tiles.length);
    expect(sizes).toHaveLength(2);
    expect(sizes[1]).toBe(9);
  });

  it('does not join the floor of a room', () => {
    // given
    const steps = [
      box(5, 5, 9, 9),
      box(40, 20, 45, 25, Reserve.Solid),
      box(50, 5, 54, 9),
      digCaveTunnels(),
    ] as const;

    // when
    const { grid } = pipeline(base, steps, { random: mulberry32(4) });

    // then
    const regions = findCaveRegions(grid);
    expect(regions).toHaveLength(2);
    expect(regions.map((tiles) => tiles.length)).toContain(36);
  });

  it('digs no floor over a tile that is neither rock nor floor', () => {
    // given
    // a column of doors between two caverns, open at the bottom
    const steps = [
      box(5, 5, 10, 10),
      box(45, 5, 50, 10),
      box(29, 1, 29, 33, Reserve.None, Tile.Door),
      digCaveTunnels({ style: 'direct' }),
    ] as const;

    // when
    const { grid } = pipeline(base, steps, { random: mulberry32(5) });

    // then
    for (let y = 1; y <= 33; ++y) {
      expect(grid.get(29, y)).toBe(Tile.Door);
    }
    expect(findCaveRegions(grid)).toHaveLength(1);
  });

  it('needs a map that starts as wall', () => {
    // given
    const grass = emptyMap({ width: 40, height: 30, tile: Tile.Grass });

    // when
    const run = () => pipeline(grass, [digCaveTunnels()]);

    // then
    expect(run).toThrow(/digCaveTunnels digs its floor out of rock/);
  });

  it.each([
    { style: 'straight' as 'direct' },
    { width: 0 },
    { width: 1.5 },
    { windiness: 1.5 },
    { loops: -0.1 },
    { symmetry: 'diagonal' as 'both' },
    { symmetryChance: 2 },
  ])('throws a RangeError at once for %o', (options) => {
    // given
    const bad: DigCaveTunnelsOptions = options;

    // when
    const make = () => digCaveTunnels(bad);

    // then
    expect(make).toThrow(RangeError);
  });
});
