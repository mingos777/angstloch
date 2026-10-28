import { describe, expect, it } from 'vitest';
import { Tile } from '../core/tile';
import { emptyMap } from '../pipeline/empty-map';
import { pipeline } from '../pipeline/pipeline';
import type { Room } from '../rooms/room';
import { overlap, SEEDS } from '../test-helpers/dungeon-checks';
import { mulberry32 } from '../test-helpers/mulberry32';
import { scatterRooms } from './scatter-rooms';
import type { ScatterRoomsOptions } from './scatter-rooms-options';

function place(options: ScatterRoomsOptions = {}, seed = 1) {
  return pipeline(
    emptyMap({ width: 61, height: 41, tile: Tile.Wall }),
    [scatterRooms(options)],
    { random: mulberry32(seed) },
  );
}

/** The mean spread of the distances from each room to its nearest neighbor, relative to their mean. */
function unevenness(options: ScatterRoomsOptions) {
  const values = SEEDS.map((seed) => {
    const centers = place(options, seed).rooms.map((r) => ({
      x: r.x + r.width / 2,
      y: r.y + r.height / 2,
    }));
    const distances = centers.map((a, i) =>
      Math.min(
        ...centers
          .filter((_, j) => j !== i)
          .map((b) => Math.hypot(a.x - b.x, a.y - b.y)),
      ),
    );
    const mean = distances.reduce((a, b) => a + b, 0) / distances.length;
    const variance =
      distances.reduce((sum, d) => sum + (d - mean) ** 2, 0) / distances.length;
    return Math.sqrt(variance) / mean;
  });
  return values.reduce((a, b) => a + b, 0) / values.length;
}

describe('scatterRooms', () => {
  it('puts rooms right next to each other by default', () => {
    // given
    const options = { fill: 0.12 };

    // when
    const results = SEEDS.map((seed) => place(options, seed).rooms);

    // then
    const close = results.some((rooms) =>
      rooms.some((a) =>
        rooms.some((b) => a !== b && overlap(a, b, 2) && !overlap(a, b, 1)),
      ),
    );
    expect(close).toBe(true);
  });

  it('keeps placing rooms up to the minimum even when fill is met', () => {
    // given
    const options = { roomCount: { min: 5, max: 10 }, fill: 0.001 };

    // when
    const { rooms } = place(options);

    // then
    expect(rooms).toHaveLength(5);
  });

  it('stops at the fill target once the minimum is met', () => {
    // given
    const options = { roomCount: { min: 1, max: 100 }, fill: 0.05 };

    // when
    const { rooms } = place(options);

    // then
    expect(rooms.length).toBeLessThan(10);
  });

  it('places fewer rooms than requested when the map is full', () => {
    // given
    const options = { roomCount: { min: 500, max: 500 } };

    // when
    const { rooms } = place(options);

    // then
    expect(rooms.length).toBeLessThan(500);
  });

  it('varies room sizes without size uniformity', () => {
    // given
    const options = { fill: 0.3 };

    // when
    const { rooms } = place(options);

    // then
    expect(new Set(rooms.map((r: Room) => r.width)).size).toBeGreaterThan(3);
  });

  it('spreads rooms more evenly with a higher spacing uniformity', () => {
    // given
    const loose = unevenness({ spacingUniformity: 0 });

    // when
    const even = unevenness({ spacingUniformity: 1 });

    // then
    expect(even).toBeLessThan(loose);
  });
});
