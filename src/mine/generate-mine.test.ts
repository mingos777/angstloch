import { describe, expect, it } from 'vitest';
import { findCaveRegions } from '../cave/find-cave-regions';
import type { Grid } from '../core/grid';
import { Tile } from '../core/tile';
import { mulberry32 } from '../test-helpers/mulberry32';
import { generateMine } from './generate-mine';
import type { MineOptions } from './mine-options';

function floorShare(grid: Grid): number {
  return (grid.toString().split('.').length - 1) / (grid.width * grid.height);
}

const base = { width: 80, height: 50 };

describe('generateMine', () => {
  it('makes a map of the requested size', () => {
    // given
    const options = { width: 70, height: 45, random: mulberry32(1) };

    // when
    const { grid } = generateMine(options);

    // then
    expect(grid.width).toBe(70);
    expect(grid.height).toBe(45);
  });

  it('makes the same mine from the same seed', () => {
    // given
    const make = () => generateMine({ ...base, random: mulberry32(5) });

    // when
    const first = make();
    const second = make();

    // then
    expect(first.grid.toString()).toBe(second.grid.toString());
    expect(first.passages).toEqual(second.passages);
  });

  it('makes different mines from different seeds', () => {
    // given
    const options = base;

    // when
    const first = generateMine({ ...options, random: mulberry32(1) });
    const second = generateMine({ ...options, random: mulberry32(2) });

    // then
    expect(first.grid.toString()).not.toBe(second.grid.toString());
  });

  it('works with Math.random when no random is given', () => {
    // given
    const options = base;

    // when
    const { grid } = generateMine(options);

    // then
    expect(floorShare(grid)).toBeGreaterThan(0);
  });

  it('does not change the options it is given', () => {
    // given
    const options: MineOptions = {
      ...base,
      random: mulberry32(1),
      fishbone: { shaftWidth: { min: 2, max: 3 } },
      caverns: { count: { min: 0, max: 1 } },
      rooms: {},
      exits: { count: { min: 1, max: 1 } },
    };
    const copy = structuredClone({ ...options, random: undefined });

    // when
    generateMine(options);

    // then
    expect({ ...options, random: undefined }).toEqual(copy);
  });

  it('digs a fishbone when no layout is given', () => {
    // given
    const options = { ...base, random: mulberry32(1) };

    // when
    const { passages } = generateMine(options);

    // then
    expect(passages[0]?.kind).toBe('shaft');
    expect(passages.slice(1).every(({ kind }) => kind === 'adit')).toBe(true);
  });

  it('passes the fishbone options to digFishbone', () => {
    // given
    const options = {
      ...base,
      fishbone: { density: 0 },
      random: mulberry32(1),
    };

    // when
    const { passages } = generateMine(options);

    // then
    expect(passages.map(({ kind }) => kind)).toEqual(['shaft']);
  });

  it('digs a web of veins with the veins key', () => {
    // given
    const options = { ...base, veins: {}, random: mulberry32(1) };

    // when
    const { passages, halls } = generateMine(options);

    // then
    expect(passages.length).toBeGreaterThan(0);
    expect(passages.every(({ kind }) => kind === 'vein')).toBe(true);
    expect(halls).toEqual([]);
  });

  it('digs pillar halls with the pillars key', () => {
    // given
    const options = {
      width: 100,
      height: 60,
      pillars: { halls: { min: 3, max: 3 } },
      random: mulberry32(1),
    };

    // when
    const { halls } = generateMine(options);

    // then
    expect(halls).toHaveLength(3);
  });

  it('joins the pillar halls with the veins of the hall veins key', () => {
    // given
    const options = {
      width: 100,
      height: 60,
      pillars: { halls: { min: 3, max: 3 } },
      hallVeins: { density: 0 },
      random: mulberry32(1),
    };

    // when
    const { passages } = generateMine(options);

    // then
    expect(passages).toHaveLength(2);
  });

  it('throws a RangeError for hall veins without pillars', () => {
    // given
    const options = { ...base, hallVeins: {}, random: mulberry32(1) };

    // when
    const generate = () => generateMine(options);

    // then
    expect(generate).toThrow(RangeError);
    expect(generate).toThrow('hallVeins');
  });

  it('digs rings with the rings key', () => {
    // given
    const options = { ...base, rings: {}, random: mulberry32(1) };

    // when
    const { passages } = generateMine(options);

    // then
    expect(passages[0]?.kind).toBe('ring');
  });

  it('lists no halls for the layouts that have none', () => {
    // given
    const layouts = ['fishbone', 'veins', 'rings'] as const;

    // when
    const mines = layouts.map((layout) =>
      generateMine({ ...base, [layout]: {}, random: mulberry32(1) }),
    );

    // then
    for (const { halls } of mines) {
      expect(halls).toEqual([]);
    }
  });

  it('keeps the ring around the map as wall and the mine in one piece, whatever the layout', () => {
    // given
    const layouts = ['fishbone', 'veins', 'pillars', 'rings'] as const;

    // when
    const mines = layouts.map((layout, i) =>
      generateMine({ ...base, [layout]: {}, random: mulberry32(i + 1) }),
    );

    // then
    for (const { grid } of mines) {
      for (let x = 0; x < grid.width; ++x) {
        expect(grid.get(x, 0)).toBe(Tile.Wall);
        expect(grid.get(x, grid.height - 1)).toBe(Tile.Wall);
      }
      for (let y = 0; y < grid.height; ++y) {
        expect(grid.get(0, y)).toBe(Tile.Wall);
        expect(grid.get(grid.width - 1, y)).toBe(Tile.Wall);
      }
      expect(findCaveRegions(grid)).toHaveLength(1);
    }
  });

  it('throws a RangeError for more than one layout', () => {
    // given
    const options = { ...base, fishbone: {}, rings: {} };

    // when
    const generate = () => generateMine(options);

    // then
    expect(generate).toThrow(RangeError);
    expect(generate).toThrow('fishbone and rings');
  });

  it('adds no exits by default', () => {
    // given
    const options = { ...base, random: mulberry32(1) };

    // when
    const { exits } = generateMine(options);

    // then
    expect(exits).toEqual([]);
  });

  it('adds the exits that were asked for on the border, and keeps the mine in one piece', () => {
    // given
    const layouts = ['fishbone', 'veins', 'pillars', 'rings'] as const;

    // when
    const mines = layouts.map((layout, i) =>
      generateMine({
        ...base,
        [layout]: {},
        exits: { count: { min: 3, max: 3 } },
        random: mulberry32(i + 1),
      }),
    );

    // then
    for (const { grid, exits } of mines) {
      expect(exits).toHaveLength(3);
      for (const { x, y } of exits) {
        expect(grid.get(x, y)).toBe(Tile.Door);
        expect(
          x === 0 || y === 0 || x === grid.width - 1 || y === grid.height - 1,
        ).toBe(true);
      }
      expect(findCaveRegions(grid)).toHaveLength(1);
    }
  });

  it('reports one attempt and no failures for a mine that needs no retry', () => {
    // given
    const options = { ...base, random: mulberry32(1) };

    // when
    const { attempts, failures } = generateMine(options);

    // then
    expect(attempts).toBe(1);
    expect(failures).toEqual([]);
  });

  it('digs a mine on a tiny map without failing', () => {
    // given
    const options = { width: 3, height: 3, random: mulberry32(1) };

    // when
    const { grid } = generateMine(options);

    // then
    expect(grid.width).toBe(3);
  });

  it.each([
    ['width', { width: 0 }],
    ['height', { height: -1 }],
    ['width', { width: 1.5 }],
    ['angle', { fishbone: { angle: Number.NaN } }],
    ['veinSpacing', { veins: { veinSpacing: 2 } }],
    ['hallRagged', { pillars: { hallRagged: 1.5 } }],
    ['veinWindiness', { pillars: {}, hallVeins: { veinWindiness: 2 } }],
    ['ringWobble', { rings: { ringWobble: 1.5 } }],
    ['veinWindiness', { caverns: {}, tunnels: { veinWindiness: 2 } }],
    ['count', { exits: { count: { min: -1, max: 1 } } }],
  ])('throws a RangeError for an invalid %s', (name, invalid) => {
    // given
    const options = { ...base, ...invalid };

    // when
    const generate = () => generateMine(options);

    // then
    expect(generate).toThrow(RangeError);
    expect(generate).toThrow(name);
  });
});
