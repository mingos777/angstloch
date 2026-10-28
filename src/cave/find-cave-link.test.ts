import { describe, expect, it } from 'vitest';
import { findCaveLink } from './find-cave-link';
import { Grid } from '../core/grid';
import { Tile } from '../core/tile';

describe('findCaveLink', () => {
  it('returns the closest pair of tiles of the group and another cavern', () => {
    // given
    const grid = new Grid(12, 3);
    for (const x of [1, 2, 3, 9]) {
      grid.set(x, 1, Tile.Floor);
    }
    const group = [1, 2, 3].map((x) => ({ x, y: 1 }));

    // when
    const link = findCaveLink(grid, group);

    // then
    expect(link).toEqual({ from: { x: 3, y: 1 }, to: { x: 9, y: 1 } });
  });

  it('prefers the nearer of two other caverns', () => {
    // given
    const grid = new Grid(20, 3);
    for (const x of [1, 6, 16]) {
      grid.set(x, 1, Tile.Floor);
    }

    // when
    const link = findCaveLink(grid, [{ x: 1, y: 1 }]);

    // then
    expect(link?.to).toEqual({ x: 6, y: 1 });
  });

  it('returns nothing when there is no other floor', () => {
    // given
    const grid = new Grid(5, 3);
    grid.set(2, 1, Tile.Floor);

    // when
    const link = findCaveLink(grid, [{ x: 2, y: 1 }]);

    // then
    expect(link).toBeUndefined();
  });

  it('goes round blocked tiles, and finds nothing past a blocked wall', () => {
    // given
    const grid = new Grid(12, 3);
    for (const x of [1, 9]) {
      grid.set(x, 1, Tile.Floor);
    }
    const blocked = new Uint8Array(12 * 3);
    for (let y = 0; y < 3; ++y) {
      blocked[y * 12 + 5] = 1;
    }

    // when
    const link = findCaveLink(grid, [{ x: 1, y: 1 }], blocked);

    // then
    expect(link).toBeUndefined();
  });
});
