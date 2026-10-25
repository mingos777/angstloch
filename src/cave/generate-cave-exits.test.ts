import { describe, expect, it } from 'vitest';
import type { CaveOptions } from './cave-options';
import { generateCave } from './generate-cave';
import { mulberry32 } from '../test-helpers/mulberry32';
import { Tile } from '../core/tile';

function cave(options: Partial<CaveOptions>, seed = 1) {
  return generateCave({
    width: 60,
    height: 40,
    random: mulberry32(seed),
    ...options,
  });
}

describe('generateCave exits', () => {
  it('adds no exits by default', () => {
    // given
    const options = {};

    // when
    const { exits } = cave(options);

    // then
    expect(exits).toEqual([]);
  });

  it('adds minExits exits', () => {
    // given
    const options = { minExits: 3 };

    // when
    const { exits } = cave(options);

    // then
    expect(exits).toHaveLength(3);
  });

  it('adds between minExits and maxExits exits', () => {
    // given
    const counts = new Set<number>();

    // when
    for (let seed = 1; seed <= 30; ++seed) {
      counts.add(cave({ minExits: 1, maxExits: 4 }, seed).exits.length);
    }

    // then
    expect([...counts].every((count) => count >= 1 && count <= 4)).toBe(true);
    expect(counts.size).toBeGreaterThan(1);
  });

  it('treats a smaller maxExits as minExits', () => {
    // given
    const options = { minExits: 2, maxExits: 1 };

    // when
    const { exits } = cave(options);

    // then
    expect(exits).toHaveLength(2);
  });

  it('puts every exit on the border as a door tile', () => {
    // given
    const options = { minExits: 4 };

    // when
    const { grid, exits } = cave(options);

    // then
    for (const { x, y } of exits) {
      expect(x === 0 || y === 0 || x === 59 || y === 39).toBe(true);
      expect(grid.get(x, y)).toBe(Tile.Door);
    }
  });

  it('keeps the doors apart', () => {
    // given
    const options = { minExits: 8 };

    // when
    const { exits } = cave(options);

    // then
    for (const [i, a] of exits.entries()) {
      for (const b of exits.slice(i + 1)) {
        expect(
          Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y)),
        ).toBeGreaterThan(1);
      }
    }
  });

  it('leads every exit into the cave', () => {
    // given
    const options = { minExits: 4 };

    // when
    const { grid, regions, exits } = cave(options);

    // then
    expect(regions).toHaveLength(1);
    for (const { x, y } of exits) {
      const inward = [
        { x: x + 1, y },
        { x: x - 1, y },
        { x, y: y + 1 },
        { x, y: y - 1 },
      ].filter((n) => grid.get(n.x, n.y) === Tile.Floor);
      expect(inward.length).toBeGreaterThan(0);
    }
  });

  it('keeps the exit tunnels in the regions', () => {
    // given
    const options = { minExits: 4 };

    // when
    const { grid, regions } = cave(options);

    // then
    const floor = grid.toString().split('.').length - 1;
    expect(regions.reduce((sum, region) => sum + region.size, 0)).toBe(floor);
  });

  it('digs the same exits for the same seed', () => {
    // given
    const options = { minExits: 3 };

    // when
    const a = cave(options, 5);
    const b = cave(options, 5);

    // then
    expect(a.exits).toEqual(b.exits);
  });

  it('adds no exits on a map without floor', () => {
    // given
    const options = { fillChance: 1, minExits: 2 };

    // when
    const { exits } = cave(options);

    // then
    expect(exits).toEqual([]);
  });

  it.each([
    ['minExits', { minExits: -1 }],
    ['maxExits', { minExits: 0, maxExits: 1.5 }],
  ])('throws a RangeError for an invalid %s', (name, options) => {
    // given
    const generate = () => cave(options);

    // when / then
    expect(generate).toThrow(RangeError);
    expect(generate).toThrow(name);
  });
});
