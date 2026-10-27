import { describe, expect, it } from 'vitest';
import type { Point } from '../core/point';
import { mulberry32 } from '../test-helpers/mulberry32';
import { buildForest } from './build-forest';
import type { ForestOptions } from './forest-options';
import { generateForest } from './generate-forest';

const OPTIONS: ForestOptions = {
  width: 80,
  height: 50,
  roads: { crossings: { min: 1, max: 1 }, branches: { min: 1, max: 1 } },
  streams: { width: { min: 3, max: 3 } },
};

describe('buildForest', () => {
  it('builds the same forest as generateForest', () => {
    // given
    const options = { ...OPTIONS, random: mulberry32(6) };

    // when
    const built = buildForest(options, { grown: () => undefined });

    // then
    const generated = generateForest({ ...OPTIONS, random: mulberry32(6) });
    expect(built.grid.toString()).toBe(generated.grid.toString());
  });

  it('reports every generated road as it was grown', () => {
    // given
    const grown: Point[][] = [];

    // when
    const { roads } = buildForest(
      { ...OPTIONS, random: mulberry32(6) },
      { grown: (points) => grown.push(points) },
    );

    // then
    expect(grown).toHaveLength(roads.length);
  });

  it('reports a road as laid when no stream bends it', () => {
    // given
    const grown: Point[][] = [];
    const options = { ...OPTIONS, streams: undefined, random: mulberry32(6) };

    // when
    const { roads } = buildForest(options, {
      grown: (points) => grown.push(points),
    });

    // then
    expect(grown).toEqual(roads.map(({ points }) => points));
  });

  it('reports the main road before a stream bends it', () => {
    // given
    const grown: Point[][] = [];

    // when
    const { roads } = buildForest(
      { ...OPTIONS, random: mulberry32(6) },
      { grown: (points) => grown.push(points) },
    );

    // then
    expect(grown[0]).not.toEqual(roads[0]?.points);
  });
});
