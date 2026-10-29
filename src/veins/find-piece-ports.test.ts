import { describe, expect, it } from 'vitest';
import { Grid } from '../core/grid';
import { Tile } from '../core/tile';
import { Reserve } from '../pipeline/reserve';
import { findOutsideRock } from './find-outside-rock';
import { findPiecePorts } from './find-piece-ports';

/** A map of wall with a block of floor from (5, 5) to (7, 7). */
function blockMap() {
  const grid = new Grid(20, 20);
  const floor = [];
  for (let y = 5; y <= 7; ++y) {
    for (let x = 5; x <= 7; ++x) {
      grid.set(x, y, Tile.Floor);
      floor.push({ x, y });
    }
  }
  return { grid, floor, reserved: new Uint8Array(20 * 20) };
}

describe('findPiecePorts', () => {
  it('takes the floor tiles that have free rock beside them', () => {
    // given
    const { grid, floor, reserved } = blockMap();

    // when
    const ports = findPiecePorts(grid, reserved, floor, findOutsideRock(grid));

    // then
    expect(ports).toHaveLength(8);
    expect(ports).not.toContainEqual({ x: 6, y: 6, door: false });
    expect(ports.every(({ door }) => !door)).toBe(true);
  });

  it('leaves out rock that is shut in, such as a pillar', () => {
    // given
    const grid = new Grid(20, 20);
    const floor = [];
    for (let y = 5; y <= 9; ++y) {
      for (let x = 5; x <= 9; ++x) {
        if (x !== 7 || y !== 7) {
          grid.set(x, y, Tile.Floor);
          floor.push({ x, y });
        }
      }
    }

    // when
    const ports = findPiecePorts(
      grid,
      new Uint8Array(400),
      floor,
      findOutsideRock(grid),
    );

    // then
    expect(ports).toContainEqual({ x: 7, y: 5, door: false });
    expect(ports).not.toContainEqual({ x: 7, y: 6, door: false });
  });

  it('leaves out rock that is reserved', () => {
    // given
    const { grid, floor, reserved } = blockMap();
    for (let x = 5; x <= 7; ++x) {
      reserved[4 * 20 + x] = Reserve.Solid;
    }

    // when
    const ports = findPiecePorts(grid, reserved, floor, findOutsideRock(grid));

    // then
    expect(ports).not.toContainEqual({ x: 6, y: 5, door: false });
    expect(ports).toContainEqual({ x: 5, y: 5, door: false });
  });

  it('takes an openable tile with free rock beyond it as a door', () => {
    // given
    const { grid, floor, reserved } = blockMap();
    reserved[6 * 20 + 8] = Reserve.Openable;

    // when
    const ports = findPiecePorts(grid, reserved, floor, findOutsideRock(grid));

    // then
    expect(ports).toContainEqual({ x: 8, y: 6, door: true });
  });

  it('leaves out an openable tile with a reserved tile beyond it', () => {
    // given
    const { grid, floor, reserved } = blockMap();
    reserved[6 * 20 + 8] = Reserve.Openable;
    reserved[6 * 20 + 9] = Reserve.Solid;

    // when
    const ports = findPiecePorts(grid, reserved, floor, findOutsideRock(grid));

    // then
    expect(ports.some(({ door }) => door)).toBe(false);
  });

  it('leaves out the outer ring of the map that stays wall', () => {
    // given
    const grid = new Grid(10, 10);
    const floor = [{ x: 2, y: 2 }];
    grid.set(2, 2, Tile.Floor);

    // when
    const ports = findPiecePorts(
      grid,
      new Uint8Array(100),
      floor,
      findOutsideRock(grid),
    );

    // then
    expect(ports).toEqual([{ x: 2, y: 2, door: false }]);
  });
});
