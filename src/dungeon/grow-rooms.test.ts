import { describe, expect, it } from 'vitest';
import { Tile } from '../core/tile';
import { emptyMap } from '../pipeline/empty-map';
import { pipeline } from '../pipeline/pipeline';
import type { MapState } from '../pipeline/map-state';
import type { AnyStep } from '../pipeline/pipeline-chain';
import { stampTile } from '../pipeline/stamp-tile';
import { step } from '../pipeline/step';
import type { Room } from '../rooms/room';
import type { RoomTemplate } from '../rooms/templates/room-template';
import { TemplateCell } from '../rooms/templates/template-cell';
import { SEEDS } from '../test-helpers/dungeon-checks';
import { mulberry32 } from '../test-helpers/mulberry32';
import { growRooms } from './grow-rooms';
import type { PlacedRooms } from './placed-rooms';
import type { GrowRoomsOptions } from './grow-rooms-options';
import { scatterRooms } from './scatter-rooms';

const { Floor: F, Wall: W, Exit: E } = TemplateCell;

/** Five by five, with its exit in the top wall. */
const hall: RoomTemplate = {
  name: 'hall',
  cells: [
    [W, W, E, W, W],
    [W, F, F, F, W],
    [W, F, F, F, W],
    [W, F, F, F, W],
    [W, W, W, W, W],
  ],
};

/** Runs the steps on a wall map; the last one places rooms. */
function run(steps: AnyStep[], seed = 1, width = 61, height = 41) {
  const result = pipeline(emptyMap({ width, height, tile: Tile.Wall }), steps, {
    random: mulberry32(seed),
  });
  return result as typeof result & PlacedRooms;
}

function grow(options: GrowRoomsOptions = {}, seed = 1) {
  return run([growRooms(options)], seed);
}

/**
 * The tiles between the floors of two rooms that face each other across their
 * left and right walls (or with `vertical`, their top and bottom walls), so
 * that a straight corridor could join them, or `undefined`.
 */
function facing(a: Room, b: Room, vertical: boolean): number | undefined {
  const [start, size, sideStart, sideSize] = vertical
    ? (['y', 'height', 'x', 'width'] as const)
    : (['x', 'width', 'y', 'height'] as const);
  return a[sideStart] < b[sideStart] + b[sideSize] &&
    b[sideStart] < a[sideStart] + a[sideSize]
    ? Math.max(b[start] - (a[start] + a[size]), a[start] - (b[start] + b[size]))
    : undefined;
}

/** Whether each room after the first faces an earlier one at one of the distances, across the walls of `sides`. */
function grownOff(
  rooms: Room[],
  distances: number[],
  sides: 'all' | 'leftRight' = 'all',
) {
  const across = (a: Room, b: Room) =>
    [
      facing(a, b, false),
      ...(sides === 'all' ? [facing(a, b, true)] : []),
    ].some((distance) => distances.includes(distance ?? -1));
  return rooms
    .slice(1)
    .every((room, i) =>
      rooms.slice(0, i + 1).some((other) => across(other, room)),
    );
}

/** The share of the map covered by the box round every room. */
function spread(rooms: Room[]) {
  const left = Math.min(...rooms.map(({ x }) => x));
  const top = Math.min(...rooms.map(({ y }) => y));
  const right = Math.max(...rooms.map(({ x, width }) => x + width));
  const bottom = Math.max(...rooms.map(({ y, height }) => y + height));
  return ((right - left) * (bottom - top)) / (61 * 41);
}

const mean = (values: number[]) =>
  values.reduce((a, b) => a + b, 0) / values.length;

describe('growRooms', () => {
  describe('growth', () => {
    it('starts from a room in the middle of the map', () => {
      // given
      const options = {};

      // when
      const results = SEEDS.map((seed) => grow(options, seed));

      // then
      for (const { rooms } of results) {
        const [first] = rooms as [Room];
        expect(first.x).toBeLessThanOrEqual(30);
        expect(first.x + first.width).toBeGreaterThan(30);
        expect(first.y).toBeLessThanOrEqual(20);
        expect(first.y + first.height).toBeGreaterThan(20);
      }
    });

    it('builds every room off one there is, at a gap of corridor from it', () => {
      // given: a gap of n leaves the floors n + 2 tiles apart
      const options = { gap: { min: 2, max: 4 } };

      // when
      const results = SEEDS.map((seed) => grow(options, seed));

      // then
      for (const { rooms } of results) {
        expect(rooms.length).toBeGreaterThan(5);
        expect(grownOff(rooms, [4, 5, 6])).toBe(true);
      }
    });

    it('builds rooms against a shared wall at a gap of 0', () => {
      // given
      const options = { gap: { min: 0, max: 0 } };

      // when
      const results = SEEDS.map((seed) => grow(options, seed));

      // then
      for (const { rooms } of results) {
        expect(rooms.length).toBeGreaterThan(5);
        expect(grownOff(rooms, [1])).toBe(true);
      }
    });

    it('rounds the gaps to odd lengths on the lattice', () => {
      // given: gaps of 2 and 4 become 1 and 3, so floors 3 and 5 apart
      const options = {
        placement: 'lattice',
        gap: { min: 2, max: 2 },
      } as const;
      const longer = { ...options, gap: { min: 4, max: 4 } };

      // when
      const short = SEEDS.map((seed) => grow(options, seed));
      const long = SEEDS.map((seed) => grow(longer, seed));

      // then
      for (const { rooms } of short) {
        expect(grownOff(rooms, [3])).toBe(true);
      }
      for (const { rooms } of long) {
        expect(grownOff(rooms, [5])).toBe(true);
      }
    });

    it('leaves out the gaps that would put rooms closer than the spacing', () => {
      // given: a spacing of 4 leaves gaps of 2 and more, 4 tiles or more apart
      const options = { gap: { min: 0, max: 3 }, roomSpacing: 4 };

      // when
      const results = SEEDS.map((seed) => grow(options, seed));

      // then
      for (const { rooms } of results) {
        expect(grownOff(rooms, [4, 5])).toBe(true);
      }
    });

    it('clusters the rooms more than scattering does', () => {
      // given
      const options = { roomCount: { min: 8, max: 8 } };

      // when
      const grown = SEEDS.map((seed) => grow(options, seed).rooms);
      const scattered = SEEDS.map(
        (seed) => run([scatterRooms(options)], seed).rooms,
      );

      // then
      expect(mean(grown.map(spread))).toBeLessThan(
        mean(scattered.map(spread)) * 0.8,
      );
    });

    it('builds beyond the left and right walls only with a lone horizontal bias', () => {
      // given
      const options = { horizontalBias: 1, gap: { min: 1, max: 1 } };

      // when
      const results = SEEDS.map((seed) => grow(options, seed));

      // then
      for (const { rooms } of results) {
        expect(rooms.length).toBeGreaterThan(3);
        expect(grownOff(rooms, [3], 'leftRight')).toBe(true);
      }
    });

    it('stops when no more rooms fit, short of the fill', () => {
      // given
      const options = {
        roomWidth: { min: 5, max: 5 },
        roomHeight: { min: 5, max: 5 },
        fill: 0.9,
      };

      // when
      const results = SEEDS.map((seed) =>
        run([growRooms(options)], seed, 31, 31),
      );

      // then
      for (const { rooms } of results) {
        expect(rooms.length).toBeGreaterThan(1);
        expect((rooms.length * 25) / (31 * 31)).toBeLessThan(0.5);
      }
    });
  });

  describe('seeds', () => {
    it('grows from the first template, put in the middle', () => {
      // given
      const options = { templates: [hall], gap: { min: 1, max: 1 } };

      // when
      const results = SEEDS.map((seed) => grow(options, seed));

      // then
      for (const { rooms, roomShapes } of results) {
        const [template] = roomShapes;
        expect(rooms[0]?.template).toBe(0);
        expect(template?.x).toBe(28);
        expect(template?.y).toBe(18);
        // the box of a template is its walls, so its neighbors are 2 tiles off it
        const box = { ...rooms[0], x: 29, y: 19, width: 3, height: 3 } as Room;
        expect(grownOff([box, ...rooms.slice(1)], [3])).toBe(true);
      }
    });

    it('grows from the rooms of an earlier step, with no room in the middle', () => {
      // given
      const corner = growRooms({
        roomCount: { min: 1, max: 1 },
        area: { width: { min: 15, max: 15 }, height: { min: 15, max: 15 } },
      });
      const options = {
        gap: { min: 1, max: 1 },
        roomCount: { min: 6, max: 6 },
      };

      // when
      const results = SEEDS.map((seed) =>
        run([corner, growRooms(options)], seed),
      );

      // then
      for (const { rooms } of results) {
        expect(rooms).toHaveLength(7);
        expect(grownOff(rooms, [3])).toBe(true);
      }
    });

    it('moves the first room off the middle when floor is in the way', () => {
      // given
      const block = step('carveBlock', {}, (state: MapState) => {
        for (let y = 15; y <= 25; ++y) {
          for (let x = 25; x <= 35; ++x) {
            stampTile(state, x, y, Tile.Floor);
          }
        }
        return {};
      });

      // when
      const results = SEEDS.map((seed) => run([block, growRooms()], seed));

      // then
      for (const { rooms } of results) {
        expect(rooms.length).toBeGreaterThan(5);
        expect(grownOff(rooms, [3, 4, 5, 6, 7, 8, 9, 10])).toBe(true);
      }
    });

    it('grows nothing when a symmetric layout finds its middle taken', () => {
      // given
      const block = step('carveBlock', {}, (state: MapState) => {
        stampTile(state, 30, 20, Tile.Floor);
        return {};
      });

      // when
      const { rooms } = run([block, growRooms({ symmetry: 'both' })]);

      // then
      expect(rooms).toEqual([]);
    });
  });

  describe('areas', () => {
    it('grows the rooms inside their area', () => {
      // given
      const options = {
        area: { width: { min: 25, max: 25 }, height: { min: 21, max: 21 } },
        fill: 0.3,
      };

      // when
      const results = SEEDS.map((seed) => grow(options, seed));

      // then: the floors and their walls fit the box
      for (const { rooms } of results) {
        expect(rooms.length).toBeGreaterThan(2);
        expect(grownOff(rooms, [3, 4, 5, 6, 7, 8, 9, 10])).toBe(true);
        const left = Math.min(...rooms.map(({ x }) => x));
        const right = Math.max(...rooms.map(({ x, width }) => x + width));
        const top = Math.min(...rooms.map(({ y }) => y));
        const bottom = Math.max(...rooms.map(({ y, height }) => y + height));
        expect(right - left + 2).toBeLessThanOrEqual(25);
        expect(bottom - top + 2).toBeLessThanOrEqual(21);
      }
    });
  });

  describe('validation', () => {
    it.each([
      ['gap', { gap: { min: -1, max: 2 } }],
      ['gap', { gap: { min: 3, max: 2 } }],
      ['horizontalBias', { horizontalBias: -1 }],
      ['verticalBias', { verticalBias: Number.NaN }],
      ['roomSpacing', { roomSpacing: 0 }],
    ] as const)('rejects an invalid %s', (name, options) => {
      // given
      const invalid = options as GrowRoomsOptions;

      // when
      const make = () => growRooms(invalid);

      // then
      expect(make).toThrow(RangeError);
      expect(make).toThrow(name);
    });

    it('rejects a gap that puts every room closer than the spacing', () => {
      // given
      const options = { gap: { min: 0, max: 1 }, roomSpacing: 5 };

      // when
      const make = () => growRooms(options);

      // then
      expect(make).toThrow(RangeError);
      expect(make).toThrow(/closer than a roomSpacing of 5/);
    });
  });
});
