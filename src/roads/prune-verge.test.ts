import { describe, expect, it } from 'vitest';
import { Tile } from '../core/tile';
import { emptyMap } from '../pipeline/empty-map';
import { mulberry32 } from '../test-helpers/mulberry32';
import { pruneVerge } from './prune-verge';

/** A 11 x 1 strip full of trees, with a feature at x = 0. */
function strip() {
  const state = emptyMap({ width: 11, height: 1, tile: Tile.Grass })();
  for (let x = 1; x < 11; ++x) {
    state.grid.set(x, 0, Tile.Tree);
    state.prunable[x] = 1;
  }
  const mask = new Uint8Array(11);
  mask[0] = 1;
  return { state, mask };
}

const trees = (state: { grid: { get(x: number, y: number): Tile } }) =>
  Array.from({ length: 11 }, (_, x) => state.grid.get(x, 0) === Tile.Tree);

describe('pruneVerge', () => {
  it('removes the trees within the clearance, and only those', () => {
    // given
    const { state, mask } = strip();

    // when
    pruneVerge(state, mask, { clearance: 3 }, () => 0.5);

    // then
    expect(trees(state)).toEqual([
      false,
      false,
      false,
      false,
      true,
      true,
      true,
      true,
      true,
      true,
      true,
    ]);
  });

  it('sets the removed trees back to the base tile', () => {
    // given
    const { state, mask } = strip();

    // when
    pruneVerge(state, mask, { clearance: 2 }, () => 0.5);

    // then
    expect(state.grid.get(1, 0)).toBe(Tile.Grass);
    expect(state.grid.get(2, 0)).toBe(Tile.Grass);
  });

  it('clears the prunable byte of what it removes and keeps the others', () => {
    // given
    const { state, mask } = strip();

    // when
    pruneVerge(state, mask, { clearance: 2 }, () => 0.5);

    // then
    expect(Array.from(state.prunable)).toEqual([
      0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1,
    ]);
  });

  it('leaves tiles that are not prunable alone', () => {
    // given
    const { state, mask } = strip();
    state.grid.set(1, 0, Tile.Floor);
    state.prunable[1] = 0;

    // when
    pruneVerge(state, mask, { clearance: 3 }, () => 0.5);

    // then
    expect(state.grid.get(1, 0)).toBe(Tile.Floor);
  });

  it('keeps a tile in the falloff when the draw is below its chance', () => {
    // given: with a falloff of 3 the first tile past the clearance keeps 1/4
    const { state, mask } = strip();

    // when
    pruneVerge(state, mask, { falloff: 3 }, () => 0.2);

    // then
    expect(trees(state).slice(1, 5)).toEqual([true, true, true, true]);
  });

  it('removes a tile in the falloff when the draw is at its chance', () => {
    // given
    const { state, mask } = strip();

    // when
    pruneVerge(state, mask, { falloff: 3 }, () => 0.25);

    // then
    expect(trees(state).slice(1, 5)).toEqual([false, true, true, true]);
  });

  it('thins the falloff in equal steps', () => {
    // given: many strips, so that the share of trees kept shows the chance
    const random = mulberry32(1);
    const kept = [0, 0, 0, 0];
    const runs = 4000;

    // when
    for (let run = 0; run < runs; ++run) {
      const { state, mask } = strip();
      pruneVerge(state, mask, { falloff: 3 }, random);
      for (let x = 0; x < 4; ++x) {
        kept[x] =
          (kept[x] ?? 0) + (state.grid.get(x + 1, 0) === Tile.Tree ? 1 : 0);
      }
    }

    // then
    const shares = kept.map((count) => Math.round((count / runs) * 4) / 4);
    expect(shares).toEqual([0.25, 0.5, 0.75, 1]);
  });

  it('draws nothing for tiles in the clearance or beyond the falloff', () => {
    // given
    const { state, mask } = strip();
    let draws = 0;

    // when
    pruneVerge(state, mask, { clearance: 2, falloff: 1 }, () => {
      ++draws;
      return 0;
    });

    // then
    expect(draws).toBe(1);
  });

  it('measures with the given distance', () => {
    // given: a feature in the middle of a field of trees
    const state = emptyMap({ width: 5, height: 5, tile: Tile.Grass })();
    state.grid.set(2, 2, Tile.Road);
    state.prunable.fill(1);
    state.prunable[12] = 0;
    const mask = new Uint8Array(25);
    mask[12] = 1;

    // when
    pruneVerge(state, mask, { clearance: 1, distance: 'manhattan' }, () => 0.5);

    // then
    expect(state.prunable.reduce((sum, byte) => sum + byte, 0)).toBe(20);
    expect(state.prunable[6]).toBe(1);
  });
});
