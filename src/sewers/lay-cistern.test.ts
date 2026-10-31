import { describe, expect, it } from 'vitest';
import { Tile } from '../core/tile';
import { emptyMap } from '../pipeline/empty-map';
import type { MapState } from '../pipeline/map-state';
import { mulberry32 } from '../test-helpers/mulberry32';
import { layCistern } from './lay-cistern';

const BOX = { x: 1, y: 1, width: 11, height: 9 };

/** A wall map with the box of a cistern as floor and a canal two tiles wide running through it from left to right, rows 2 and 3. */
function cisternBox(): MapState {
  const state = emptyMap({ width: 13, height: 11, tile: Tile.Wall })();
  for (let y = BOX.y; y < BOX.y + BOX.height; ++y) {
    for (let x = BOX.x; x < BOX.x + BOX.width; ++x) {
      state.grid.set(x, y, Tile.Floor);
    }
  }
  for (let x = 0; x < 13; ++x) {
    state.grid.set(x, 2, Tile.ShallowWater);
    state.grid.set(x, 3, Tile.ShallowWater);
  }
  return state;
}

describe('layCistern', () => {
  it('fills the basin with water, keeps the ledges and bridges the canal where it crosses one', () => {
    // given
    const state = cisternBox();

    // when
    layCistern(state, mulberry32(1), BOX, ['top', 'left', 'bottom'], {
      chance: 0,
      spacing: { min: 2, max: 2 },
    });

    // then
    const { grid } = state;
    for (let y = BOX.y; y < BOX.y + BOX.height; ++y) {
      for (let x = BOX.x; x < BOX.x + BOX.width; ++x) {
        const ledge =
          y === BOX.y || x === BOX.x || y === BOX.y + BOX.height - 1;
        const canal = y === 2 || y === 3;
        expect(grid.get(x, y)).toBe(
          ledge ? (canal ? Tile.Bridge : Tile.Floor) : Tile.ShallowWater,
        );
      }
    }
  });

  it('stands columns in the basin, a tile clear of its edge and of the canal', () => {
    // given
    const state = cisternBox();

    // when
    layCistern(state, mulberry32(1), BOX, ['top', 'bottom'], {
      chance: 1,
      spacing: { min: 1, max: 1 },
    });

    // then
    const columns: { x: number; y: number }[] = [];
    for (let y = BOX.y; y < BOX.y + BOX.height; ++y) {
      for (let x = BOX.x; x < BOX.x + BOX.width; ++x) {
        if (state.grid.get(x, y) === Tile.Wall) {
          columns.push({ x, y });
        }
      }
    }
    expect(columns.length).toBeGreaterThan(0);
    for (const { x, y } of columns) {
      expect(x).toBeGreaterThan(BOX.x);
      expect(x).toBeLessThan(BOX.x + BOX.width - 1);
      expect(y).toBeGreaterThan(4);
      expect(y).toBeLessThan(BOX.y + BOX.height - 2);
    }
  });
});
