import { describe, expect, it } from 'vitest';
import { sharpestTurn } from './sharpest-turn';
import { traceTiles } from './trace-tiles';

describe('sharpestTurn', () => {
  it('finds no turn on a straight line', () => {
    // given
    const tiles = traceTiles({ x: 0, y: 0 }, { x: 30, y: 10 });

    // when
    const turn = sharpestTurn(tiles);

    // then
    expect(turn).toBeLessThan(15);
  });

  it('finds a right angle at a corner', () => {
    // given
    const tiles = [
      ...traceTiles({ x: 0, y: 0 }, { x: 15, y: 0 }),
      ...traceTiles({ x: 15, y: 0 }, { x: 15, y: 15 }).slice(1),
    ];

    // when
    const turn = sharpestTurn(tiles);

    // then
    expect(turn).toBeGreaterThan(60);
  });

  it('finds no turn on a path too short to measure', () => {
    // given
    const tiles = traceTiles({ x: 0, y: 0 }, { x: 5, y: 0 });

    // when
    const turn = sharpestTurn(tiles);

    // then
    expect(turn).toBe(0);
  });
});
