import { describe, expect, it } from 'vitest';
import { stampRoadBrush } from './stamp-road-brush';

function stamp(width: number, x = 5, y = 5, size = 11) {
  const covered = new Uint8Array(size * size);
  stampRoadBrush(covered, size, size, x, y, width);
  const rows: string[] = [];
  for (let row = 0; row < size; ++row) {
    rows.push(
      Array.from(covered.subarray(row * size, (row + 1) * size))
        .map((c) => (c ? '#' : '.'))
        .join(''),
    );
  }
  return rows;
}

describe('stampRoadBrush', () => {
  it('marks a single tile for a width of 1', () => {
    // given
    const width = 1;

    // when
    const rows = stamp(width);

    // then
    expect(rows.join('').split('#').length - 1).toBe(1);
    expect(rows[5]?.[5]).toBe('#');
  });

  it('marks a square around the tile for a width of 3', () => {
    // given
    const width = 3;

    // when
    const rows = stamp(width);

    // then
    expect(rows.slice(4, 7)).toEqual([
      '....###....',
      '....###....',
      '....###....',
    ]);
  });

  it('marks a 2 by 2 square for a width of 2', () => {
    // given
    const width = 2;

    // when
    const rows = stamp(width);

    // then
    expect(rows.join('').split('#').length - 1).toBe(4);
  });

  it('rounds the corners of wide roads', () => {
    // given
    const width = 5;

    // when
    const rows = stamp(width);

    // then
    expect(rows.slice(3, 8)).toEqual([
      '....###....',
      '...#####...',
      '...#####...',
      '...#####...',
      '....###....',
    ]);
  });

  it('skips tiles off the map', () => {
    // given
    const width = 3;

    // when
    const rows = stamp(width, 0, 0);

    // then
    expect(rows.join('').split('#').length - 1).toBe(4);
  });
});
