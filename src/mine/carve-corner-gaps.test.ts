import { describe, expect, it } from 'vitest';
import { Grid } from '../core/grid';
import { Tile } from '../core/tile';
import { carveCornerGaps } from './carve-corner-gaps';

/** A grid drawn as rows of `#` for wall and `.` for floor. */
function draw(rows: readonly string[]): Grid {
  const grid = new Grid(rows[0]?.length ?? 0, rows.length, Tile.Wall);
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; ++x) {
      if (row.charAt(x) === '.') {
        grid.set(x, y, Tile.Floor);
      }
    }
  });
  return grid;
}

const always = () => true;

/** Two tunnels that fork, with the tip of the rock between them touching the rest at a corner only. */
const FORK = ['#######', '#.....#', '#..#..#', '#...#.#', '#..##.#', '#######'];

describe('carveCornerGaps', () => {
  it('digs the tip of the rock where two tunnels meet at a corner', () => {
    // given
    const grid = draw(FORK);

    // when
    const carved = carveCornerGaps(grid, always, always);

    // then
    expect(carved).toBe(1);
    expect(grid.get(3, 2)).toBe(Tile.Floor);
    expect(grid.get(4, 3)).toBe(Tile.Wall);
  });

  it('reports every tile it digs', () => {
    // given
    const grid = draw(FORK);
    const dug: string[] = [];

    // when
    carveCornerGaps(grid, always, always, (x, y) => {
      dug.push(`${String(x)},${String(y)}`);
    });

    // then
    expect(dug).toEqual(['3,2']);
  });

  it('leaves a map with no corner gaps alone', () => {
    // given
    const grid = draw(['#####', '#...#', '#.#.#', '#...#', '#####']);
    const before = grid.toString();

    // when
    const carved = carveCornerGaps(grid, always, always);

    // then
    expect(carved).toBe(0);
    expect(grid.toString()).toBe(before);
  });

  it('leaves a gap where digging either wall would split the rock', () => {
    // given
    const grid = draw([
      '######',
      '#..###',
      '#..###',
      '###..#',
      '###..#',
      '######',
    ]);
    const before = grid.toString();

    // when
    const carved = carveCornerGaps(grid, always, always);

    // then
    expect(carved).toBe(0);
    expect(grid.toString()).toBe(before);
  });

  it('cuts a piece off the rock to close a gap when loops are allowed', () => {
    // given
    const grid = draw([
      '######',
      '#..###',
      '#..###',
      '###..#',
      '###..#',
      '######',
    ]);

    // when
    const carved = carveCornerGaps(grid, always, always, undefined, true);

    // then
    expect(carved).toBe(1);
    expect(grid.get(3, 2) === Tile.Floor || grid.get(2, 3) === Tile.Floor).toBe(
      true,
    );
  });

  it('digs nothing when neither wall may be dug', () => {
    // given
    const grid = draw(FORK);

    // when
    const carved = carveCornerGaps(grid, always, () => false);

    // then
    expect(carved).toBe(0);
    expect(grid.get(3, 2)).toBe(Tile.Wall);
  });

  it('leaves gaps between floor that is not its own', () => {
    // given
    const grid = draw(FORK);

    // when
    const carved = carveCornerGaps(grid, (x) => x < 3, always);

    // then
    expect(carved).toBe(0);
  });
});
