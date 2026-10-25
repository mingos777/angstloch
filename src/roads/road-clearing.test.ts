import { describe, expect, it } from 'vitest';
import { roadClearing } from './road-clearing';

function covering(width: number, height: number, tiles: [number, number][]) {
  const covered = new Uint8Array(width * height);
  for (const [x, y] of tiles) {
    covered[y * width + x] = 1;
  }
  return covered;
}

function picture(cleared: Uint8Array, width: number) {
  const rows: string[] = [];
  for (let at = 0; at < cleared.length; at += width) {
    rows.push(
      Array.from(cleared.subarray(at, at + width))
        .map((c) => (c ? '#' : '.'))
        .join(''),
    );
  }
  return rows;
}

describe('roadClearing', () => {
  it('clears the tile of the road itself', () => {
    // given
    const covered = covering(7, 7, [[3, 3]]);

    // when
    const cleared = roadClearing(covered, 7, 7, 0);

    // then
    expect(picture(cleared, 7).join('').split('#').length - 1).toBe(1);
    expect(cleared[3 * 7 + 3]).toBe(1);
  });

  it('clears all eight neighbors with a clearance of 1', () => {
    // given
    const covered = covering(7, 7, [[3, 3]]);

    // when
    const cleared = roadClearing(covered, 7, 7, 1);

    // then
    expect(picture(cleared, 7).slice(1, 6)).toEqual([
      '.......',
      '..###..',
      '..###..',
      '..###..',
      '.......',
    ]);
  });

  it('clears a square of the clearance around the road', () => {
    // given
    const covered = covering(9, 9, [[4, 4]]);

    // when
    const cleared = roadClearing(covered, 9, 9, 2);

    // then
    expect(picture(cleared, 9)).toEqual([
      '.........',
      '.........',
      '..#####..',
      '..#####..',
      '..#####..',
      '..#####..',
      '..#####..',
      '.........',
      '.........',
    ]);
  });

  it('clears around every tile of the road', () => {
    // given
    const covered = covering(11, 3, [
      [1, 1],
      [2, 1],
      [3, 1],
    ]);

    // when
    const cleared = roadClearing(covered, 11, 3, 1);

    // then
    expect(picture(cleared, 11)).toEqual([
      '#####......',
      '#####......',
      '#####......',
    ]);
  });

  it('clears around separate roads', () => {
    // given
    const covered = covering(11, 1, [
      [1, 0],
      [8, 0],
    ]);

    // when
    const cleared = roadClearing(covered, 11, 1, 1);

    // then
    expect(picture(cleared, 11)).toEqual(['###....###.']);
  });

  it('stays on the map at its edges', () => {
    // given
    const covered = covering(5, 5, [[0, 0]]);

    // when
    const cleared = roadClearing(covered, 5, 5, 2);

    // then
    expect(picture(cleared, 5)).toEqual([
      '###..',
      '###..',
      '###..',
      '.....',
      '.....',
    ]);
  });

  it('clears nothing without a road', () => {
    // given
    const covered = new Uint8Array(25);

    // when
    const cleared = roadClearing(covered, 5, 5, 3);

    // then
    expect(cleared.every((c) => c === 0)).toBe(true);
  });
});
