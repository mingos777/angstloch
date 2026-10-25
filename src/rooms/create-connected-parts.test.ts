import { describe, expect, it } from 'vitest';
import { createConnectedParts } from './create-connected-parts';
import { Grid } from '../core/grid';
import { Tile } from '../core/tile';

/** Two floor tiles with a wall between them, and a door beyond that. */
function split() {
  const grid = new Grid(5, 1);
  grid.set(0, 0, Tile.Floor);
  grid.set(2, 0, Tile.Floor);
  grid.set(3, 0, Tile.Door);
  return grid;
}

describe('createConnectedParts', () => {
  it('puts touching floor and door tiles in one part', () => {
    // given
    const parts = createConnectedParts(split());

    // when
    const connected = parts.connected({ x: 2, y: 0 }, { x: 3, y: 0 });

    // then
    expect(connected).toBe(true);
  });

  it('keeps tiles apart that a wall separates', () => {
    // given
    const parts = createConnectedParts(split());

    // when
    const connected = parts.connected({ x: 0, y: 0 }, { x: 2, y: 0 });

    // then
    expect(connected).toBe(false);
  });

  it('merges two parts when they are joined', () => {
    // given
    const parts = createConnectedParts(split());

    // when
    parts.join({ x: 0, y: 0 }, { x: 3, y: 0 });

    // then
    expect(parts.connected({ x: 0, y: 0 }, { x: 2, y: 0 })).toBe(true);
  });
});
