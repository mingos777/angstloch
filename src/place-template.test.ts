import { describe, expect, it } from 'vitest';
import { placeTemplate } from './place-template';
import type { PlacementArea } from './placement-area';
import type { RoomTemplate } from './room-template';
import { TemplateCell } from './template-cell';
import type { TemplatePlacement } from './template-placement';
import { TemplatePlacementError } from './template-placement-error';
import { mulberry32 } from './test-helpers/mulberry32';

const { Floor: F, Wall: W, Exit: E } = TemplateCell;

/** Three by three, with the exit in the top wall. */
const cell: RoomTemplate = {
  name: 'cell',
  cells: [
    [W, E, W],
    [W, F, W],
    [W, W, W],
  ],
};

const area: PlacementArea = {
  width: 21,
  height: 21,
  spacing: 1,
  lattice: false,
};

function obstacle(x: number, y: number, size: number): TemplatePlacement {
  return {
    x,
    y,
    width: size,
    height: size,
    cells: Array.from({ length: size }, () =>
      Array<TemplateCell>(size).fill(W),
    ),
    exits: [],
    rotation: 0,
    mirrored: false,
  };
}

describe('placeTemplate', () => {
  it('places the template exactly at its position', () => {
    // given
    const position = { coords: { x: 10, y: 10 }, anchor: 'center' as const };

    // when
    const placed = placeTemplate(mulberry32(1), cell, 0, area, [], position);

    // then
    expect([placed.x, placed.y]).toEqual([9, 9]);
  });

  it('honors the anchor', () => {
    // given
    const position = { coords: { x: 5, y: 7 }, anchor: 'top-left' as const };

    // when
    const placed = placeTemplate(mulberry32(1), cell, 0, area, [], position);

    // then
    expect([placed.x, placed.y]).toEqual([5, 7]);
  });

  it('moves to the nearest valid spot when the position is taken', () => {
    // given
    const position = { coords: { x: 10, y: 10 }, anchor: 'center' as const };
    const blocker = obstacle(8, 8, 5);

    // when
    const placed = placeTemplate(
      mulberry32(1),
      cell,
      0,
      area,
      [blocker],
      position,
    );

    // then
    // the floor of the room is not on the blocker, whose walls it may share
    const [floorX, floorY] = [placed.x + 1, placed.y + 1];
    expect(Math.abs(placed.x - 9) + Math.abs(placed.y - 9)).toBeGreaterThan(0);
    expect(floorX < 8 || floorX > 12 || floorY < 8 || floorY > 12).toBe(true);
  });

  it('moves a position that sticks out of the map', () => {
    // given
    const position = { coords: { x: 0, y: 0 }, anchor: 'center' as const };

    // when
    const placed = placeTemplate(mulberry32(1), cell, 0, area, [], position);

    // then
    expect([placed.x, placed.y]).toEqual([0, 2]);
  });

  it('places at random without a position', () => {
    // given
    const places = new Set<string>();

    // when
    for (let seed = 0; seed < 20; seed++) {
      const placed = placeTemplate(mulberry32(seed), cell, 0, area, []);
      places.add(`${String(placed.x)},${String(placed.y)}`);
    }

    // then
    expect(places.size).toBeGreaterThan(5);
  });

  it('ignores the position at zero accuracy', () => {
    // given
    const position = { coords: { x: 10, y: 10 }, anchor: 'center' as const };
    const template = { ...cell, positionAccuracy: 0 };
    const places = new Set<string>();

    // when
    for (let seed = 0; seed < 20; seed++) {
      const placed = placeTemplate(
        mulberry32(seed),
        template,
        0,
        area,
        [],
        position,
      );
      places.add(`${String(placed.x)},${String(placed.y)}`);
    }

    // then
    expect(places.size).toBeGreaterThan(5);
  });

  it('scatters around the position at a low accuracy', () => {
    // given
    const position = { coords: { x: 10, y: 10 }, anchor: 'center' as const };
    const template = { ...cell, positionAccuracy: 0.5 };
    const places = new Set<string>();

    // when
    for (let seed = 0; seed < 20; seed++) {
      const placed = placeTemplate(
        mulberry32(seed),
        template,
        0,
        area,
        [],
        position,
      );
      places.add(`${String(placed.x)},${String(placed.y)}`);
    }

    // then
    expect(places.size).toBeGreaterThan(1);
  });

  it('uses only the rotations the position allows', () => {
    // given
    const template = { ...cell, rotate: [0, 90, 180, 270] as const };
    const position = {
      coords: { x: 10, y: 10 },
      anchor: 'center' as const,
      rotations: [180 as const],
    };

    // when
    const placed = placeTemplate(
      mulberry32(1),
      { ...template, rotate: [...template.rotate] },
      0,
      area,
      [],
      position,
    );

    // then
    expect(placed.rotation).toBe(180);
  });

  it('keeps floors on the lattice by using even corners', () => {
    // given
    const lattice = { ...area, lattice: true };
    const position = { coords: { x: 11, y: 11 }, anchor: 'center' as const };

    // when
    const placed = placeTemplate(mulberry32(1), cell, 0, lattice, [], position);

    // then
    expect([placed.x % 2, placed.y % 2]).toEqual([0, 0]);
  });

  it('rejects templates of even size on the lattice', () => {
    // given
    const template: RoomTemplate = {
      cells: [
        [W, E, W, W],
        [W, F, F, W],
        [W, W, W, W],
        [W, W, W, W],
      ],
    };
    const lattice = { ...area, lattice: true };

    // when
    const place = () => placeTemplate(mulberry32(1), template, 0, lattice, []);

    // then
    expect(place).toThrow(/fits the lattice/);
  });

  it('throws when the template is bigger than the map', () => {
    // given
    const small = { ...area, width: 2, height: 2 };

    // when
    const place = () => placeTemplate(mulberry32(1), cell, 2, small, []);

    // then
    expect(place).toThrow(/bigger than the 2x2 map/);
  });

  it('throws when nothing is free', () => {
    // given
    const full = [obstacle(0, 0, 21)];

    // when
    const place = () => placeTemplate(mulberry32(1), cell, 0, area, full);

    // then
    expect(place).toThrow(TemplatePlacementError);
    expect(place).toThrow(/no free spot.*collide/);
  });

  it('throws when the exit has no room', () => {
    // given
    const tight = { ...area, width: 4, height: 3 };
    const sideways: RoomTemplate = {
      name: 'sideways',
      cells: [
        [W, W, W],
        [W, F, E],
        [W, W, W],
      ],
    };

    // when
    const place = () => placeTemplate(mulberry32(1), sideways, 0, tight, []);

    // then
    expect(place).toThrow(/without room for a corridor/);
  });

  it('names the template in the error', () => {
    // given
    const small = { ...area, width: 2, height: 2 };

    // when
    const place = () => placeTemplate(mulberry32(1), cell, 4, small, []);

    // then
    expect(place).toThrow(/Template "cell" \(#4\)/);
  });

  it('accepts a template that only has an optional exit with room', () => {
    // given
    const optional: RoomTemplate = {
      cells: [
        [W, TemplateCell.OptionalExit, W],
        [W, F, W],
        [W, W, W],
      ],
    };

    // when
    const placed = placeTemplate(mulberry32(1), optional, 0, area, []);

    // then
    expect(placed.exits).toHaveLength(1);
  });

  it('places the room inside a region', () => {
    // given
    const region = { x: 12, y: 2, width: 6, height: 5 };

    // when
    const placed = placeTemplate(
      mulberry32(1),
      cell,
      0,
      area,
      [],
      undefined,
      () => true,
      region,
    );

    // then
    expect(placed.x).toBeGreaterThanOrEqual(12);
    expect(placed.x + placed.width).toBeLessThanOrEqual(18);
    expect(placed.y).toBeGreaterThanOrEqual(2);
    expect(placed.y + placed.height).toBeLessThanOrEqual(7);
  });

  it('spreads copies over a region', () => {
    // given
    const region = { x: 5, y: 5, width: 10, height: 10 };
    const places = new Set<string>();

    // when
    for (let seed = 0; seed < 20; seed++) {
      const placed = placeTemplate(
        mulberry32(seed),
        cell,
        0,
        area,
        [],
        undefined,
        () => true,
        region,
      );
      places.add(`${String(placed.x)},${String(placed.y)}`);
    }

    // then
    expect(places.size).toBeGreaterThan(5);
  });

  it('starts a lattice room in a region on an even tile', () => {
    // given
    const lattice = { ...area, lattice: true };
    const region = { x: 5, y: 5, width: 9, height: 9 };

    // when
    const placed = placeTemplate(
      mulberry32(1),
      cell,
      0,
      lattice,
      [],
      undefined,
      () => true,
      region,
    );

    // then
    expect([placed.x % 2, placed.y % 2]).toEqual([0, 0]);
    expect(placed.x).toBeGreaterThanOrEqual(5);
  });

  it('throws when the template is bigger than the region', () => {
    // given
    const region = { x: 0, y: 0, width: 2, height: 9 };

    // when
    const place = () =>
      placeTemplate(
        mulberry32(1),
        cell,
        0,
        area,
        [],
        undefined,
        () => true,
        region,
      );

    // then
    expect(place).toThrow(/bigger than the 2x9 area/);
  });
});
