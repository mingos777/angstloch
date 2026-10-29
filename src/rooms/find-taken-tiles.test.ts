import { describe, expect, it } from 'vitest';
import { Tile } from '../core/tile';
import { emptyMap } from '../pipeline/empty-map';
import { Reserve } from '../pipeline/reserve';
import { reserveTile } from '../pipeline/reserve-tile';
import { createRoomShape } from './create-room-shape';
import { findTakenTiles } from './find-taken-tiles';
import { findTemplateExits } from './templates/find-template-exits';
import { TemplateCell } from './templates/template-cell';
import type { TemplatePlacement } from './templates/template-placement';

const { Floor: F, Wall: W, Exit: E } = TemplateCell;

function wallMap() {
  return emptyMap({ width: 10, height: 8, tile: Tile.Wall })();
}

/** A closet at (3, 3) with its exit in the top wall, at (4, 3). */
function closet(): TemplatePlacement {
  const cells = [
    [W, E, W],
    [W, F, W],
    [W, W, W],
  ];
  return {
    x: 3,
    y: 3,
    width: 3,
    height: 3,
    cells,
    exits: findTemplateExits(cells),
    rotation: 0,
    mirrored: false,
  };
}

describe('findTakenTiles', () => {
  it('finds nothing on an untouched map', () => {
    // given
    const state = wallMap();

    // when
    const taken = findTakenTiles(state, []);

    // then
    expect(taken).toBeUndefined();
  });

  it('takes floor and reserved tiles', () => {
    // given
    const state = wallMap();
    state.grid.set(1, 1, Tile.Floor);
    reserveTile(state, 2, 2, Reserve.Openable);

    // when
    const taken = findTakenTiles(state, []);

    // then
    expect([taken?.[1 * 10 + 1], taken?.[2 * 10 + 2], taken?.[0]]).toEqual([
      1, 1, 0,
    ]);
  });

  it('takes the tile in front of a fixed exit that is still openable', () => {
    // given
    const state = wallMap();
    reserveTile(state, 4, 3, Reserve.Openable);

    // when
    const taken = findTakenTiles(state, [closet()]);

    // then
    expect(taken?.[2 * 10 + 4]).toBe(1);
  });

  it('leaves the tile in front of an opened exit alone', () => {
    // given
    const state = wallMap();
    reserveTile(state, 4, 3, Reserve.Solid);

    // when
    const taken = findTakenTiles(state, [closet()]);

    // then
    expect(taken?.[2 * 10 + 4]).toBe(0);
  });

  it('ignores the optional exits of an ordinary room', () => {
    // given
    const state = wallMap();
    reserveTile(state, 4, 3, Reserve.Openable);
    const shape = createRoomShape({ x: 4, y: 4, width: 2, height: 2 });

    // when
    const taken = findTakenTiles(state, [shape]);

    // then
    expect(taken?.[2 * 10 + 4]).toBe(0);
  });
});
