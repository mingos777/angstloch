import { describe, expect, it } from 'vitest';
import type { Area } from '../core/area';
import { Grid } from '../core/grid';
import { Tile } from '../core/tile';
import { emptyMap } from '../pipeline/empty-map';
import { pipeline } from '../pipeline/pipeline';
import { Reserve } from '../pipeline/reserve';
import { step } from '../pipeline/step';
import { countAsymmetry } from '../test-helpers/count-asymmetry';
import type { CaveGroup } from '../rooms/cave-group';
import { mulberry32 } from '../test-helpers/mulberry32';
import { withCaves } from '../test-helpers/with-caves';
import { digNoiseCave } from './dig-noise-cave';
import type { DigNoiseCaveOptions } from './dig-noise-cave-options';
import { findCaveRegions } from './find-cave-regions';

const base = emptyMap({ width: 60, height: 40, tile: Tile.Wall });

function cave(options: DigNoiseCaveOptions = {}, seed = 1) {
  return withCaves(
    pipeline(base, [digNoiseCave(options)], {
      random: mulberry32(seed),
    }),
  );
}

/** A cave on a map of its own size. */
function sized(width: number, height: number, options: DigNoiseCaveOptions) {
  return pipeline(
    emptyMap({ width, height, tile: Tile.Wall }),
    [digNoiseCave(options)],
    { random: mulberry32(1) },
  );
}

/** The share of walls among the tiles within `radius` of any corner. */
function cornerWallShare(grid: Grid, radius: number) {
  let near = 0;
  let walls = 0;
  for (let y = 0; y < grid.height; ++y) {
    for (let x = 0; x < grid.width; ++x) {
      const corner = Math.hypot(
        Math.min(x, grid.width - 1 - x),
        Math.min(y, grid.height - 1 - y),
      );
      if (corner < radius) {
        ++near;
        walls += grid.get(x, y) === Tile.Wall ? 1 : 0;
      }
    }
  }
  return walls / near;
}

/** The tiles of a box of the grid, as a grid of their own. */
function cut(grid: Grid, box: Area): Grid {
  const part = new Grid(box.width, box.height);
  for (let y = 0; y < box.height; ++y) {
    for (let x = 0; x < box.width; ++x) {
      part.set(x, y, grid.get(box.x + x, box.y + y));
    }
  }
  return part;
}

function count(grid: Grid, tile: Tile): number {
  let total = 0;
  for (let y = 0; y < grid.height; ++y) {
    for (let x = 0; x < grid.width; ++x) {
      if (grid.get(x, y) === tile) {
        ++total;
      }
    }
  }
  return total;
}

describe('digNoiseCave', () => {
  it('carves the same cave from the same seed', () => {
    // given
    const seed = 3;

    // when
    const first = cave({}, seed);
    const second = cave({}, seed);

    // then
    expect(first.grid.toString()).toBe(second.grid.toString());
    expect(first.caverns).toEqual([{ x: 0, y: 0, width: 60, height: 40 }]);
  });

  it('carves another cave from another seed', () => {
    // given
    const first = cave({}, 1);

    // when
    const second = cave({}, 2);

    // then
    expect(first.grid.toString()).not.toBe(second.grid.toString());
  });

  it('keeps the share of walls at fill', () => {
    // given
    const options = { fill: 0.4, borderWalls: false, cornerBias: 15 };

    // when
    const { grid } = cave(options);

    // then
    expect(count(grid, Tile.Wall) / (60 * 40)).toBeCloseTo(0.4, 2);
  });

  it('keeps the share of walls at fill with veins', () => {
    // given
    const options = { shape: 'veins', fill: 0.3, borderWalls: false } as const;

    // when
    const { grid } = cave(options);

    // then
    expect(count(grid, Tile.Wall) / (60 * 40)).toBeCloseTo(0.3, 2);
  });

  it('counts only the inner tiles towards fill when the border is walled', () => {
    // given
    const options = { fill: 0 };

    // when
    const { grid } = sized(20, 10, options);

    // then
    expect(count(grid, Tile.Wall)).toBe(2 * 20 + 2 * 8);
  });

  it('leaves no floor at fill 1', () => {
    // given
    const options = { fill: 1 };

    // when
    const { grid } = cave(options);

    // then
    expect(count(grid, Tile.Floor)).toBe(0);
  });

  it('lets floor reach the border without borderWalls', () => {
    // given
    const options = { fill: 0.2, borderWalls: false, cornerBias: 0 };

    // when
    const { grid } = cave(options);

    // then
    const top = grid.toString().split('\n')[0] ?? '';
    expect(top).toContain('.');
  });

  it.each(['blobs', 'veins'] as const)(
    'makes wall of the tiles near the corners with %s',
    (shape) => {
      // given
      const options = { shape, borderWalls: false, cornerBias: 0 };
      const plain = cave(options);

      // when
      const biased = cave({ ...options, cornerBias: 12 });

      // then
      expect(cornerWallShare(biased.grid, 3)).toBeGreaterThan(0.95);
      expect(cornerWallShare(plain.grid, 3)).toBeLessThan(0.8);
    },
  );

  it('walls a corner of a noise that is floor there but not a straight edge', () => {
    // given
    const noise = (x: number) => x / 60;

    // when
    const { grid } = cave({
      noise,
      scaleX: 1,
      fill: 0.5,
      borderWalls: false,
      cornerBias: 10,
    });

    // then
    expect(grid.get(59, 0)).toBe(Tile.Wall);
    expect(grid.get(59, 39)).toBe(Tile.Wall);
    expect(grid.get(59, 20)).toBe(Tile.Floor);
  });

  it('pulls the walls in as far from the corner as cornerBias says', () => {
    // given
    const noise = (x: number) => x / 60;

    // when
    const { grid } = cave({
      noise,
      scaleX: 1,
      fill: 0.5,
      borderWalls: false,
      cornerBias: 12,
    });

    // then
    expect(grid.get(59, 11)).toBe(Tile.Floor);
    expect(grid.get(59, 2)).toBe(Tile.Wall);
  });

  it('keeps a symmetric cave symmetric with a cornerBias', () => {
    // given
    const options = { symmetry: 'both', cornerBias: 15 } as const;

    // when
    const { grid } = cave(options);

    // then
    expect(countAsymmetry(grid, 'both')).toBe(0);
  });

  it('applies the rotation to the noise', () => {
    // given
    const noise = (_x: number, y: number) => y;

    // when
    const { grid } = cave({
      noise,
      rotation: 90,
      fill: 0.5,
      borderWalls: false,
    });

    // then
    expect(grid.get(5, 20)).toBe(Tile.Floor);
    expect(grid.get(54, 20)).toBe(Tile.Wall);
  });

  it('applies the scales to the noise', () => {
    // given
    const seen: number[] = [];
    const noise = (x: number) => {
      seen.push(x);
      return 0;
    };

    // when
    sized(20, 5, { noise, scaleX: 10 });

    // then
    expect(Math.max(...seen)).toBeCloseTo(18.5 / 10);
  });

  it('carves other caves for blobs and veins', () => {
    // given
    const blobs = cave({ shape: 'blobs' });

    // when
    const veins = cave({ shape: 'veins' });

    // then
    expect(veins.grid.toString()).not.toBe(blobs.grid.toString());
  });

  it('keeps the border of its area solid by default', () => {
    // given
    const options = { fill: 0 };

    // when
    const { grid } = cave(options);

    // then
    const rows = grid.toString().split('\n');
    expect(rows[0]).toBe('#'.repeat(60));
    expect(rows[20]?.[0]).toBe('#');
    expect(rows[20]?.[59]).toBe('#');
  });

  it('makes floor of the high part of the noise for blobs', () => {
    // given
    const noise = (x: number) => x;

    // when
    const { grid } = cave({ noise, fill: 0.5, borderWalls: false });

    // then
    expect(grid.get(5, 20)).toBe(Tile.Wall);
    expect(grid.get(54, 20)).toBe(Tile.Floor);
  });

  it('makes floor around the midpoint of the noise for veins', () => {
    // given
    const noise = (x: number) => (x - 30) / 30;

    // when
    const { grid } = cave({
      noise,
      shape: 'veins',
      scaleX: 1,
      scaleY: 1,
      fill: 0.5,
      borderWalls: false,
    });

    // then
    expect(grid.get(30, 20)).toBe(Tile.Floor);
    expect(grid.get(2, 20)).toBe(Tile.Wall);
    expect(grid.get(57, 20)).toBe(Tile.Wall);
  });

  it('smooths the noise', () => {
    // given
    const raw = cave({ iterations: 0, scaleX: 3, scaleY: 3 });

    // when
    const smooth = cave({ iterations: 2, scaleX: 3, scaleY: 3 });

    // then
    expect(smooth.grid.toString()).not.toBe(raw.grid.toString());
  });

  it.each(['horizontal', 'vertical', 'both', 'rotational'] as const)(
    'carves a perfectly %s cave at chance 1',
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
      symmetry: 'rotational',
      scaleX: 4,
      scaleY: 4,
      area: { width: { min: 22, max: 22 }, height: { min: 14, max: 14 } },
    } as const;

    // when
    const { grid, caverns } = cave(options, 2);

    // then
    const [box] = caverns;
    expect(box).toBeDefined();
    if (box) {
      expect(countAsymmetry(cut(grid, box), 'rotational')).toBe(0);
    }
  });

  it('leaves out the caverns below minRegionSize', () => {
    // given
    const loose = cave({ scaleX: 5, scaleY: 5 });

    // when
    const { grid } = cave({ minRegionSize: 20, scaleX: 5, scaleY: 5 });

    // then
    expect(findCaveRegions(loose.grid).some((r) => r.length < 20)).toBe(true);
    expect(findCaveRegions(grid).every((r) => r.length >= 20)).toBe(true);
  });

  it('keeps only the largest cavern with largestOnly', () => {
    // given
    const options = { largestOnly: true, scaleX: 5, scaleY: 5 };

    // when
    const { grid } = cave(options);

    // then
    expect(findCaveRegions(grid)).toHaveLength(1);
  });

  it('keeps the largest piece of a cave in an area and leaves the rest of the map alone', () => {
    // given
    const options = {
      largestOnly: true,
      scaleX: 4,
      scaleY: 4,
      area: { width: { min: 20, max: 20 }, height: { min: 16, max: 16 } },
    };

    // when
    const { grid, caverns } = cave(options, 6);

    // then
    const [box] = caverns;
    expect(box).toMatchObject({ width: 20, height: 16 });
    const regions = findCaveRegions(grid);
    expect(regions).toHaveLength(1);
    for (const { x, y } of regions[0] ?? []) {
      expect(x > (box?.x ?? 0) && x < (box?.x ?? 0) + 19).toBe(true);
      expect(y > (box?.y ?? 0) && y < (box?.y ?? 0) + 15).toBe(true);
    }
  });

  it('carves different caves in two areas from one noise', () => {
    // given
    const options = {
      count: { min: 2, max: 2 },
      area: { width: { min: 20, max: 20 }, height: { min: 15, max: 15 } },
    };

    // when
    const { grid, caverns } = cave(options, 4);

    // then
    const [first, second] = caverns;
    expect(caverns).toHaveLength(2);
    if (first && second) {
      expect(cut(grid, first).toString()).not.toBe(
        cut(grid, second).toString(),
      );
    }
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
    const { grid } = pipeline(base, [block, digNoiseCave({ fill: 0.2 })], {
      random: mulberry32(1),
    });

    // then
    for (let y = 10; y < 30; ++y) {
      for (let x = 20; x < 40; ++x) {
        expect(grid.get(x, y)).toBe(Tile.Wall);
      }
    }
  });

  it('needs a map that starts as wall', () => {
    // given
    const grass = emptyMap({ width: 40, height: 30, tile: Tile.Grass });

    // when
    const run = () => pipeline(grass, [digNoiseCave()]);

    // then
    expect(run).toThrow(/digNoiseCave digs its floor out of rock/);
  });

  it('lists the caverns of a cave placed beside as rooms inside its area', () => {
    // given
    const steps = [
      digNoiseCave({
        area: { width: { min: 14, max: 14 }, height: { min: 14, max: 14 } },
      }),
      digNoiseCave({
        area: { width: { min: 14, max: 14 }, height: { min: 14, max: 14 } },
        placement: 'beside',
        largestOnly: true,
      }),
    ] as const;

    // when
    const { rooms, roomGroups } = pipeline(base, steps, {
      random: mulberry32(2),
    });

    // then
    const beside = rooms.filter(({ group }) => group === 1);
    const { area } = roomGroups[1] as CaveGroup;
    expect(beside).toHaveLength(1);
    for (const room of beside) {
      expect(room.kind).toBe('cavern');
      expect(
        room.x >= area.x && room.x + room.width <= area.x + area.width,
      ).toBe(true);
      expect(
        room.y >= area.y && room.y + room.height <= area.y + area.height,
      ).toBe(true);
    }
  });

  it('places a cave beside the floor that was there, a wall away from it', () => {
    // given
    const corridor = step('corridor', {}, ({ grid }) => {
      for (let x = 1; x < 59; ++x) {
        grid.set(x, 20, Tile.Floor);
      }
      return {};
    });
    const steps = [
      corridor,
      digNoiseCave({
        area: { width: { min: 14, max: 14 }, height: { min: 14, max: 14 } },
        scaleX: 5,
        scaleY: 5,
        placement: 'beside',
        largestOnly: true,
      }),
    ] as const;

    // when
    const runs = [1, 2, 3].map((seed) =>
      withCaves(pipeline(base, steps, { random: mulberry32(seed) })),
    );

    // then
    for (const { grid, caverns } of runs) {
      expect(caverns).toHaveLength(1);
      expect(findCaveRegions(grid)).toHaveLength(2);
    }
  });

  it.each([
    { shape: 'spots' as 'blobs' },
    { fill: 1.5 },
    { cornerBias: -1 },
    { iterations: 0.5 },
    { cornerBias: 2.5 },
    { scaleX: 0 },
    { octaves: 0 },
    { persistence: 2 },
    { symmetryChance: 2 },
    { placement: 'anywhere' as 'free' },
  ])('throws a RangeError at once for %o', (options) => {
    // given
    const bad: DigNoiseCaveOptions = options;

    // when
    const make = () => digNoiseCave(bad);

    // then
    expect(make).toThrow(RangeError);
  });
});
