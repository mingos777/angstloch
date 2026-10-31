import { describe, expect, it } from 'vitest';
import { Grid } from '../core/grid';
import { Tile } from '../core/tile';
import { mendCornerTouches } from './mend-corner-touches';

/** A grid of wall with floor where the rows say `.`. */
function gridOf(rows: string[]): Grid {
  const grid = new Grid((rows[0] ?? '').length, rows.length);
  rows.forEach((row, y) => {
    Array.from(row).forEach((char, x) => {
      if (char === '.') {
        grid.set(x, y, Tile.Floor);
      }
    });
  });
  return grid;
}

const at = (grid: Grid, x: number, y: number) => y * grid.width + x;

describe('mendCornerTouches', () => {
  it('fills back a tile off the middle line that touches floor at a corner', () => {
    // given
    const grid = gridOf(['#####', '#.###', '##.##', '##.##', '#####']);
    const carved = [at(grid, 2, 2), at(grid, 2, 3)];
    const line = new Set([at(grid, 2, 3)]);

    // when
    const mended = mendCornerTouches(grid, carved, line, 0);

    // then
    expect(mended).toBe(true);
    expect(grid.get(2, 2)).toBe(Tile.Wall);
    expect(carved).toEqual([at(grid, 2, 3)]);
  });

  it('digs a tile between when the touching tile is on the middle line', () => {
    // given
    const grid = gridOf(['#####', '#.###', '##.##', '#####']);
    const carved = [at(grid, 2, 2)];
    const line = new Set(carved);

    // when
    const mended = mendCornerTouches(grid, carved, line, 0);

    // then
    expect(mended).toBe(true);
    expect([grid.get(2, 1), grid.get(1, 2)]).toContain(Tile.Floor);
    expect(carved).toHaveLength(2);
  });

  it('fails where both tiles between are protected', () => {
    // given
    const grid = gridOf(['#####', '#.###', '##.##', '#####']);
    const carved = [at(grid, 2, 2)];
    const protect = new Uint8Array(grid.width * grid.height);
    protect[at(grid, 2, 1)] = 1;
    protect[at(grid, 1, 2)] = 1;

    // when
    const mended = mendCornerTouches(grid, carved, new Set(carved), 0, protect);

    // then
    expect(mended).toBe(false);
  });

  it('leaves a vein that touches floor along edges alone', () => {
    // given
    const grid = gridOf(['#####', '#..##', '##.##', '#####']);
    const carved = [at(grid, 2, 2)];

    // when
    const mended = mendCornerTouches(grid, carved, new Set(carved), 0);

    // then
    expect(mended).toBe(true);
    expect(carved).toEqual([at(grid, 2, 2)]);
  });
});
