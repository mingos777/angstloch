import { describe, expect, it } from 'vitest';
import { Tile } from '../core/tile';
import { emptyMap } from '../pipeline/empty-map';
import { pipeline } from '../pipeline/pipeline';
import type { AnyStep } from '../pipeline/pipeline-chain';
import { TemplateCell } from '../rooms/templates/template-cell';
import { TemplatePlacementError } from '../rooms/templates/template-placement-error';
import { SEEDS, asymmetry, isConnected } from '../test-helpers/dungeon-checks';
import { mulberry32 } from '../test-helpers/mulberry32';
import { carveCorridors } from './carve-corridors';
import { generateRoomDungeon } from './generate-room-dungeon';
import type { JoinedRooms } from './join-rooms';
import { partitionRooms } from './partition-rooms';
import type { RoomDungeonOptions } from './room-dungeon-options';
import { scatterRooms } from './scatter-rooms';

const { Floor: F, Wall: W, Exit: E } = TemplateCell;

function dungeon(options: Partial<RoomDungeonOptions> = {}, seed = 1) {
  return generateRoomDungeon({
    width: 61,
    height: 41,
    random: mulberry32(seed),
    ...options,
  });
}

/** The same steps run by hand, as the preset should run them. */
function byHand(steps: AnyStep[], seed = 1) {
  const run = pipeline(
    emptyMap({ width: 61, height: 41, tile: Tile.Wall }),
    steps,
    { random: mulberry32(seed) },
  );
  const { rooms, roomExits } = run as unknown as JoinedRooms;
  return { grid: run.grid.toString(), rooms, exits: roomExits };
}

/** What the preset built, in the shape `byHand` reports. */
function seen(result: ReturnType<typeof dungeon>) {
  return {
    grid: result.grid.toString(),
    rooms: result.rooms,
    exits: result.exits,
  };
}

describe('generateRoomDungeon', () => {
  it('produces a grid of the requested size', () => {
    // given
    const options = { width: 30, height: 20 };

    // when
    const { grid } = dungeon(options);

    // then
    expect([grid.width, grid.height]).toEqual([30, 20]);
  });

  it('is deterministic for a given random source', () => {
    // given
    const options = { scatter: { roomCount: { min: 5, max: 5 } } };

    // when
    const first = dungeon(options, 7);
    const second = dungeon(options, 7);

    // then
    expect(first.grid.toString()).toBe(second.grid.toString());
    expect(first.rooms).toEqual(second.rooms);
  });

  it('joins every room', () => {
    // given
    const options = {};

    // when
    const results = SEEDS.map((seed) => dungeon(options, seed));

    // then
    expect(results.every(isConnected)).toBe(true);
  });

  describe('steps', () => {
    it('scatters the rooms and joins them by default', () => {
      // given
      const steps = [scatterRooms(), carveCorridors()];

      // when
      const result = dungeon({}, 3);

      // then
      expect(seen(result)).toEqual(byHand(steps, 3));
    });

    it('gives scatter to scatterRooms', () => {
      // given
      const scatter = { fill: 0.2, spacingUniformity: 1 };

      // when
      const result = dungeon({ scatter }, 3);

      // then
      expect(seen(result)).toEqual(
        byHand([scatterRooms(scatter), carveCorridors()], 3),
      );
    });

    it('partitions the rooms instead with partition', () => {
      // given
      const partition = { roomSpacing: 3 };

      // when
      const result = dungeon({ partition }, 3);

      // then
      expect(seen(result)).toEqual(
        byHand([partitionRooms(partition), carveCorridors()], 3),
      );
    });

    it('gives corridors to carveCorridors', () => {
      // given
      const corridors = {
        connection: 'bsp',
        deadEndChance: 0.5,
        doorChance: 0.3,
      } as const;

      // when
      const result = dungeon({ corridors }, 3);

      // then
      expect(seen(result)).toEqual(
        byHand([scatterRooms(), carveCorridors(corridors)], 3),
      );
    });

    it('gives the corridors nothing of the options of the rooms', () => {
      // given
      const scatter = {
        placement: 'lattice',
        symmetry: 'both',
        symmetryChance: 0.5,
      } as const;

      // when
      const result = dungeon({ scatter }, 3);

      // then
      expect(seen(result)).toEqual(
        byHand([scatterRooms(scatter), carveCorridors()], 3),
      );
    });

    it.each(['horizontal', 'vertical', 'both', 'rotational'] as const)(
      'makes the whole map %s symmetric when both steps are',
      (symmetry) => {
        // given
        const options = { partition: { symmetry }, corridors: { symmetry } };

        // when
        const results = SEEDS.map((seed) => dungeon(options, seed));

        // then
        expect(
          results.map((result) => asymmetry(result, symmetry, false)),
        ).toEqual(results.map(() => 0));
      },
    );

    it('rejects scatter and partition together', () => {
      // given
      const options = { scatter: {}, partition: {} };

      // when
      const generate = () => dungeon(options);

      // then
      expect(generate).toThrow(RangeError);
      expect(generate).toThrow(/at most one of scatter and partition/);
    });
  });

  describe('result', () => {
    it('reports the exits of the rooms as exits, each listed on its rooms', () => {
      // given
      const options = { corridors: { loopChance: 0.5 } };

      // when
      const results = SEEDS.map((seed) => dungeon(options, seed));

      // then
      for (const { rooms, exits } of results) {
        expect(exits.length).toBeGreaterThan(0);
        expect(rooms.map(({ id }) => id)).toEqual(rooms.map((_r, i) => i));
        for (const room of rooms) {
          expect(
            exits.filter(({ rooms: ids }) => ids.includes(room.id)).length,
          ).toBe(room.exitCount);
        }
      }
    });

    it('reports the share of the map that the floors of the rooms cover', () => {
      // given
      const options = { scatter: { symmetry: 'both', fill: 0.15 } } as const;

      // when
      const results = SEEDS.map((seed) => dungeon(options, seed));

      // then
      for (const { rooms, fill } of results) {
        const covered = rooms.reduce((sum, r) => sum + r.width * r.height, 0);
        expect(fill).toBeCloseTo(covered / (61 * 41));
        expect(fill).toBeGreaterThanOrEqual(0.1);
        expect(fill).toBeLessThan(0.3);
      }
    });

    it('builds the map once when nothing fails', () => {
      // given
      const options = {};

      // when
      const { attempts, failures } = dungeon(options);

      // then
      expect([attempts, failures]).toEqual([1, []]);
    });

    it('builds the map again when a templated room cannot be joined', () => {
      // given
      const closet = {
        cells: [
          [W, E, W],
          [W, F, W],
          [W, W, W],
        ],
        count: { min: 12, max: 12 },
      };

      // when
      const { attempts, failures } = dungeon(
        { width: 31, height: 21, scatter: { templates: [closet] } },
        55,
      );

      // then
      expect(attempts).toBe(2);
      expect(failures).toHaveLength(1);
      expect(failures[0]?.step).toBe('carveCorridors');
      expect(failures[0]?.error).toBeInstanceOf(TemplatePlacementError);
    });
  });

  describe('validation', () => {
    it.each([
      ['width', { width: 0 }],
      ['height', { height: 1.5 }],
      ['fill', { scatter: { fill: 1.5 } }],
      ['spacingUniformity', { partition: { spacingUniformity: 2 } }],
      ['roomCount', { scatter: { roomCount: { min: 1, max: 2.5 } } }],
      ['connection', { corridors: { connection: 'spiral' } }],
      ['loopChance', { corridors: { loopChance: 2 } }],
    ] as const)('rejects an invalid %s', (name, options) => {
      // given
      const invalid = options as Partial<RoomDungeonOptions>;

      // when
      const generate = () => dungeon(invalid);

      // then
      expect(generate).toThrow(RangeError);
      expect(generate).toThrow(name);
    });
  });
});
