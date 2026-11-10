import { describe, expect, it } from 'vitest';
import { Tile } from '../core/tile';
import { emptyMap } from '../pipeline/empty-map';
import type { RoomTemplate } from '../rooms/templates/room-template';
import { TemplateCell } from '../rooms/templates/template-cell';
import { mulberry32 } from '../test-helpers/mulberry32';
import { placeCrypts } from './place-crypts';

const { Floor: F, Wall: W, Exit: E } = TemplateCell;

/** Three by three, never rotated, with its exit in the top wall. */
const closet: RoomTemplate = {
  name: 'closet',
  cells: [
    [W, E, W],
    [W, F, W],
    [W, W, W],
  ],
  rotate: [0],
};

const settings = {
  templates: [closet],
  templateSymmetry: false,
  doorChance: 1,
  symmetry: 'none' as const,
};

describe('placeCrypts', () => {
  it('keeps a crypt off the approaches it is given', () => {
    // given
    const seeds = Array.from({ length: 10 }, (_, i) => i + 1);
    const approaches = [
      { x: 2, y: 3 },
      { x: 6, y: 3 },
    ];

    // when
    const crypts = seeds.map((seed) => {
      // a ring of wall and a tile of spacing round it leave x 2, 3 or 4
      const state = emptyMap({ width: 9, height: 7, tile: Tile.Wall })();
      return placeCrypts(state, mulberry32(seed), settings, [], approaches);
    });

    // then
    expect(crypts.map(([crypt]) => crypt?.shape.x)).toEqual(seeds.map(() => 3));
  });
});
