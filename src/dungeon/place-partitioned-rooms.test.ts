import { describe, expect, it } from 'vitest';
import { Tile } from '../core/tile';
import { emptyMap } from '../pipeline/empty-map';
import type { MapState } from '../pipeline/map-state';
import { pipeline } from '../pipeline/pipeline';
import { stampTile } from '../pipeline/stamp-tile';
import { step } from '../pipeline/step';
import type { Room } from '../rooms/room';
import { overlap } from '../test-helpers/dungeon-checks';
import { mulberry32 } from '../test-helpers/mulberry32';
import { placePartitionedRooms } from './place-partitioned-rooms';
import type { PlacePartitionedRoomsOptions } from './place-partitioned-rooms-options';

function place(
  options: PlacePartitionedRoomsOptions = {},
  seed = 1,
  width = 61,
  height = 41,
) {
  return pipeline(
    emptyMap({ width, height, tile: Tile.Wall }),
    [placePartitionedRooms(options)],
    { random: mulberry32(seed) },
  );
}

describe('placePartitionedRooms', () => {
  it('marks every room as a room', () => {
    // given
    const options = {};

    // when
    const { rooms } = place(options);

    // then
    expect(rooms.length).toBeGreaterThan(1);
    expect(rooms.map(({ kind }) => kind)).toEqual(rooms.map(() => 'room'));
  });

  it('puts one room in every area it cuts, spaced as asked', () => {
    // given
    const options = { roomCount: { min: 12, max: 12 }, roomSpacing: 3 };

    // when
    const { rooms } = place(options);

    // then
    expect(rooms).toHaveLength(12);
    for (const [i, a] of rooms.entries()) {
      for (const b of rooms.slice(i + 1)) {
        expect(overlap(a, b, 3)).toBe(false);
      }
    }
  });

  it('centers a room in its area at full spacing uniformity', () => {
    // given
    const options = {
      spacingUniformity: 1,
      sizeUniformity: 1,
      roomCount: { min: 1, max: 1 },
    };

    // when
    const { rooms } = place(options);

    // then
    const [room] = rooms as [Room];
    expect(Math.abs(room.x + room.width / 2 - 30.5)).toBeLessThanOrEqual(1);
    expect(Math.abs(room.y + room.height / 2 - 20.5)).toBeLessThanOrEqual(1);
  });

  it('gives up on more areas when the map is full', () => {
    // given
    const options = { roomCount: { min: 50, max: 50 } };

    // when
    const { rooms } = place(options, 1, 20, 20);

    // then
    expect(rooms.length).toBeLessThan(50);
  });

  it('leaves out the rooms of the parts that an earlier step took', () => {
    // given
    const block = step('carveBlock', {}, (state: MapState) => {
      for (let y = 1; y < 40; ++y) {
        for (let x = 1; x < 30; ++x) {
          stampTile(state, x, y, Tile.Floor);
        }
      }
      return {};
    });

    // when
    const { rooms } = pipeline(
      emptyMap({ width: 61, height: 41, tile: Tile.Wall }),
      [block, placePartitionedRooms({ roomCount: { min: 8, max: 8 } })],
      { random: mulberry32(1) },
    );

    // then
    expect(place({ roomCount: { min: 8, max: 8 } }).rooms).toHaveLength(8);
    expect(rooms.length).toBeGreaterThan(0);
    expect(rooms.length).toBeLessThan(8);
    expect(rooms.every((room) => room.x >= 32)).toBe(true);
  });
});
