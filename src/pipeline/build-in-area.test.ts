import { describe, expect, it } from 'vitest';
import { Tile } from '../core/tile';
import { buildInArea } from './build-in-area';
import { emptyMap } from './empty-map';
import { Reserve } from './reserve';
import { reserveTile } from './reserve-tile';
import { stampTile } from './stamp-tile';

/** Digs a plus of floor through the middle of whatever it is given and reserves its center. */
function dig(state: ReturnType<ReturnType<typeof emptyMap>>) {
  const { grid } = state;
  const cx = Math.floor(grid.width / 2);
  const cy = Math.floor(grid.height / 2);
  for (let x = 0; x < grid.width; ++x) {
    stampTile(state, x, cy, Tile.Floor);
  }
  for (let y = 0; y < grid.height; ++y) {
    stampTile(state, cx, y, Tile.Floor);
  }
  reserveTile(state, cx, cy, Reserve.Solid);
  return { cx, cy };
}

describe('buildInArea', () => {
  it('builds in coordinates of the box and copies the grid back', () => {
    // given
    const state = emptyMap({ width: 10, height: 8, tile: Tile.Wall })();

    // when
    buildInArea(state, { x: 2, y: 1, width: 5, height: 5 }, dig);

    // then
    expect(state.grid.toString().split('\n')).toEqual([
      '##########',
      '####.#####',
      '####.#####',
      '##.....###',
      '####.#####',
      '####.#####',
      '##########',
      '##########',
    ]);
  });

  it('copies the prunable and reserved masks back', () => {
    // given
    const state = emptyMap({ width: 10, height: 8, tile: Tile.Grass })();
    state.prunable.fill(1);

    // when
    buildInArea(state, { x: 2, y: 1, width: 5, height: 5 }, dig);

    // then
    expect(state.prunable[3 * 10 + 4]).toBe(0);
    expect(state.prunable[0]).toBe(1);
    expect(state.reserved[3 * 10 + 4]).toBe(Reserve.Solid);
    expect(state.reserved.reduce((sum, kind) => sum + kind, 0)).toBe(1);
  });

  it('shows the scratch state what the box holds', () => {
    // given
    const state = emptyMap({ width: 10, height: 8, tile: Tile.Wall })();
    state.grid.set(3, 2, Tile.Floor);
    reserveTile(state, 3, 2, Reserve.Openable);
    state.prunable[2 * 10 + 3] = 1;

    // when
    const seen = buildInArea(
      state,
      { x: 2, y: 1, width: 5, height: 5 },
      (s) => ({
        tile: s.grid.get(1, 1),
        reserved: s.reserved[1 * 5 + 1],
        prunable: s.prunable[1 * 5 + 1],
        base: s.base,
        width: s.grid.width,
      }),
    );

    // then
    expect(seen).toEqual({
      tile: Tile.Floor,
      reserved: Reserve.Openable,
      prunable: 1,
      base: Tile.Wall,
      width: 5,
    });
  });

  it('returns what build returned', () => {
    // given
    const state = emptyMap({ width: 10, height: 8, tile: Tile.Wall })();

    // when
    const result = buildInArea(
      state,
      { x: 0, y: 0, width: 3, height: 3 },
      () => 'done',
    );

    // then
    expect(result).toBe('done');
  });

  it('leaves the map as it was when build throws', () => {
    // given
    const state = emptyMap({ width: 10, height: 8, tile: Tile.Wall })();
    const before = state.grid.toString();

    // when
    const call = () =>
      buildInArea(state, { x: 2, y: 1, width: 5, height: 5 }, (scratch) => {
        dig(scratch);
        throw new Error('no');
      });

    // then
    expect(call).toThrow('no');
    expect(state.grid.toString()).toBe(before);
  });

  it('gives the same map for a whole-map box as building in place', () => {
    // given
    const inPlace = emptyMap({ width: 11, height: 9, tile: Tile.Wall })();
    const inBox = emptyMap({ width: 11, height: 9, tile: Tile.Wall })();

    // when
    dig(inPlace);
    buildInArea(inBox, { x: 0, y: 0, width: 11, height: 9 }, dig);

    // then
    expect(inBox.grid.toString()).toBe(inPlace.grid.toString());
    expect(inBox.reserved).toEqual(inPlace.reserved);
    expect(inBox.prunable).toEqual(inPlace.prunable);
  });
});
