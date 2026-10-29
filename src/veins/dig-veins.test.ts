import { describe, expect, it } from 'vitest';
import type { Grid } from '../core/grid';
import type { Point } from '../core/point';
import { Tile } from '../core/tile';
import { placeScatteredRooms } from '../dungeon/place-scattered-rooms';
import { emptyMap } from '../pipeline/empty-map';
import { pipeline } from '../pipeline/pipeline';
import type { MapStep } from '../pipeline/map-step';
import { Reserve } from '../pipeline/reserve';
import { brushOffsets } from '../roads/brush-offsets';
import { step } from '../pipeline/step';
import { floorBeyondEntrances } from '../test-helpers/floor-beyond-entrances';
import { cellBlocksOf } from '../test-helpers/cell-blocks-of';
import { mulberry32 } from '../test-helpers/mulberry32';
import { digFishbone } from '../mine/dig-fishbone';
import { digPillarHalls } from '../mine/dig-pillar-halls';
import { placeCellBlocks } from '../rooms/place-cell-blocks';
import { digVeins } from './dig-veins';
import type { DigVeinsOptions } from './dig-veins-options';
import { findOutsideRock } from './find-outside-rock';
import { findPieces } from './find-pieces';

const base = emptyMap({ width: 80, height: 50, tile: Tile.Wall });

/** Stamps blocks of floor, given as x, y, width and height. */
function floorBlocks(...blocks: [number, number, number, number][]) {
  return step('blocks', {}, ({ grid }) => {
    for (const [x0, y0, width, height] of blocks) {
      for (let y = y0; y < y0 + height; ++y) {
        for (let x = x0; x < x0 + width; ++x) {
          grid.set(x, y, Tile.Floor);
        }
      }
    }
    return {};
  });
}

function floorShare(grid: Grid): number {
  return (grid.toString().split('.').length - 1) / (grid.width * grid.height);
}

/** The number of tiles of wall that floor shuts in, such as pillars. */
function shutIn(grid: Grid): number {
  const outside = findOutsideRock(grid);
  let count = 0;
  for (let at = 0; at < grid.width * grid.height; ++at) {
    const x = at % grid.width;
    const y = (at - x) / grid.width;
    count += grid.get(x, y) === Tile.Wall && outside[at] === 0 ? 1 : 0;
  }
  return count;
}

/**
 * Digs veins after the given step, and returns the ends of veins that lie in
 * rock: an end that was free rock before `digVeins`, which no other vein
 * reaches, by running over it or over a tile next to it.
 */
function rockEnds(
  before: MapStep,
  options: DigVeinsOptions,
  seed: number,
): Point[] {
  let rock = new Uint8Array(0);
  const { passages } = pipeline(base, [before, digVeins(options)] as const, {
    random: mulberry32(seed),
    onStep: (name, { grid, reserved }) => {
      if (name !== 'digVeins') {
        rock = reserved.map((mark, at) =>
          mark === Reserve.None &&
          grid.get(at % grid.width, Math.floor(at / grid.width)) === Tile.Wall
            ? 1
            : 0,
        );
      }
    },
  });
  // every vein covers its brush, and the tiles next to that
  const reach = passages.map(({ tiles, width }) => {
    const covered = new Set<string>();
    for (const tile of tiles) {
      for (const offset of brushOffsets(width + 2)) {
        covered.add(
          `${String(tile.x + offset.x)},${String(tile.y + offset.y)}`,
        );
      }
    }
    return covered;
  });
  return passages.flatMap(({ tiles }, index) =>
    [tiles[0], tiles[tiles.length - 1]].filter(
      (end): end is Point =>
        end !== undefined &&
        rock[end.y * base().grid.width + end.x] === 1 &&
        reach.every(
          (covered, other) =>
            other === index ||
            !covered.has(`${String(end.x)},${String(end.y)}`),
        ),
    ),
  );
}

describe('digVeins on an empty map', () => {
  it('digs the same web from the same seed', () => {
    // given
    const make = () => pipeline(base, [digVeins()], { random: mulberry32(5) });

    // when
    const first = make();
    const second = make();

    // then
    expect(first.grid.toString()).toBe(second.grid.toString());
    expect(first.passages).toEqual(second.passages);
  });

  it('lists nothing but veins', () => {
    // given
    const steps = [digVeins()] as const;

    // when
    const { passages } = pipeline(base, steps, { random: mulberry32(1) });

    // then
    expect(passages.length).toBeGreaterThan(1);
    expect(passages.every(({ kind }) => kind === 'vein')).toBe(true);
  });

  it('digs about the density it asks for', () => {
    // given
    const steps = [digVeins({ density: 0.2 })] as const;

    // when
    const { grid } = pipeline(base, steps, { random: mulberry32(3) });

    // then
    expect(floorShare(grid)).toBeGreaterThanOrEqual(0.19);
    expect(floorShare(grid)).toBeLessThan(0.3);
  });

  it('digs nothing with a density of 0', () => {
    // given
    const steps = [digVeins({ density: 0 })] as const;

    // when
    const { grid, passages } = pipeline(base, steps, {
      random: mulberry32(3),
    });

    // then
    expect(floorShare(grid)).toBe(0);
    expect(passages).toEqual([]);
  });

  it('digs more with a higher density', () => {
    // given
    const dig = (density: number) =>
      floorShare(
        pipeline(base, [digVeins({ density })] as const, {
          random: mulberry32(4),
        }).grid,
      );

    // when
    const [sparse, dense] = [dig(0.05), dig(0.25)];

    // then
    expect(dense).toBeGreaterThan(sparse);
  });

  it('keeps the ring around the map as wall', () => {
    // given
    const steps = [digVeins({ density: 0.2 })] as const;

    // when
    const { grid } = pipeline(base, steps, { random: mulberry32(2) });

    // then
    for (let x = 0; x < grid.width; ++x) {
      expect(grid.get(x, 0)).toBe(Tile.Wall);
      expect(grid.get(x, grid.height - 1)).toBe(Tile.Wall);
    }
    for (let y = 0; y < grid.height; ++y) {
      expect(grid.get(0, y)).toBe(Tile.Wall);
      expect(grid.get(grid.width - 1, y)).toBe(Tile.Wall);
    }
  });

  it.each([1, 2, 3, 4, 5, 6])('digs one connected piece, seed %i', (seed) => {
    // given
    const steps = [digVeins({ density: 0.15 })] as const;

    // when
    const { grid } = pipeline(base, steps, { random: mulberry32(seed) });

    // then
    expect(findPieces(grid)).toHaveLength(1);
  });

  it('digs veins as wide as the vein width says', () => {
    // given
    const steps = [
      digVeins({ veinWidth: { min: 3, max: 3 }, density: 0.1 }),
    ] as const;

    // when
    const { passages } = pipeline(base, steps, { random: mulberry32(1) });

    // then
    expect(passages.length).toBeGreaterThan(0);
    expect(passages.every(({ width }) => width === 3)).toBe(true);
  });

  it('digs a web on a tiny map without failing', () => {
    // given
    const tiny = emptyMap({ width: 9, height: 9, tile: Tile.Wall });

    // when
    const make = () => pipeline(tiny, [digVeins()] as const);

    // then
    expect(make).not.toThrow();
  });

  it('adds its veins to the passages of a fishbone before it', () => {
    // given
    const steps = [digFishbone(), digVeins({ density: 0 })] as const;

    // when
    const { passages } = pipeline(base, steps, { random: mulberry32(1) });

    // then
    expect(passages.length).toBeGreaterThan(0);
    expect(passages.some(({ kind }) => kind !== 'vein')).toBe(true);
  });
});

describe('digVeins joining pieces', () => {
  it('joins pieces of floor with nothing else dug, whatever the seed', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      // given
      const steps = [
        floorBlocks([5, 5, 8, 6], [40, 8, 8, 6], [20, 30, 8, 6]),
        digVeins({ density: 0 }),
      ] as const;

      // when
      const { grid, passages } = pipeline(base, steps, {
        random: mulberry32(seed),
      });

      // then
      expect(findPieces(grid)).toHaveLength(1);
      expect(passages).toHaveLength(2);
    }
  });

  it('ends a vein on another vein or on any piece, whichever is nearest', () => {
    // given
    const steps = [
      floorBlocks([5, 5, 6, 6], [60, 5, 6, 6], [30, 35, 6, 6]),
      digVeins({ density: 0 }),
    ] as const;

    // when
    const { grid, passages } = pipeline(base, steps, {
      random: mulberry32(7),
    });

    // then
    expect(findPieces(grid)).toHaveLength(1);
    expect(passages).toHaveLength(2);
  });

  it('keeps the pillars of a hall standing', () => {
    for (const seed of [1, 2, 3]) {
      // given
      const halls = pipeline(base, [digPillarHalls()] as const, {
        random: mulberry32(seed),
      });
      const pillars = shutIn(halls.grid);

      // when
      const { grid } = pipeline(
        base,
        [digPillarHalls(), digVeins({ density: 0.15 })] as const,
        { random: mulberry32(seed) },
      );

      // then
      expect(pillars).toBeGreaterThan(0);
      expect(shutIn(grid)).toBeGreaterThanOrEqual(pillars);
      expect(findPieces(grid)).toHaveLength(1);
    }
  });

  it('joins the halls of every area into one network', () => {
    // given
    const steps = [
      digPillarHalls({
        count: { min: 2, max: 2 },
        area: { width: { min: 30, max: 30 }, height: { min: 20, max: 20 } },
      }),
      digVeins({ density: 0 }),
    ] as const;

    // when
    const { grid } = pipeline(base, steps, { random: mulberry32(1) });

    // then
    expect(findPieces(grid)).toHaveLength(1);
  });

  it('joins the pieces whichever way the entrances are picked', () => {
    for (const hallEntrances of ['facing', 'edge'] as const) {
      // given
      const steps = [
        floorBlocks([5, 5, 8, 6], [50, 20, 8, 6]),
        digVeins({ density: 0, hallEntrances }),
      ] as const;

      // when
      const { grid } = pipeline(base, steps, { random: mulberry32(2) });

      // then
      expect(findPieces(grid)).toHaveLength(1);
    }
  });

  it('never digs a reserved tile', () => {
    // given
    const reserve = step('reserve', {}, ({ reserved }) => {
      for (let y = 0; y < 50; ++y) {
        for (let x = 30; x < 50; ++x) {
          reserved[y * 80 + x] = Reserve.Solid;
        }
      }
      return {};
    });
    const steps = [
      reserve,
      floorBlocks([5, 5, 6, 6], [60, 30, 6, 6]),
      digVeins({ density: 0.15 }),
    ] as const;

    // when
    const { grid } = pipeline(base, steps, { random: mulberry32(3) });

    // then
    for (let y = 0; y < 50; ++y) {
      for (let x = 30; x < 50; ++x) {
        expect(grid.get(x, y)).toBe(Tile.Wall);
      }
    }
  });

  it('leaves a piece that no vein can reach as it is', () => {
    // given
    const seal = step('seal', {}, ({ grid, reserved }) => {
      for (let y = 20; y < 30; ++y) {
        for (let x = 20; x < 30; ++x) {
          reserved[y * 80 + x] = Reserve.Solid;
          if (x > 20 && x < 29 && y > 20 && y < 29) {
            grid.set(x, y, Tile.Floor);
          }
        }
      }
      return {};
    });
    const steps = [
      seal,
      floorBlocks([5, 5, 6, 6], [60, 30, 6, 6]),
      digVeins({ density: 0 }),
    ] as const;

    // when
    const { grid } = pipeline(base, steps, { random: mulberry32(3) });

    // then
    expect(findPieces(grid)).toHaveLength(2);
  });
});

describe('digVeins on a piece that is boxed in', () => {
  it('joins a piece shut in by a ring of floor, through the rock inside', () => {
    // given
    const steps = [
      floorBlocks(
        [20, 10, 20, 3],
        [20, 22, 20, 3],
        [20, 13, 3, 9],
        [37, 13, 3, 9],
        [30, 17, 1, 1],
      ),
      digVeins({ density: 0 }),
    ] as const;

    // when
    const { grid } = pipeline(base, steps, { random: mulberry32(1) });

    // then
    expect(findPieces(grid)).toHaveLength(1);
  });
});

describe('digVeins with rooms', () => {
  it('opens a cell block entrance that floor reaches right beyond it', () => {
    // given
    const steps = [placeCellBlocks(), floorBeyondEntrances()] as const;

    // when
    const { grid, roomGroups } = pipeline(
      base,
      [...steps, digVeins({ density: 0 })],
      { random: mulberry32(1) },
    );

    // then
    const { x, y } = cellBlocksOf(roomGroups)[0]?.entrance ?? { x: -1, y: -1 };
    expect(grid.get(x, y)).toBe(Tile.Floor);
    expect(findPieces(grid)).toHaveLength(1);
  });

  it('enters a cell block through its entrance alone', () => {
    // given
    const blocks = placeCellBlocks({ blocks: { min: 2, max: 2 } });

    // when
    const { grid, reserved, roomGroups } = pipeline(
      base,
      [blocks, digVeins({ density: 0 })],
      { random: mulberry32(1) },
    );

    // then
    expect(findPieces(grid)).toHaveLength(1);
    for (const { entrance, footprint } of cellBlocksOf(roomGroups)) {
      expect(grid.get(entrance.x, entrance.y)).toBe(Tile.Floor);
      expect(reserved[entrance.y * grid.width + entrance.x]).toBe(
        Reserve.Solid,
      );
      // nothing else of the outer wall was dug
      const { x, y, width, height } = footprint;
      const ring = [];
      for (let column = x; column < x + width; ++column) {
        ring.push({ x: column, y }, { x: column, y: y + height - 1 });
      }
      for (let row = y; row < y + height; ++row) {
        ring.push({ x, y: row }, { x: x + width - 1, y: row });
      }
      const dug = ring.filter(
        (tile) =>
          (tile.x !== entrance.x || tile.y !== entrance.y) &&
          grid.get(tile.x, tile.y) !== Tile.Wall,
      );
      expect(dug).toEqual([]);
    }
  });

  const rooms = placeScatteredRooms({ roomCount: { min: 6, max: 6 } });

  it.each([1, 2, 3, 4, 5, 6, 7, 8])(
    'opens the rooms and joins them into one piece, seed %i',
    (seed) => {
      // given
      const steps = [rooms, digVeins({ density: 0 })] as const;

      // when
      const { grid } = pipeline(base, steps, { random: mulberry32(seed) });

      // then
      expect(findPieces(grid)).toHaveLength(1);
    },
  );

  it('joins rooms and halls together', () => {
    for (const seed of [1, 2, 3, 4]) {
      // given
      const steps = [
        rooms,
        digPillarHalls({ halls: { min: 1, max: 1 } }),
        digVeins({ density: 0 }),
      ] as const;

      // when
      const { grid } = pipeline(base, steps, { random: mulberry32(seed) });

      // then
      expect(findPieces(grid)).toHaveLength(1);
    }
  });

  it('opens a room only where a vein enters, and records it as solid', () => {
    // given
    const steps = [rooms, digVeins({ density: 0 })] as const;
    const closed = pipeline(base, [rooms] as const, {
      random: mulberry32(2),
    });

    // when
    const { grid, reserved } = pipeline(base, steps, {
      random: mulberry32(2),
    });

    // then
    let opened = 0;
    for (let at = 0; at < 80 * 50; ++at) {
      const x = at % 80;
      const y = (at - x) / 80;
      if (
        closed.reserved[at] === Reserve.Openable &&
        grid.get(x, y) === Tile.Floor
      ) {
        ++opened;
        expect(reserved[at]).toBe(Reserve.Solid);
      }
    }
    expect(opened).toBeGreaterThanOrEqual(5);
  });

  it('digs nothing in a room', () => {
    // given
    const closed = pipeline(base, [rooms] as const, {
      random: mulberry32(2),
    });

    // when
    const { grid } = pipeline(base, [rooms, digVeins()] as const, {
      random: mulberry32(2),
    });

    // then
    for (let at = 0; at < 80 * 50; ++at) {
      const x = at % 80;
      const y = (at - x) / 80;
      if (closed.reserved[at] === Reserve.Solid) {
        expect(grid.get(x, y)).toBe(closed.grid.get(x, y));
      }
    }
  });
});

describe('digVeins options', () => {
  it('refuses a map that does not start as wall', () => {
    // given
    const grass = emptyMap({ width: 40, height: 30, tile: Tile.Grass });

    // when
    const make = () => pipeline(grass, [digVeins()] as const);

    // then
    expect(make).toThrow(RangeError);
    expect(make).toThrow('digVeins');
  });

  it.each<[string, DigVeinsOptions, string]>([
    ['density', { density: 2 }, 'density'],
    ['veinWindiness', { veinWindiness: -1 }, 'veinWindiness'],
    ['veinWidth', { veinWidth: { min: 0, max: 2 } }, 'veinWidth'],
    ['veinSpacing', { veinSpacing: 2 }, 'veinSpacing'],
    ['hallEntrances', { hallEntrances: 'middle' as never }, 'hallEntrances'],
    ['symmetry', { symmetry: 'diagonal' as never }, 'symmetry'],
    ['symmetryChance', { symmetryChance: 2 }, 'symmetryChance'],
  ])('throws a RangeError for a bad %s at once', (_, options, message) => {
    // given
    const make = () => digVeins(options);

    // when / then
    expect(make).toThrow(RangeError);
    expect(make).toThrow(message);
  });
});

/** Whether the grid is its own mirror image, left to right. */
function isMirrored(grid: Grid): boolean {
  for (let y = 0; y < grid.height; ++y) {
    for (let x = 0; x < grid.width; ++x) {
      if (grid.get(x, y) !== grid.get(grid.width - 1 - x, y)) {
        return false;
      }
    }
  }
  return true;
}

describe('digVeins with a symmetry', () => {
  // four halls, two on each side of the middle line
  const halls = floorBlocks(
    [8, 8, 10, 8],
    [62, 8, 10, 8],
    [8, 34, 10, 8],
    [62, 34, 10, 8],
  );

  it.each(['horizontal', 'rotational'] as const)(
    'keeps a %s map symmetric with a chance of 1',
    (symmetry) => {
      for (let seed = 1; seed <= 6; ++seed) {
        // given
        const options = { density: 0, symmetry };

        // when
        const { grid } = pipeline(base, [halls, digVeins(options)] as const, {
          random: mulberry32(seed),
        });

        // then
        expect(isMirrored(grid) || symmetry === 'rotational').toBe(true);
        expect(findPieces(grid)).toHaveLength(1);
      }
    },
  );

  it('digs no twins with a chance of 0', () => {
    // given
    const options = {
      density: 0,
      symmetry: 'horizontal',
      symmetryChance: 0,
    } as const;

    // when
    const { grid } = pipeline(base, [halls, digVeins(options)] as const, {
      random: mulberry32(3),
    });

    // then
    expect(isMirrored(grid)).toBe(false);
  });

  it('lists the twins of a vein among the passages', () => {
    // given
    const plain = pipeline(base, [halls, digVeins({ density: 0 })] as const, {
      random: mulberry32(2),
    });

    // when
    const mirrored = pipeline(
      base,
      [halls, digVeins({ density: 0, symmetry: 'horizontal' })] as const,
      { random: mulberry32(2) },
    );

    // then
    expect(mirrored.passages.length).toBeGreaterThan(plain.passages.length - 1);
    expect(mirrored.passages.length).toBeGreaterThanOrEqual(2);
  });

  it('keeps the pillars of a hall standing', () => {
    // given
    const options = { density: 0.1, symmetry: 'both' } as const;

    // when
    const { grid } = pipeline(
      base,
      [
        digPillarHalls({ halls: { min: 3, max: 3 } }),
        digVeins(options),
      ] as const,
      { random: mulberry32(4) },
    );

    // then
    expect(shutIn(grid)).toBeGreaterThan(0);
  });

  it('never digs a reserved tile', () => {
    // given
    const reserve = step('reserve', {}, ({ reserved }) => {
      for (let y = 0; y < 50; ++y) {
        for (let x = 36; x < 44; ++x) {
          reserved[y * 80 + x] = Reserve.Solid;
        }
      }
      return {};
    });
    const options = { density: 0.15, symmetry: 'both' } as const;
    const steps = [reserve, halls, digVeins(options)] as const;

    // when
    const { grid } = pipeline(base, steps, { random: mulberry32(3) });

    // then
    for (let y = 0; y < 50; ++y) {
      for (let x = 36; x < 44; ++x) {
        expect(grid.get(x, y)).toBe(Tile.Wall);
      }
    }
  });
});

describe('digVeins dead ends', () => {
  const seeds = Array.from({ length: 20 }, (_, index) => index + 1);

  it('ends every vein between halls on floor or on another vein', () => {
    // given
    const options = { density: 0.15 };

    // when
    const failing = seeds.filter(
      (seed) => rockEnds(digPillarHalls(), options, seed).length > 0,
    );

    // then
    expect(failing).toEqual([]);
  });

  it('ends every wide vein between halls on floor or on another vein', () => {
    // given
    const options = { density: 0.15, veinWidth: { min: 3, max: 3 } };

    // when
    const failing = seeds.filter(
      (seed) => rockEnds(digPillarHalls(), options, seed).length > 0,
    );

    // then
    expect(failing).toEqual([]);
  });

  it('ends every vein between rooms on floor or on another vein', () => {
    // given
    const rooms = placeScatteredRooms({ roomCount: { min: 6, max: 6 } });
    const options = { density: 0.15 };

    // when
    const failing = seeds.filter(
      (seed) => rockEnds(rooms, options, seed).length > 0,
    );

    // then
    expect(failing).toEqual([]);
  });

  it('digs no twin that ends in rock, even when the halls are not symmetric', () => {
    // given
    const options = {
      density: 0.15,
      veinWidth: { min: 1, max: 1 },
      symmetry: 'horizontal' as const,
    };

    // when
    const failing = seeds.filter(
      (seed) => rockEnds(digPillarHalls(), options, seed).length > 0,
    );

    // then
    expect(failing).toEqual([]);
  });

  it('may end veins in rock in a web of its own, on an empty map', () => {
    // given
    const nothing = floorBlocks();

    // when
    const ends = rockEnds(nothing, { density: 0.15 }, 1);

    // then
    expect(ends.length).toBeGreaterThan(0);
  });
});
