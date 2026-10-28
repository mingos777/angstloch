import { describe, expect, it } from 'vitest';
import { Tile } from '../core/tile';
import { emptyMap } from './empty-map';

describe('emptyMap', () => {
  it('makes a grid of the tile with nothing prunable', () => {
    // given
    const base = emptyMap({ width: 4, height: 3, tile: Tile.Grass });

    // when
    const state = base();

    // then
    expect(state.grid.width).toBe(4);
    expect(state.grid.height).toBe(3);
    expect(state.grid.toString()).toBe('""""\n""""\n""""');
    expect(state.base).toBe(Tile.Grass);
    expect(state.prunable).toEqual(new Uint8Array(12));
  });

  it('makes a new state on every call', () => {
    // given
    const base = emptyMap({ width: 2, height: 2, tile: Tile.Wall });
    const first = base();

    // when
    first.grid.set(0, 0, Tile.Floor);
    const second = base();

    // then
    expect(second.grid.get(0, 0)).toBe(Tile.Wall);
  });

  it('throws a RangeError for bad dimensions at once', () => {
    // given
    const options = { width: 0, height: 3, tile: Tile.Wall };

    // when
    const call = () => emptyMap(options);

    // then
    expect(call).toThrow(RangeError);
  });

  it('throws a RangeError for a value that is not a tile', () => {
    // given
    const options = { width: 3, height: 3, tile: 99 as Tile };

    // when
    const call = () => emptyMap(options);

    // then
    expect(call).toThrow(RangeError);
  });
});
