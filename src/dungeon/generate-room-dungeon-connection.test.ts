import { describe, expect, it } from 'vitest';
import type { RoomDungeonOptions } from '../rooms/room-dungeon-options';
import { mulberry32 } from '../test-helpers/mulberry32';
import {
  SEEDS,
  asymmetry,
  cycles,
  isConnected,
  overlap,
} from '../test-helpers/dungeon-checks';
import { TemplateCell } from '../rooms/templates/template-cell';
import type { RoomTemplate } from '../rooms/templates/room-template';
import { generateRoomDungeon } from './generate-room-dungeon';

function dungeon(options: Partial<RoomDungeonOptions> = {}, seed = 1) {
  return generateRoomDungeon({
    width: 61,
    height: 41,
    random: mulberry32(seed),
    ...options,
  });
}

const TREE = { loopChance: 0, deadEndChance: 0 };

const { Floor: F, Wall: W, Exit: E } = TemplateCell;

const closet: RoomTemplate = {
  name: 'closet',
  cells: [
    [W, E, W],
    [W, F, W],
    [W, W, W],
  ],
};

describe('generateRoomDungeon connection', () => {
  it('joins the nearest rooms by default', () => {
    // given
    const options = {};

    // when
    const byDefault = dungeon(options, 3);
    const nearest = dungeon({ connection: 'nearest' }, 3);

    // then
    expect(nearest.grid.toString()).toBe(byDefault.grid.toString());
  });

  it('lays out the same rooms with either connection', () => {
    // given
    const options = { roomCount: { min: 8, max: 8 } };

    // when
    const nearest = dungeon({ ...options, connection: 'nearest' }, 2);
    const bsp = dungeon({ ...options, connection: 'bsp' }, 2);

    // then
    expect(
      bsp.rooms.map(({ x, y, width, height }) => [x, y, width, height]),
    ).toEqual(
      nearest.rooms.map(({ x, y, width, height }) => [x, y, width, height]),
    );
  });

  it('joins the rooms differently from the nearest connection', () => {
    // given
    const options = { ...TREE, roomCount: { min: 9, max: 9 } };

    // when
    const differing = SEEDS.filter(
      (seed) =>
        dungeon({ ...options, connection: 'bsp' }, seed).grid.toString() !==
        dungeon({ ...options, connection: 'nearest' }, seed).grid.toString(),
    );

    // then
    expect(differing.length).toBeGreaterThan(2);
  });

  it.each(['scatter', 'bsp'] as const)(
    'reaches every room with bsp connections and %s placement',
    (partition) => {
      // given
      const options = { connection: 'bsp', partition } as const;

      // when
      const results = SEEDS.map((seed) => dungeon(options, seed));

      // then
      for (const result of results) {
        expect(result.rooms.length).toBeGreaterThan(1);
        expect(isConnected(result)).toBe(true);
      }
    },
  );

  it('adds hardly any loops of its own, only where a corridor crosses another', () => {
    // given
    const options = {
      ...TREE,
      exitsPerRoom: { min: 1, max: 1 },
      connection: 'bsp',
    } as const;

    // when
    const results = SEEDS.map((seed) => dungeon(options, seed));

    // then
    for (const result of results) {
      expect(isConnected(result)).toBe(true);
      expect(cycles(result)).toBeLessThanOrEqual(1);
    }
  });

  it('still adds loops on request', () => {
    // given
    const options = { connection: 'bsp', loopChance: 1 } as const;

    // when
    const results = SEEDS.map((seed) => dungeon(options, seed));

    // then
    expect(results.some((result) => cycles(result) > 0)).toBe(true);
  });

  it('keeps rooms apart', () => {
    // given
    const options = { connection: 'bsp', roomSpacing: 3 } as const;

    // when
    const results = SEEDS.map((seed) => dungeon(options, seed));

    // then
    for (const { rooms } of results) {
      for (const [i, a] of rooms.entries()) {
        for (const b of rooms.slice(i + 1)) {
          expect(overlap(a, b, 3)).toBe(false);
        }
      }
    }
  });

  it('is deterministic', () => {
    // given
    const options = { connection: 'bsp' } as const;

    // when
    const a = dungeon(options, 5);
    const b = dungeon(options, 5);

    // then
    expect(a.grid.toString()).toBe(b.grid.toString());
  });

  it.each(['horizontal', 'vertical', 'both', 'rotational'] as const)(
    'stays symmetric with %s layout symmetry',
    (layoutSymmetry) => {
      // given
      const options = { connection: 'bsp', layoutSymmetry } as const;

      // when
      const results = SEEDS.map((seed) => dungeon(options, seed));

      // then
      for (const result of results) {
        expect(asymmetry(result, layoutSymmetry, false)).toBe(0);
        expect(isConnected(result)).toBe(true);
      }
    },
  );

  it('works on the lattice', () => {
    // given
    const options = { connection: 'bsp', placement: 'lattice' } as const;

    // when
    const results = SEEDS.map((seed) => dungeon(options, seed));

    // then
    for (const result of results) {
      expect(isConnected(result)).toBe(true);
    }
  });

  it('works with a single room', () => {
    // given
    const options = {
      connection: 'bsp',
      roomCount: { min: 1, max: 1 },
    } as const;

    // when
    const { rooms } = dungeon(options);

    // then
    expect(rooms).toHaveLength(1);
  });

  it('rejects an unknown connection', () => {
    // given
    const generate = () =>
      dungeon({ connection: 'spiral' as unknown as 'bsp' });

    // when / then
    expect(generate).toThrow(RangeError);
    expect(generate).toThrow('connection');
  });

  it('reaches templated rooms with bsp connections', () => {
    // given
    const options: Partial<RoomDungeonOptions> = {
      connection: 'bsp',
      templates: [closet],
    };

    // when
    const results = SEEDS.map((seed) => dungeon(options, seed));

    // then
    for (const result of results) {
      expect(result.rooms.length).toBeGreaterThan(1);
      expect(isConnected(result)).toBe(true);
    }
  });

  describe('bsp-random', () => {
    it('lays out the same rooms as the other connections', () => {
      // given
      const options = { roomCount: { min: 8, max: 8 } };

      // when
      const nearest = dungeon({ ...options, connection: 'nearest' }, 2);
      const random = dungeon({ ...options, connection: 'bsp-random' }, 2);

      // then
      expect(random.rooms.map(({ x, y }) => [x, y])).toEqual(
        nearest.rooms.map(({ x, y }) => [x, y]),
      );
    });

    it('joins the rooms differently from the closest pair', () => {
      // given
      const options = { ...TREE, roomCount: { min: 9, max: 9 } };

      // when
      const differing = SEEDS.filter(
        (seed) =>
          dungeon(
            { ...options, connection: 'bsp-random' },
            seed,
          ).grid.toString() !==
          dungeon({ ...options, connection: 'bsp' }, seed).grid.toString(),
      );

      // then
      expect(differing.length).toBeGreaterThan(2);
    });

    it.each(['scatter', 'bsp'] as const)(
      'reaches every room with %s placement',
      (partition) => {
        // given
        const options = { connection: 'bsp-random', partition } as const;

        // when
        const results = SEEDS.map((seed) => dungeon(options, seed));

        // then
        for (const result of results) {
          expect(result.rooms.length).toBeGreaterThan(1);
          expect(isConnected(result)).toBe(true);
        }
      },
    );

    it('is deterministic', () => {
      // given
      const options = { connection: 'bsp-random' } as const;

      // when
      const a = dungeon(options, 5);
      const b = dungeon(options, 5);

      // then
      expect(a.grid.toString()).toBe(b.grid.toString());
    });

    it.each(['horizontal', 'both', 'rotational'] as const)(
      'stays symmetric with %s layout symmetry',
      (layoutSymmetry) => {
        // given
        const options = { connection: 'bsp-random', layoutSymmetry } as const;

        // when
        const results = SEEDS.map((seed) => dungeon(options, seed));

        // then
        for (const result of results) {
          expect(asymmetry(result, layoutSymmetry, false)).toBe(0);
          expect(isConnected(result)).toBe(true);
        }
      },
    );

    it('reaches templated rooms', () => {
      // given
      const options: Partial<RoomDungeonOptions> = {
        connection: 'bsp-random',
        templates: [closet],
      };

      // when
      const results = SEEDS.map((seed) => dungeon(options, seed));

      // then
      for (const result of results) {
        expect(isConnected(result)).toBe(true);
      }
    });
  });
});
