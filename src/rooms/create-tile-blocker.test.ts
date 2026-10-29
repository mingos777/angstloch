import { describe, expect, it } from 'vitest';
import { createTileBlocker } from './create-tile-blocker';

/** A 10 by 8 map with one taken tile at (5, 4). */
function oneTaken() {
  const taken = new Uint8Array(10 * 8);
  taken[4 * 10 + 5] = 1;
  return taken;
}

describe('createTileBlocker', () => {
  it('blocks a room whose floor covers a taken tile', () => {
    // given
    const isBlocked = createTileBlocker(oneTaken(), 10, 8, 1);

    // when
    const blocked = isBlocked({ x: 4, y: 3, width: 3, height: 3 });

    // then
    expect(blocked).toBe(true);
  });

  it('blocks a room within the spacing of a taken tile', () => {
    // given
    const isBlocked = createTileBlocker(oneTaken(), 10, 8, 2);

    // when
    const blocked = isBlocked({ x: 1, y: 1, width: 3, height: 2 });

    // then
    expect(blocked).toBe(true);
  });

  it('lets a room just beyond the spacing be', () => {
    // given
    const isBlocked = createTileBlocker(oneTaken(), 10, 8, 1);

    // when
    const blocked = isBlocked({ x: 1, y: 1, width: 3, height: 2 });

    // then
    expect(blocked).toBe(false);
  });

  it('clips the spacing at the edge of the map', () => {
    // given
    const isBlocked = createTileBlocker(oneTaken(), 10, 8, 3);

    // when
    const blocked = isBlocked({ x: 0, y: 0, width: 1, height: 1 });

    // then
    expect(blocked).toBe(false);
  });
});
