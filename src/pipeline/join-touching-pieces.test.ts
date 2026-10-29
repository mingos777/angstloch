import { describe, expect, it } from 'vitest';
import { Tile } from '../core/tile';
import { emptyMap } from './empty-map';
import { joinTouchingPieces } from './join-touching-pieces';
import type { MapState } from './map-state';
import { Reserve } from './reserve';

/** A wall map from rows of `.` for floor, `o` for an openable wall and `#` for wall. */
function mapOf(...rows: string[]): MapState {
  const state = emptyMap({
    width: rows[0]?.length ?? 0,
    height: rows.length,
    tile: Tile.Wall,
  })();
  rows.forEach((row, y) => {
    row.split('').forEach((char, x) => {
      if (char === '.') {
        state.grid.set(x, y, Tile.Floor);
      } else if (char === 'o') {
        state.reserved[y * state.grid.width + x] = Reserve.Openable;
      }
    });
  });
  return state;
}

describe('joinTouchingPieces', () => {
  it('opens an openable wall between two pieces as floor', () => {
    // given
    const state = mapOf('#####', '#.o.#', '#####');

    // when
    const opened = joinTouchingPieces(state);

    // then
    expect(opened).toEqual([{ x: 2, y: 1 }]);
    expect(state.grid.get(2, 1)).toBe(Tile.Floor);
  });

  it('opens it through openReserved', () => {
    // given
    const state = mapOf('#####', '#.o.#', '#####');

    // when
    joinTouchingPieces(state);

    // then
    expect(state.reserved[1 * 5 + 2]).toBe(Reserve.Solid);
  });

  it('opens no second wall between pieces it joined already', () => {
    // given
    const state = mapOf('#####', '#.o.#', '#.#.#', '#.o.#', '#####');

    // when
    const opened = joinTouchingPieces(state);

    // then
    expect(opened).toEqual([{ x: 2, y: 1 }]);
    expect(state.grid.get(2, 3)).toBe(Tile.Wall);
  });

  it('leaves an openable wall with one piece round it', () => {
    // given
    const state = mapOf('#####', '#...#', '#.o.#', '#####');

    // when
    const opened = joinTouchingPieces(state);

    // then
    expect(opened).toEqual([]);
  });

  it('leaves a wall that is not openable', () => {
    // given
    const state = mapOf('#####', '#.#.#', '#####');

    // when
    const opened = joinTouchingPieces(state);

    // then
    expect(opened).toEqual([]);
  });

  it('leaves the tiles that skip marks', () => {
    // given
    const state = mapOf('#####', '#.o.#', '#####');
    const skip = new Uint8Array(15);
    skip[1 * 5 + 2] = 1;

    // when
    const opened = joinTouchingPieces(state, skip);

    // then
    expect(opened).toEqual([]);
  });
});
