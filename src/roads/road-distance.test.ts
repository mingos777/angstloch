import { describe, expect, it } from 'vitest';
import { roadDistance } from './road-distance';

function covering(width: number, height: number, tiles: [number, number][]) {
  const covered = new Uint8Array(width * height);
  for (const [x, y] of tiles) {
    covered[y * width + x] = 1;
  }
  return covered;
}

/** One row of text per map row, the distance rounded to one decimal. */
function rows(distances: Float32Array, width: number) {
  const lines: string[][] = [];
  for (let at = 0; at < distances.length; at += width) {
    lines.push(
      Array.from(distances.subarray(at, at + width)).map((d) =>
        Number.isFinite(d) ? d.toFixed(1) : '-',
      ),
    );
  }
  return lines.map((line) => line.join(' '));
}

describe('roadDistance', () => {
  it('is 0 on the road itself', () => {
    // given
    const covered = covering(5, 5, [[2, 2]]);

    // when
    const distances = roadDistance(covered, 5, 5, 'chebyshev', 2);

    // then
    expect(distances[2 * 5 + 2]).toBe(0);
  });

  it('counts a diagonal step as one tile with chebyshev', () => {
    // given
    const covered = covering(5, 5, [[2, 2]]);

    // when
    const distances = roadDistance(covered, 5, 5, 'chebyshev', 2);

    // then
    expect(rows(distances, 5)).toEqual([
      '2.0 2.0 2.0 2.0 2.0',
      '2.0 1.0 1.0 1.0 2.0',
      '2.0 1.0 0.0 1.0 2.0',
      '2.0 1.0 1.0 1.0 2.0',
      '2.0 2.0 2.0 2.0 2.0',
    ]);
  });

  it('counts a diagonal step as two tiles with manhattan', () => {
    // given
    const covered = covering(5, 5, [[2, 2]]);

    // when
    const distances = roadDistance(covered, 5, 5, 'manhattan', 2);

    // then
    expect(rows(distances, 5)).toEqual([
      '4.0 3.0 2.0 3.0 4.0',
      '3.0 2.0 1.0 2.0 3.0',
      '2.0 1.0 0.0 1.0 2.0',
      '3.0 2.0 1.0 2.0 3.0',
      '4.0 3.0 2.0 3.0 4.0',
    ]);
  });

  it('counts a diagonal step as the square root of 2 with euclidean', () => {
    // given
    const covered = covering(5, 5, [[2, 2]]);

    // when
    const distances = roadDistance(covered, 5, 5, 'euclidean', 2);

    // then
    expect(rows(distances, 5)).toEqual([
      '2.8 2.2 2.0 2.2 2.8',
      '2.2 1.4 1.0 1.4 2.2',
      '2.0 1.0 0.0 1.0 2.0',
      '2.2 1.4 1.0 1.4 2.2',
      '2.8 2.2 2.0 2.2 2.8',
    ]);
  });

  it('takes the nearest of several road tiles', () => {
    // given
    const covered = covering(9, 1, [
      [0, 0],
      [8, 0],
    ]);

    // when
    const distances = roadDistance(covered, 9, 1, 'chebyshev', 4);

    // then
    expect(rows(distances, 9)).toEqual(['0.0 1.0 2.0 3.0 4.0 3.0 2.0 1.0 0.0']);
  });

  it('leaves tiles out of reach at infinity', () => {
    // given
    const covered = covering(9, 1, [[0, 0]]);

    // when
    const distances = roadDistance(covered, 9, 1, 'chebyshev', 2);

    // then
    expect(rows(distances, 9)).toEqual(['0.0 1.0 2.0 - - - - - -']);
  });

  it('stays on the map at its edges', () => {
    // given
    const covered = covering(4, 4, [[0, 0]]);

    // when
    const distances = roadDistance(covered, 4, 4, 'chebyshev', 1);

    // then
    expect(rows(distances, 4)).toEqual([
      '0.0 1.0 - -',
      '1.0 1.0 - -',
      '- - - -',
      '- - - -',
    ]);
  });

  it('measures nothing without a road', () => {
    // given
    const covered = new Uint8Array(25);

    // when
    const distances = roadDistance(covered, 5, 5, 'euclidean', 3);

    // then
    expect(distances.every((d) => d === Infinity)).toBe(true);
  });
});
