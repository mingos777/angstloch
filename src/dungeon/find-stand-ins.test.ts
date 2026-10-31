import { describe, expect, it } from 'vitest';
import { Tile } from '../core/tile';
import { emptyMap } from '../pipeline/empty-map';
import type { MapState } from '../pipeline/map-state';
import { Reserve } from '../pipeline/reserve';
import { reserveTile } from '../pipeline/reserve-tile';
import { carveRoom } from '../rooms/carve-room';
import { createRoomShape } from '../rooms/create-room-shape';
import { reserveRoomShape } from '../rooms/reserve-room-shape';
import { TemplateCell } from '../rooms/templates/template-cell';
import { findStandIns } from './find-stand-ins';

const { Unused: U, Floor: F, OptionalExit: O, Wall: W } = TemplateCell;

/** A map of wall with floor where the rows say `.`. */
function mapOf(rows: string[]): MapState {
  const state = emptyMap({
    width: (rows[0] ?? '').length,
    height: rows.length,
    tile: Tile.Wall,
  })();
  rows.forEach((row, y) => {
    Array.from(row).forEach((char, x) => {
      if (char === '.') {
        state.grid.set(x, y, Tile.Floor);
      }
    });
  });
  return state;
}

describe('findStandIns', () => {
  it('takes an openable wall outside every room as a potential exit', () => {
    // given
    const state = mapOf(['#####', '#...#', '#####']);
    for (let y = 0; y < 3; ++y) {
      for (let x = 0; x < 5; ++x) {
        reserveTile(state, x, y, y === 1 ? Reserve.None : Reserve.Solid);
      }
    }
    reserveTile(state, 0, 1, Reserve.Solid);
    reserveTile(state, 4, 1, Reserve.Openable);

    // when
    const { shapes } = findStandIns(state, []);

    // then
    expect(
      shapes[0]?.exits.map(({ x, y }) => [
        (shapes[0]?.x ?? 0) + x,
        (shapes[0]?.y ?? 0) + y,
      ]),
    ).toEqual([[4, 1]]);
  });

  it('leaves out an openable wall that a room holds', () => {
    // given
    const state = mapOf(['#####', '#...#', '#####']);
    for (let y = 0; y < 3; ++y) {
      for (let x = 0; x < 5; ++x) {
        reserveTile(state, x, y, y === 1 ? Reserve.None : Reserve.Solid);
      }
    }
    reserveTile(state, 0, 1, Reserve.Solid);
    reserveTile(state, 4, 1, Reserve.Openable);
    const room = {
      x: 4,
      y: 0,
      width: 1,
      height: 3,
      cells: [[W], [O], [W]],
      exits: [],
      rotation: 0 as const,
      mirrored: false,
    };

    // when
    const { shapes } = findStandIns(state, [room]);

    // then
    expect(shapes[0]?.exits).toEqual([]);
  });

  it('makes a shape of each piece of floor, its walls round it as potential exits and its corners as walls', () => {
    // given
    const state = mapOf(['#####', '#####', '##.##', '##..#', '#####']);

    // when
    const { shapes, floors, firsts } = findStandIns(state, []);

    // then
    expect(shapes).toHaveLength(1);
    expect(shapes[0]?.cells).toEqual([
      [W, O, W, U],
      [O, F, O, W],
      [O, F, F, O],
      [W, O, O, W],
    ]);
    expect([shapes[0]?.x, shapes[0]?.y]).toEqual([1, 1]);
    expect(floors).toEqual([{ x: 2, y: 2, width: 2, height: 2 }]);
    expect(firsts).toEqual([{ x: 2, y: 2 }]);
  });

  it('takes no wall as a potential exit that touches another piece corner to corner', () => {
    // given
    const state = mapOf(['######', '#.####', '###.##', '######']);

    // when
    const { shapes } = findStandIns(state, []);

    // then
    const exitsOf = (index: number) =>
      (shapes[index]?.exits ?? []).map(({ x, y }) => [
        (shapes[index]?.x ?? 0) + x,
        (shapes[index]?.y ?? 0) + y,
      ]);
    expect(exitsOf(0)).not.toContainEqual([2, 1]);
    expect(exitsOf(0)).toContainEqual([1, 2]);
    expect(exitsOf(1)).not.toContainEqual([2, 2]);
    expect(exitsOf(1)).toContainEqual([3, 1]);
  });

  it('points each potential exit away from the piece', () => {
    // given
    const state = mapOf(['#####', '##.##', '#####']);

    // when
    const { shapes } = findStandIns(state, []);

    // then
    expect(
      shapes[0]?.exits.map(({ x, y, directions }) => [x, y, directions]),
    ).toEqual([
      [1, 0, [0]],
      [0, 1, [3]],
      [2, 1, [1]],
      [1, 2, [2]],
    ]);
  });

  it('lists the pieces in the order of their first tile, row by row', () => {
    // given
    const state = mapOf([
      '#######',
      '#....##',
      '#######',
      '##..###',
      '#######',
    ]);
    state.grid.set(5, 3, Tile.Door);

    // when
    const { firsts } = findStandIns(state, []);

    // then
    expect(firsts).toEqual([
      { x: 1, y: 1 },
      { x: 2, y: 3 },
      { x: 5, y: 3 },
    ]);
  });

  it('leaves out the floor of rooms, and their walls as exits', () => {
    // given
    const state = mapOf([
      '###########',
      '#..#......#',
      '#..#......#',
      '###########',
    ]);
    const room = { x: 4, y: 1, width: 6, height: 2 };
    carveRoom(state.grid, {
      ...room,
      id: 0,
      kind: 'room',
      exits: [],
      exitCount: 0,
      doorCount: 0,
    });
    const shape = createRoomShape(room);
    reserveRoomShape(state, shape);

    // when
    const { shapes } = findStandIns(state, [shape]);

    // then
    const [piece] = shapes;
    expect(shapes).toHaveLength(1);
    expect(
      piece?.exits.map(({ x, y }) => [piece.x + x, piece.y + y]),
    ).not.toContainEqual([3, 1]);
  });

  it('makes no exit of a reserved wall', () => {
    // given
    const state = mapOf(['#####', '##.##', '#####']);
    reserveTile(state, 2, 0, Reserve.Solid);

    // when
    const { shapes } = findStandIns(state, []);

    // then
    expect(shapes[0]?.exits).toHaveLength(3);
  });

  it('marks the rock that a piece encloses as a hole, and makes no exit of it', () => {
    // given
    const state = mapOf([
      '########',
      '#......#',
      '#.##...#',
      '#.##...#',
      '#......#',
      '########',
    ]);

    // when
    const { shapes, holes } = findStandIns(state, []);

    // then
    expect([...holes].flatMap((hole, at) => (hole ? [at] : []))).toEqual([
      2 * 8 + 2,
      2 * 8 + 3,
      3 * 8 + 2,
      3 * 8 + 3,
    ]);
    const shape = shapes[0];
    expect(
      shape?.exits.map(({ x, y }) => [shape.x + x, shape.y + y]),
    ).not.toContainEqual([2, 2]);
  });

  it('makes no hole of rock that a room is in, though floor rings it', () => {
    // given
    const state = mapOf([
      '#########',
      '#.......#',
      '#.#####.#',
      '#.#####.#',
      '#.#####.#',
      '#.......#',
      '#########',
    ]);
    reserveTile(state, 4, 3, Reserve.Solid);

    // when
    const { holes } = findStandIns(state, []);

    // then
    expect(holes.every((hole) => hole === 0)).toBe(true);
  });
});
