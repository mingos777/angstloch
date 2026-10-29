import { describe, expect, it } from 'vitest';
import type { Room } from '../rooms/room';
import { mulberry32 } from '../test-helpers/mulberry32';
import { planBspLinks } from './plan-bsp-links';

function room(id: number, x: number, y: number, width = 3, height = 3): Room {
  return {
    id,
    kind: 'room',
    x,
    y,
    width,
    height,
    exits: [],
    exitCount: 0,
    doorCount: 0,
  };
}

const ids = (rooms: Room[]) =>
  [...new Set(rooms.map((r) => r.id))].sort((p, q) => p - q);

/** The ids of the rooms that a group of links involves. */
function involved(group: { a: Room; b: Room }[]) {
  return [...new Set(group.flatMap(({ a, b }) => [a.id, b.id]))].sort(
    (p, q) => p - q,
  );
}

const scattered = [
  room(0, 2, 3),
  room(1, 30, 5),
  room(2, 14, 20),
  room(3, 45, 25),
  room(4, 8, 40),
  room(5, 33, 38),
  room(6, 22, 12),
  room(7, 50, 8),
];

describe('planBspLinks', () => {
  it('plans nothing without rooms', () => {
    // given
    const rooms: Room[] = [];

    // when
    const groups = planBspLinks(rooms);

    // then
    expect(groups).toEqual([]);
  });

  it('plans nothing for a single room', () => {
    // given
    const rooms = [room(0, 5, 5)];

    // when
    const groups = planBspLinks(rooms);

    // then
    expect(groups).toEqual([]);
  });

  it('plans one link for two rooms', () => {
    // given
    const rooms = [room(0, 2, 2), room(1, 20, 2)];

    // when
    const groups = planBspLinks(rooms);

    // then
    expect(groups).toHaveLength(1);
    expect(groups[0]?.map(({ a, b }) => [a.id, b.id])).toEqual([[0, 1]]);
  });

  it('plans one cut fewer than there are rooms', () => {
    // given
    const rooms = scattered;

    // when
    const groups = planBspLinks(rooms);

    // then
    expect(groups).toHaveLength(rooms.length - 1);
  });

  it('cuts across the axis where the rooms are more spread out', () => {
    // given
    const wide = [
      room(0, 2, 5),
      room(1, 12, 6),
      room(2, 22, 5),
      room(3, 32, 6),
    ];

    // when
    const groups = planBspLinks(wide);

    // then
    const root = groups[groups.length - 1] ?? [];
    expect(ids(root.map(({ a }) => a))).toEqual([0, 1]);
    expect(ids(root.map(({ b }) => b))).toEqual([2, 3]);
  });

  it('cuts across the y axis for rooms that are stacked', () => {
    // given
    const tall = [
      room(0, 5, 2),
      room(1, 6, 12),
      room(2, 5, 22),
      room(3, 6, 32),
    ];

    // when
    const groups = planBspLinks(tall);

    // then
    const root = groups[groups.length - 1] ?? [];
    expect(ids(root.map(({ a }) => a))).toEqual([0, 1]);
    expect(ids(root.map(({ b }) => b))).toEqual([2, 3]);
  });

  it('puts the room of the first half first in every link', () => {
    // given
    const rooms = scattered;

    // when
    const groups = planBspLinks(rooms);

    // then
    const root = groups[groups.length - 1] ?? [];
    const lefts = root.map(({ a }) => a.x + a.width / 2);
    const rights = root.map(({ b }) => b.x + b.width / 2);
    expect(Math.max(...lefts)).toBeLessThanOrEqual(Math.min(...rights));
  });

  it('holds every pair across a cut, closest first', () => {
    // given
    const rooms = scattered;

    // when
    const groups = planBspLinks(rooms);

    // then
    const root = groups[groups.length - 1] ?? [];
    expect(root).toHaveLength(16);
    const distances = root.map(({ distance }) => distance);
    expect(distances).toEqual([...distances].sort((p, q) => p - q));
  });

  it('starts a group with the closest pair of rooms across the cut', () => {
    // given
    const row = [room(0, 2, 5), room(1, 12, 5), room(2, 22, 5), room(3, 32, 5)];

    // when
    const groups = planBspLinks(row);

    // then
    const root = groups[groups.length - 1] ?? [];
    expect([root[0]?.a.id, root[0]?.b.id]).toEqual([1, 2]);
  });

  it('plans the cuts inside each half before the cut that makes the halves', () => {
    // given
    const rooms = scattered;

    // when
    const groups = planBspLinks(rooms);

    // then
    groups.forEach((group, index) => {
      const rooms = involved(group);
      groups.forEach((other, otherIndex) => {
        const inside = involved(other);
        const isInside =
          inside.length < rooms.length &&
          inside.every((id) => rooms.includes(id));
        if (isInside) {
          expect(otherIndex).toBeLessThan(index);
        }
      });
    });
  });

  it('ends with a cut that involves every room', () => {
    // given
    const rooms = scattered;

    // when
    const groups = planBspLinks(rooms);

    // then
    expect(involved(groups[groups.length - 1] ?? [])).toEqual(ids(rooms));
  });

  it('joins all the rooms into one tree when the first link of every cut is built', () => {
    // given
    const rooms = scattered;
    const groups = planBspLinks(rooms);

    // when
    const parent = new Map(rooms.map((r) => [r.id, r.id]));
    const find = (id: number): number => {
      const up = parent.get(id) ?? id;
      return up === id ? id : find(up);
    };
    for (const group of groups) {
      const link = group[0];
      if (link) {
        parent.set(find(link.a.id), find(link.b.id));
      }
    }

    // then
    expect(new Set(rooms.map((r) => find(r.id))).size).toBe(1);
  });

  it('does not change the order of the rooms it is given', () => {
    // given
    const rooms = [...scattered];

    // when
    planBspLinks(rooms);

    // then
    expect(rooms.map((r) => r.id)).toEqual(scattered.map((r) => r.id));
  });

  it('plans the same cuts whatever the order of the rooms', () => {
    // given
    const shuffled = [...scattered].reverse();

    // when
    const groups = planBspLinks(scattered);
    const reordered = planBspLinks(shuffled);

    // then
    const summary = (g: { a: Room; b: Room }[][]) =>
      g.map((group) =>
        group.map(({ a, b }) => `${String(a.id)}-${String(b.id)}`),
      );
    expect(summary(reordered)).toEqual(summary(groups));
  });

  it('copes with rooms that share a center', () => {
    // given
    const rooms = [room(0, 5, 5), room(1, 5, 5), room(2, 5, 5)];

    // when
    const groups = planBspLinks(rooms);

    // then
    expect(groups).toHaveLength(2);
  });

  describe('with a random source', () => {
    const key = (group: { a: Room; b: Room }[]) =>
      group.map(({ a, b }) => `${String(a.id)}-${String(b.id)}`);

    it('plans the same cuts with the same pairs', () => {
      // given
      const closest = planBspLinks(scattered);

      // when
      const random = planBspLinks(scattered, mulberry32(1));

      // then
      expect(random).toHaveLength(closest.length);
      random.forEach((group, index) => {
        expect(key(group).sort()).toEqual(key(closest[index] ?? []).sort());
      });
    });

    it('puts the pairs of a cut in a random order, not closest first', () => {
      // given
      const random = planBspLinks(scattered, mulberry32(1));

      // when
      const root = random[random.length - 1] ?? [];

      // then
      const distances = root.map(({ distance }) => distance);
      expect(distances).not.toEqual([...distances].sort((p, q) => p - q));
    });

    it('gives different first pairs for different random sources', () => {
      // given
      const firsts = new Set<string>();

      // when
      for (let seed = 1; seed <= 20; ++seed) {
        const groups = planBspLinks(scattered, mulberry32(seed));
        firsts.add(key(groups[groups.length - 1] ?? [])[0] ?? '');
      }

      // then
      expect(firsts.size).toBeGreaterThan(5);
    });

    it('is deterministic for the same random source', () => {
      // given
      const a = planBspLinks(scattered, mulberry32(4));

      // when
      const b = planBspLinks(scattered, mulberry32(4));

      // then
      expect(a.map(key)).toEqual(b.map(key));
    });

    it('still plans the cuts inside each half first and ends with all the rooms', () => {
      // given
      const groups = planBspLinks(scattered, mulberry32(2));

      // when
      const last = involved(groups[groups.length - 1] ?? []);

      // then
      expect(last).toEqual(ids(scattered));
      expect(groups).toHaveLength(scattered.length - 1);
    });
  });
});
