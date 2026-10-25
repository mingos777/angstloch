import { describe, expect, it } from 'vitest';
import { findMazeStart } from './find-maze-start';

describe('findMazeStart', () => {
  it('returns the middle cell of the map', () => {
    // given
    const isBlocked = () => false;

    // when
    const start = findMazeStart(21, 11, isBlocked);

    // then
    expect(start).toEqual({ x: 11, y: 5 });
  });

  it('returns the nearest free cell when the middle is blocked', () => {
    // given
    const isBlocked = (x: number, y: number) => x === 11 && y === 5;

    // when
    const start = findMazeStart(21, 11, isBlocked);

    // then
    expect(Math.abs(start.x - 11) + Math.abs(start.y - 5)).toBe(2);
  });
});
