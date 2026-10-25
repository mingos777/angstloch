import { describe, expect, it } from 'vitest';
import { createSearchBuffers, findCorridor } from './find-corridor';
import type { CorridorMap } from './find-corridor';
import type { Point } from './point';

interface MapOptions {
  size?: number;
  lattice?: boolean;
  reserved?: Point[];
  corridor?: Point[];
  noise?: (x: number, y: number) => number;
}

function map({
  size = 12,
  lattice = false,
  reserved = [],
  corridor = [],
  noise = () => 0,
}: MapOptions = {}): CorridorMap {
  const result: CorridorMap = {
    search: createSearchBuffers(size * size),
    width: size,
    height: size,
    lattice,
    reserved: new Uint8Array(size * size),
    corridor: new Uint8Array(size * size),
    noise: new Float32Array(size * size),
    horizontalCost: 1,
    verticalCost: 1,
    turnCost: 0,
    averageCost: 1,
  };
  for (const { x, y } of reserved) {
    result.reserved[y * size + x] = 1;
  }
  for (const { x, y } of corridor) {
    result.corridor[y * size + x] = 1;
  }
  for (let y = 0; y < size; ++y) {
    for (let x = 0; x < size; ++x) {
      result.noise[y * size + x] = noise(x, y);
    }
  }
  return result;
}

function column(x: number, from: number, to: number) {
  return Array.from({ length: to - from + 1 }, (_, i) => ({ x, y: from + i }));
}

function touches(a: Point, b: Point) {
  return Math.abs(a.x - b.x) <= 1 && Math.abs(a.y - b.y) <= 1;
}

describe('findCorridor', () => {
  it('finds a direct corridor across open ground', () => {
    // given
    const open = map();

    // when
    const path = findCorridor(open, { x: 2, y: 2 }, 1, { x: 8, y: 2 }, false);

    // then
    expect(path).toHaveLength(7);
  });

  it('lists the tiles from the start to the target', () => {
    // given
    const open = map();

    // when
    const path = findCorridor(open, { x: 2, y: 2 }, 1, { x: 5, y: 2 }, false);

    // then
    expect(path).toEqual([
      { x: 2, y: 2 },
      { x: 3, y: 2 },
      { x: 4, y: 2 },
      { x: 5, y: 2 },
    ]);
  });

  it('goes around reserved tiles', () => {
    // given
    const blocked = map({ reserved: column(5, 1, 7) });

    // when
    const path = findCorridor(
      blocked,
      { x: 2, y: 3 },
      1,
      { x: 8, y: 3 },
      false,
    );

    // then
    expect(path?.some((tile) => tile.x === 5 && tile.y <= 7)).toBe(false);
    expect(path?.at(-1)).toEqual({ x: 8, y: 3 });
  });

  it('keeps off the map border', () => {
    // given
    const open = map({ reserved: column(5, 1, 10) });

    // when
    const path = findCorridor(open, { x: 2, y: 3 }, 1, { x: 8, y: 3 }, false);

    // then
    expect(path).toBeUndefined();
  });

  it('gives up when the target cannot be reached', () => {
    // given
    const walled = map({
      reserved: [
        { x: 7, y: 7 },
        { x: 9, y: 7 },
        { x: 8, y: 6 },
        { x: 8, y: 8 },
      ],
    });

    // when
    const path = findCorridor(walled, { x: 2, y: 2 }, 1, { x: 8, y: 7 }, false);

    // then
    expect(path).toBeUndefined();
  });

  it('gives up on a detour that is far too long', () => {
    // given
    const maze = map({ size: 40, reserved: column(20, 1, 37) });

    // when
    const path = findCorridor(
      maze,
      { x: 18, y: 20 },
      1,
      { x: 22, y: 20 },
      false,
    );

    // then
    expect(path).toBeUndefined();
  });

  it('moves two tiles at a time on the lattice', () => {
    // given
    const open = map({ lattice: true });

    // when
    const path = findCorridor(open, { x: 1, y: 1 }, 1, { x: 5, y: 1 }, false);

    // then
    expect(path).toEqual([
      { x: 1, y: 1 },
      { x: 2, y: 1 },
      { x: 3, y: 1 },
      { x: 4, y: 1 },
      { x: 5, y: 1 },
    ]);
  });

  it('prefers fewer turns with a turn cost', () => {
    // given
    const turns = (turnCost: number) => {
      const open = { ...map(), turnCost };
      const path = findCorridor(open, { x: 2, y: 2 }, 1, { x: 8, y: 8 }, false);
      return (path ?? []).filter(
        (_, i, all) =>
          i > 0 &&
          i < all.length - 1 &&
          (all[i - 1] as Point).x !== (all[i + 1] as Point).x &&
          (all[i - 1] as Point).y !== (all[i + 1] as Point).y,
      ).length;
    };

    // when
    const straight = turns(10);

    // then
    expect(straight).toBe(1);
  });

  it('prefers the cheaper direction', () => {
    // given
    const cheapHorizontal = {
      ...map(),
      horizontalCost: 0.5,
      verticalCost: 1.5,
    };

    // when
    const path = findCorridor(
      cheapHorizontal,
      { x: 2, y: 2 },
      1,
      { x: 6, y: 6 },
      false,
    );

    // then
    expect(path?.[1]).toEqual({ x: 3, y: 2 });
  });

  describe('existing corridors', () => {
    const wall = column(6, 1, 10);

    it('is not allowed to cross them by default', () => {
      // given
      const crossed = map({ corridor: wall });

      // when
      const path = findCorridor(
        crossed,
        { x: 2, y: 5 },
        1,
        { x: 10, y: 5 },
        false,
      );

      // then
      expect(path).toBeUndefined();
    });

    it('can cross them straight on when asked to', () => {
      // given
      const crossed = map({ corridor: wall });

      // when
      const path = findCorridor(
        crossed,
        { x: 2, y: 5 },
        1,
        { x: 10, y: 5 },
        true,
      );

      // then
      expect(path).toHaveLength(9);
    });

    it('never runs alongside one', () => {
      // given
      const beside = map({ corridor: column(6, 3, 8) });

      // when
      const path = findCorridor(
        beside,
        { x: 2, y: 5 },
        1,
        { x: 10, y: 5 },
        true,
      );

      // then
      const corridor = column(6, 3, 8);
      const along = (path ?? []).filter(
        (tile) =>
          tile.x !== 6 &&
          corridor.some((c) => Math.abs(c.x - tile.x) === 1 && c.y === tile.y),
      );
      expect(along).toEqual([
        { x: 5, y: 5 },
        { x: 7, y: 5 },
      ]);
    });

    it('never passes diagonally beside one', () => {
      // given
      const lone = [{ x: 6, y: 6 }];
      const beside = map({ corridor: lone });

      // when
      const path = findCorridor(
        beside,
        { x: 2, y: 5 },
        1,
        { x: 10, y: 5 },
        false,
      );

      // then
      expect(path?.some((tile) => touches(tile, { x: 6, y: 6 }))).toBe(false);
    });

    it('can start from one and branch off', () => {
      // given
      const branching = map({
        corridor: [
          { x: 6, y: 5 },
          { x: 5, y: 5 },
          { x: 7, y: 5 },
        ],
      });

      // when
      const path = findCorridor(
        branching,
        { x: 6, y: 5 },
        0,
        { x: 6, y: 1 },
        false,
      );

      // then
      expect(path).toEqual([
        { x: 6, y: 5 },
        { x: 6, y: 4 },
        { x: 6, y: 3 },
        { x: 6, y: 2 },
        { x: 6, y: 1 },
      ]);
    });

    it('ends on the nearest tile that passes a test', () => {
      // given
      const joined = map({ corridor: column(9, 1, 10) });
      const target = {
        test: (x: number, y: number) => x === 9 && y >= 1,
        aim: { x: 9, y: 5 },
      };

      // when
      const path = findCorridor(joined, { x: 3, y: 5 }, 1, target, false);

      // then
      expect(path?.at(-1)).toEqual({ x: 9, y: 5 });
    });

    it('can search the whole map for a target that passes a test', () => {
      // given
      const far = map({ size: 40, corridor: column(36, 1, 38) });
      const target = {
        test: (x: number) => x === 36,
        aim: { x: 36, y: 20 },
        unbounded: true,
      };

      // when
      const path = findCorridor(far, { x: 2, y: 20 }, 1, target, false);

      // then
      expect(path?.at(-1)?.x).toBe(36);
    });
  });

  describe('touching itself', () => {
    it('bridges a corridor that comes back diagonally to itself', () => {
      // given
      // the cheap tiles form a hook that ends diagonally next to its start
      const hook = new Set(['3,3', '3,2', '4,2', '5,2', '5,3', '5,4', '4,4']);
      const winding = map({
        noise: (x, y) => (hook.has(`${String(x)},${String(y)}`) ? 0 : 50),
      });

      // when
      const path = findCorridor(
        winding,
        { x: 3, y: 3 },
        0,
        { x: 4, y: 4 },
        false,
      );

      // then
      expect(path).toHaveLength(3);
    });

    it('leaves no two tiles of a corridor touching unless they follow each other', () => {
      // given
      const hook = new Set(['3,3', '3,2', '4,2', '5,2', '5,3', '5,4', '4,4']);
      const winding = map({
        noise: (x, y) => (hook.has(`${String(x)},${String(y)}`) ? 0 : 50),
      });

      // when
      const path =
        findCorridor(winding, { x: 3, y: 3 }, 0, { x: 4, y: 4 }, false) ?? [];

      // then
      const touching = path.filter((a, i) =>
        path.some((b, j) => j > i + 2 && touches(a, b)),
      );
      expect(touching).toEqual([]);
    });
  });

  it('joins the tip of a corridor that goes on straight ahead', () => {
    // given
    const across = (from: number, to: number, y: number) =>
      Array.from({ length: to - from + 1 }, (_, i) => ({ x: from + i, y }));
    // a row of corridor with a gap in it, walled in above and below
    const corridors = map({
      reserved: [...across(0, 11, 4), ...across(0, 11, 6)],
      corridor: [...across(1, 3, 5), ...across(5, 8, 5)],
    });
    const target = {
      test: (x: number, y: number) => x >= 5 && y === 5,
      aim: { x: 5, y: 5 },
    };

    // when
    const path = findCorridor(corridors, { x: 3, y: 5 }, 1, target, false);

    // then
    expect(path).toEqual([
      { x: 3, y: 5 },
      { x: 4, y: 5 },
      { x: 5, y: 5 },
    ]);
  });
});
