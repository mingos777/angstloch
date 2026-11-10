import { describe, expect, it } from 'vitest';
import { Tile } from '../core/tile';
import { emptyMap } from '../pipeline/empty-map';
import { Reserve } from '../pipeline/reserve';
import { reserveTile } from '../pipeline/reserve-tile';
import type { CellBlockGroup } from './cell-block-group';
import type { CaveGroup } from './cave-group';
import { findBlockApproaches } from './find-block-approaches';

/** A wall map with a corridor from (3, 4) to (7, 4), entered at (2, 4). */
function blockMap(entrance: Reserve = Reserve.Openable) {
  const state = emptyMap({ width: 10, height: 8, tile: Tile.Wall })();
  for (let x = 3; x <= 7; ++x) {
    state.grid.set(x, 4, Tile.Floor);
  }
  reserveTile(state, 2, 4, entrance);
  return state;
}

const block: CellBlockGroup = {
  kind: 'cellBlock',
  footprint: { x: 2, y: 3, width: 7, height: 3 },
  corridor: { x: 3, y: 4, width: 5, height: 1 },
  entrance: { x: 2, y: 4 },
};

describe('findBlockApproaches', () => {
  it('finds the tile in front of an unopened entrance, away from the block', () => {
    // given
    const state = blockMap();

    // when
    const approaches = findBlockApproaches(state, [block]);

    // then
    expect(approaches).toEqual([{ x: 1, y: 4 }]);
  });

  it('finds nothing in front of an opened entrance', () => {
    // given
    const state = blockMap(Reserve.Solid);

    // when
    const approaches = findBlockApproaches(state, [block]);

    // then
    expect(approaches).toEqual([]);
  });

  it('finds nothing when open ground lies on both sides of the entrance', () => {
    // given
    const state = blockMap();
    state.grid.set(1, 4, Tile.Floor);

    // when
    const approaches = findBlockApproaches(state, [block]);

    // then
    expect(approaches).toEqual([]);
  });

  it('ignores groups that are not cell blocks', () => {
    // given
    const state = blockMap();
    const cave: CaveGroup = {
      kind: 'cave',
      area: { x: 0, y: 0, width: 10, height: 8 },
    };

    // when
    const approaches = findBlockApproaches(state, [cave]);

    // then
    expect(approaches).toEqual([]);
  });
});
