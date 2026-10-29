import { describe, expect, it } from 'vitest';
import { Tile } from '../core/tile';
import { emptyMap } from '../pipeline/empty-map';
import { pipeline } from '../pipeline/pipeline';
import { Reserve } from '../pipeline/reserve';
import { step } from '../pipeline/step';
import { mulberry32 } from '../test-helpers/mulberry32';
import { openExits } from './open-exits';

const base = emptyMap({ width: 21, height: 15, tile: Tile.Wall });

/** A floor block in the middle of the wall map. */
const hall = step('hall', {}, ({ grid }) => {
  for (let y = 5; y <= 9; ++y) {
    for (let x = 6; x <= 14; ++x) {
      grid.set(x, y, Tile.Floor);
    }
  }
  return {};
});

describe('openExits', () => {
  it('adds no exits by default', () => {
    // given
    const steps = [hall, openExits()] as const;

    // when
    const { exits } = pipeline(base, steps, { random: mulberry32(1) });

    // then
    expect(exits).toEqual([]);
  });

  it('carves as many exits as asked, each a door on the border', () => {
    // given
    const steps = [hall, openExits({ count: { min: 3, max: 3 } })] as const;

    // when
    const { grid, exits } = pipeline(base, steps, { random: mulberry32(1) });

    // then
    expect(exits).toHaveLength(3);
    for (const { x, y } of exits) {
      expect(grid.get(x, y)).toBe(Tile.Door);
      expect(x === 0 || y === 0 || x === 20 || y === 14).toBe(true);
    }
  });

  it('gives up without throwing when there is no floor to reach', () => {
    // given
    const steps = [openExits({ count: { min: 2, max: 2 } })] as const;

    // when
    const { exits } = pipeline(base, steps, { random: mulberry32(1) });

    // then
    expect(exits).toEqual([]);
  });

  it('keeps doors off odd-only coordinates on a lattice', () => {
    // given
    const steps = [
      hall,
      openExits({ count: { min: 4, max: 4 }, lattice: true }),
    ] as const;

    // when
    const { exits } = pipeline(base, steps, { random: mulberry32(2) });

    // then
    expect(exits.length).toBeGreaterThan(0);
    for (const { x, y } of exits) {
      expect((x === 0 || x === 20 ? y : x) % 2).toBe(1);
    }
  });

  it('adds mirrored twins with a symmetry', () => {
    // given
    const steps = [
      hall,
      openExits({ count: { min: 2, max: 2 }, symmetry: 'horizontal' }),
    ] as const;

    // when
    const { exits } = pipeline(base, steps, { random: mulberry32(3) });

    // then
    expect(exits).toHaveLength(2);
    const [first, second] = exits;
    expect(second?.x).toBe(20 - (first?.x ?? 0));
  });

  it('never digs through a reserved tile', () => {
    // given
    const reserve = step('reserve', {}, ({ reserved }) => {
      // every row above the hall is reserved
      reserved.fill(Reserve.Solid, 0, 5 * 21);
      return {};
    });
    const steps = [
      hall,
      reserve,
      openExits({ count: { min: 6, max: 6 } }),
    ] as const;

    // when
    const { exits } = pipeline(base, steps, { random: mulberry32(4) });

    // then
    expect(exits.length).toBeGreaterThan(0);
    for (const { y } of exits) {
      expect(y).not.toBe(0);
    }
  });

  it('appends to the exits that are in the state', () => {
    // given
    const first = openExits({ count: { min: 1, max: 1 } });
    const second = openExits({ count: { min: 1, max: 1 } });

    // when
    const { exits } = pipeline(base, [hall, first, second] as const, {
      random: mulberry32(5),
    });

    // then
    expect(exits).toHaveLength(2);
  });

  it('keeps away from the doors that are in the state', () => {
    // given
    const one = step('one', {}, () => ({ exits: [{ x: 10, y: 0 }] }));
    const steps = [
      hall,
      one,
      openExits({ count: { min: 20, max: 20 } }),
    ] as const;

    // when
    const { exits } = pipeline(base, steps, { random: mulberry32(6) });

    // then
    expect(exits[0]).toEqual({ x: 10, y: 0 });
    for (const { x, y } of exits.slice(1)) {
      expect(Math.abs(x - 10) <= 1 && y === 0).toBe(false);
    }
  });

  it('records each door with openReserved', () => {
    // given
    const openable = step('openable', {}, ({ reserved }) => {
      reserved.fill(Reserve.Openable, 0, 21);
      return {};
    });
    const steps = [
      hall,
      openable,
      openExits({ count: { min: 1, max: 1 } }),
    ] as const;

    // when
    const { reserved, exits } = pipeline(base, steps, {
      random: mulberry32(7),
    });

    // then
    const [door] = exits;
    expect(door).toBeDefined();
    expect(reserved[(door?.y ?? 0) * 21 + (door?.x ?? 0)]).toBe(Reserve.Solid);
  });

  it('clears the prunable byte of the tiles it stamps', () => {
    // given
    const cover = step('cover', {}, ({ prunable }) => {
      prunable.fill(1);
      return {};
    });
    const steps = [
      hall,
      cover,
      openExits({ count: { min: 1, max: 1 } }),
    ] as const;

    // when
    const { prunable, exits } = pipeline(base, steps, {
      random: mulberry32(8),
    });

    // then
    const [door] = exits;
    expect(prunable[(door?.y ?? 0) * 21 + (door?.x ?? 0)]).toBe(0);
  });

  it('stamps the tile it is given', () => {
    // given
    const steps = [
      hall,
      openExits({ count: { min: 1, max: 1 }, tile: Tile.Floor }),
    ] as const;

    // when
    const { grid, exits } = pipeline(base, steps, { random: mulberry32(9) });

    // then
    const [door] = exits;
    expect(grid.get(door?.x ?? -1, door?.y ?? -1)).toBe(Tile.Floor);
  });

  it.each([
    ['a count below 0', { count: { min: -1, max: 1 } }],
    ['a count with min above max', { count: { min: 3, max: 1 } }],
    ['an unknown symmetry', { symmetry: 'diagonal' as 'both' }],
    ['a chance above 1', { symmetryChance: 1.5 }],
    ['a tile that is not one', { tile: 99 as Tile }],
  ])('throws a RangeError at once for %s', (_, options) => {
    // given
    const make = () => openExits(options);

    // when
    const call = make;

    // then
    expect(call).toThrow(RangeError);
  });
});
