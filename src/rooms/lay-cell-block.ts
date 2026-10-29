import type { Area } from '../core/area';
import type { Point } from '../core/point';
import type { Random } from '../core/random';
import { randomInt } from '../core/random-int';
import type { Range } from '../core/range';
import { Tile } from '../core/tile';
import { isFree } from '../pipeline/is-free';
import type { MapState } from '../pipeline/map-state';
import { Reserve } from '../pipeline/reserve';
import { reserveTile } from '../pipeline/reserve-tile';
import type { Placement } from './dungeon-options';

/** How many random spots are tried for a block. */
const SPOT_ATTEMPTS = 100;

/** The options of the guard room, with the defaults filled in. */
export interface GuardRoomSettings {
  chance: number;
  placement: 'beside' | 'through' | 'any';
  width: Range;
  depth: Range;
  tunnel: Range;
}

/** The options of `placeCellBlocks` that shape one block, with the defaults filled in. */
export interface CellBlockSettings {
  cellWidth: Range;
  cellDepth: Range;
  cellsPerSide: Range;
  sides: Range;
  corridorWidth: Range;
  orientation: 'horizontal' | 'vertical' | 'any';
  cellDoors: 'centered' | 'jittered';
  placement: Placement;
  /** Absent for blocks without a guard room. */
  guardRoom?: GuardRoomSettings;
}

/** A block that `layCellBlock` laid, in the coordinates of the state it was given. */
export interface CellBlock {
  footprint: Area;
  corridor: Area;
  entrance: Point;
  /** The floor of every cell, the cells of one side first, along the corridor. */
  cells: Area[];
  /** The door of every cell, in the order of `cells`. */
  doors: Point[];
  /** The guard room, for a block that has one, with its door onto the tunnel or the corridor. */
  guardRoom?: { floor: Area; door: Point };
  /** The floor of the tunnel from the end of the corridor to the entrance, for a block with a guard room beside it. */
  tunnel?: Area;
}

/** A box in the coordinates of the block, from its lowest corner to its highest, both included. */
type Span = readonly [u1: number, v1: number, u2: number, v2: number];

/** A tile in the coordinates of the block. */
interface Spot {
  u: number;
  v: number;
}

/** Where a guard room goes, in the coordinates of the block. */
interface GuardRoomPlan {
  /** The boxes it reserves `Solid`, walls included. */
  spans: Span[];
  floor: Span;
  door: Spot;
  entrance: Spot;
  /** The floor of the tunnel, for a guard room beside it. */
  tunnel?: Span;
}

/**
 * Lays one cell block on a random free spot of the state: identical cells
 * that share their walls, along a straight corridor, on one side or both. The
 * sizes are drawn first, then up to 100 spots are tried, each needing the
 * footprint and a ring of one tile round it free (see `isFree`), and the two
 * tiles beyond the entrance free too and a third on the map, so that a
 * corridor or a vein can reach it. It
 * carves the floor and the doors, reserves the whole footprint `Solid` and the
 * entrance, a wall at one end of the corridor, `Openable`. Throws an ordinary
 * `Error` when no spot is found, which `pipeline` answers with a new map.
 *
 * A block with a guard room beside it gets a tunnel, one tile wide, from that
 * end of the corridor outwards, past the door of the guard room that stands
 * beside it. The wall between the corridor and the tunnel becomes a door, and
 * the entrance moves to the wall beyond the tunnel. A guard room through which
 * the block is entered stands against that end of the block instead, centered
 * on the entrance row, with a door in the end wall and the entrance in its far
 * wall, opposite. The guard room and the tunnel, with their walls, are
 * reserved `Solid` and need a free ring too.
 *
 * On the `'lattice'` placement the walls of the block, the guard room and the
 * tunnel fall on even coordinates and their floors on odd ones: the sizes are
 * narrowed to odd numbers, the footprint starts on even coordinates, the
 * entrance sits on an odd row of the corridor and the tunnel has an odd
 * length, so the tile beyond the entrance is odd on both axes. A guard room
 * beside the tunnel then shares the block's end wall instead of standing a
 * wall apart.
 *
 * The block is built along `u` (the corridor) and across it along `v`, then
 * turned onto the map: a vertical block swaps the two.
 */
export function layCellBlock(
  state: MapState,
  random: Random,
  settings: CellBlockSettings,
): CellBlock {
  const lattice = settings.placement === 'lattice';
  // walls on even coordinates and floors on odd ones need odd sizes
  const odd = lattice ? 1 : undefined;
  const width = drawSize(random, settings.cellWidth, odd);
  const depth = drawSize(random, settings.cellDepth, odd);
  const perSide = randomInt(
    random,
    settings.cellsPerSide.min,
    settings.cellsPerSide.max,
  );
  const sides = randomInt(random, settings.sides.min, settings.sides.max);
  const corridorWidth = drawSize(random, settings.corridorWidth, odd);
  const vertical =
    settings.orientation === 'any'
      ? random() < 0.5
      : settings.orientation === 'vertical';
  const doorAt =
    settings.cellDoors === 'centered'
      ? Math.floor((width - 1) / 2)
      : randomInt(random, 0, width - 1);
  // a block of one side has its cells past the corridor instead
  const flipped = sides === 1 && random() < 0.5;
  const entranceAtStart = random() < 0.5;
  // on the lattice an even row of the corridor, which starts on an odd one
  const entranceRow = drawSize(
    random,
    { min: 0, max: corridorWidth - 1 },
    lattice ? 0 : undefined,
  );

  // from the outer wall: the cells, their fronts, the corridor and, on a
  // second side, the fronts and cells again, then the outer wall
  const length = perSide * (width + 1) + 1;
  const across = sides * (depth + 1) + corridorWidth + 2;
  const firstFront = depth + 1;
  const corridorStart = depth + 2;
  const secondFront = corridorStart + corridorWidth;

  const gate: Spot = {
    u: entranceAtStart ? 0 : length - 1,
    v: corridorStart + entranceRow,
  };
  const outward = entranceAtStart ? -1 : 1;
  // k tiles out from the end of the corridor
  const out = (k: number) => gate.u + k * outward;

  const blockSpan = span(0, 0, length - 1, across - 1);
  const guard =
    settings.guardRoom &&
    layGuardRoom(random, settings.guardRoom, lattice, gate, out);
  const spans = guard ? [blockSpan, ...guard.spans] : [blockSpan];
  const entrance = guard?.entrance ?? gate;

  const uMin = Math.min(...spans.map(([u]) => u));
  const vMin = Math.min(...spans.map(([, v]) => v));
  const uMax = Math.max(...spans.map(([, , u]) => u));
  const vMax = Math.max(...spans.map(([, , , v]) => v));
  const [along, wide] = [uMax - uMin + 1, vMax - vMin + 1];
  const size = vertical
    ? { width: wide, height: along }
    : { width: along, height: wide };

  const { width: mapWidth, height: mapHeight } = state.grid;
  // where the footprint starts in the box of the block, guard room included
  const footAlong = -uMin;
  const footAcross = flipped ? vMax - (across - 1) : -vMin;
  const spotsX = pickOrigins(
    mapWidth - size.width - 2,
    vertical ? footAcross : footAlong,
    lattice,
  );
  const spotsY = pickOrigins(
    mapHeight - size.height - 2,
    vertical ? footAlong : footAcross,
    lattice,
  );
  for (
    let attempt = 0;
    attempt < SPOT_ATTEMPTS && spotsX && spotsY;
    ++attempt
  ) {
    const origin = {
      x: spotsX.first + spotsX.step * randomInt(random, 0, spotsX.count - 1),
      y: spotsY.first + spotsY.step * randomInt(random, 0, spotsY.count - 1),
    };
    const toMap = (u: number, v: number): Point => {
      const w = flipped ? vMax - v : v - vMin;
      return vertical
        ? { x: origin.x + w, y: origin.y + u - uMin }
        : { x: origin.x + u - uMin, y: origin.y + w };
    };
    const box = ([u1, v1, u2, v2]: Span): Area => {
      const a = toMap(u1, v1);
      const b = toMap(u2, v2);
      return {
        x: Math.min(a.x, b.x),
        y: Math.min(a.y, b.y),
        width: Math.abs(b.x - a.x) + 1,
        height: Math.abs(b.y - a.y) + 1,
      };
    };
    const reserved = spans.map(box);
    // a vein needs its way in two tiles off the edge of the map
    const [first, second, third] = [1, 2, 3].map((k) =>
      toMap(entrance.u + k * outward, entrance.v),
    ) as [Point, Point, Point];
    if (
      !reserved.every((part) => isClear(state, part)) ||
      !isFree(state, first.x, first.y) ||
      !isFree(state, second.x, second.y) ||
      !state.grid.inBounds(third.x, third.y)
    ) {
      continue;
    }

    const cells: Area[] = [];
    const doors: Point[] = [];
    const fronts = sides === 2 ? [firstFront, secondFront] : [firstFront];
    for (const front of fronts) {
      for (let i = 0; i < perSide; ++i) {
        const u = 1 + i * (width + 1);
        const v = front === firstFront ? 1 : front + 1;
        cells.push(box(span(u, v, u + width - 1, v + depth - 1)));
        doors.push(toMap(u + doorAt, front));
      }
    }
    const corridor = box(
      span(1, corridorStart, length - 2, corridorStart + corridorWidth - 1),
    );
    const floors = [...cells, corridor];
    const fixedDoors = [...doors];
    const guardRoom = guard && {
      floor: box(guard.floor),
      door: toMap(guard.door.u, guard.door.v),
    };
    const tunnel = guard?.tunnel && box(guard.tunnel);
    if (guardRoom) {
      floors.push(guardRoom.floor);
      fixedDoors.push(guardRoom.door);
    }
    if (tunnel) {
      // the door from the corridor into the tunnel
      floors.push(tunnel);
      fixedDoors.push(toMap(gate.u, gate.v));
    }

    for (const part of reserved) {
      for (let y = part.y; y < part.y + part.height; ++y) {
        for (let x = part.x; x < part.x + part.width; ++x) {
          reserveTile(state, x, y, Reserve.Solid);
        }
      }
    }
    for (const floor of floors) {
      for (let y = floor.y; y < floor.y + floor.height; ++y) {
        for (let x = floor.x; x < floor.x + floor.width; ++x) {
          state.grid.set(x, y, Tile.Floor);
        }
      }
    }
    for (const { x, y } of fixedDoors) {
      state.grid.set(x, y, Tile.Door);
    }
    const way = toMap(entrance.u, entrance.v);
    reserveTile(state, way.x, way.y, Reserve.Openable);
    return {
      footprint: box(blockSpan),
      corridor,
      entrance: way,
      cells,
      doors,
      ...(guardRoom && { guardRoom }),
      ...(tunnel && { tunnel }),
    };
  }
  throw new Error(
    `No free spot for a cell block of ${String(size.width)} by ${String(size.height)} tiles in an area of ${String(mapWidth)} by ${String(mapHeight)} after ${String(SPOT_ATTEMPTS)} tries. Make the cells smaller or fewer, give the blocks a bigger area, or place them before the steps that fill the map.`,
  );
}

/**
 * Draws the guard room of a block, or none by its chance, and plans it
 * against `gate`, the wall at the end of the corridor, `out(k)` being `k`
 * tiles out from it. On the lattice its sizes are odd.
 *
 * Beside the tunnel: it stands on a side of the tunnel drawn at random, its
 * near wall a tile out from the end wall, or on the lattice the end wall
 * itself, and its door centered on the wall it shares with the tunnel. The
 * tunnel runs `tunnel` tiles past that door, its length odd on the lattice, and
 * the entrance is the wall beyond it.
 *
 * Through it: it stands against the end wall, its door there, at the end of
 * the corridor, and the entrance opposite in its far wall. Its floor is
 * centered on the entrance row, a tile off to either side on the lattice when
 * the floor would start on an even row.
 */
function layGuardRoom(
  random: Random,
  settings: GuardRoomSettings,
  lattice: boolean,
  gate: Spot,
  out: (k: number) => number,
): GuardRoomPlan | undefined {
  if (random() >= settings.chance) {
    return undefined;
  }
  const odd = lattice ? 1 : undefined;
  const width = drawSize(random, settings.width, odd);
  const depth = drawSize(random, settings.depth, odd);
  const through =
    settings.placement === 'any'
      ? random() < 0.5
      : settings.placement === 'through';
  if (through) {
    const half = Math.floor((depth - 1) / 2);
    // the first row of the floor, odd on the lattice as the entrance row is
    const top =
      gate.v -
      half +
      (lattice && half % 2 === 1 ? (random() < 0.5 ? -1 : 1) : 0);
    return {
      spans: [span(out(0), top - 1, out(width + 1), top + depth)],
      floor: span(out(1), top, out(width), top + depth - 1),
      door: gate,
      entrance: { u: out(width + 1), v: gate.v },
    };
  }
  const side = random() < 0.5 ? -1 : 1;
  const near = lattice ? 0 : 1;
  const doorAt = Math.floor((width - 1) / 2);
  // an odd tunnel, 1 + doorAt + past, needs past of the parity of doorAt
  const past = drawSize(
    random,
    settings.tunnel,
    lattice ? doorAt % 2 : undefined,
  );
  const tunnel = near + 1 + doorAt + past;
  return {
    spans: [
      span(
        out(near),
        gate.v + side,
        out(near + width + 1),
        gate.v + side * (depth + 2),
      ),
      span(out(1), gate.v - 1, out(tunnel + 1), gate.v + 1),
    ],
    floor: span(
      out(near + 1),
      gate.v + side * 2,
      out(near + width),
      gate.v + side * (depth + 1),
    ),
    door: { u: out(near + 1 + doorAt), v: gate.v + side },
    entrance: { u: out(tunnel + 1), v: gate.v },
    tunnel: span(out(1), gate.v, out(tunnel), gate.v),
  };
}

/**
 * Draws a whole number from the range, or, given a `parity`, one of that
 * parity (0 for even, 1 for odd); a range with none of it gives the next one
 * up from its `min`, as an even-only room size is rounded up.
 */
function drawSize(random: Random, range: Range, parity?: number): number {
  if (parity === undefined) {
    return randomInt(random, range.min, range.max);
  }
  const min = range.min + (Math.abs(range.min - parity) % 2);
  const max = Math.max(min, range.max - (Math.abs(range.max - parity) % 2));
  return min + 2 * randomInt(random, 0, (max - min) / 2);
}

/**
 * The origins a box of the block may take along one axis, a ring of one tile
 * off the edge of the map: `spots` + 1 of them from 1, or, on the lattice,
 * those that put the footprint, `offset` tiles into the box, on an even
 * coordinate. Returns `undefined` when there are none.
 */
function pickOrigins(
  spots: number,
  offset: number,
  lattice: boolean,
): { first: number; step: number; count: number } | undefined {
  const first = lattice && (1 + offset) % 2 === 1 ? 2 : 1;
  const step = lattice ? 2 : 1;
  const count = Math.floor((1 + spots - first) / step) + 1;
  return spots >= 0 && count > 0 ? { first, step, count } : undefined;
}

/** The box between two corners, given in any order. */
function span(u1: number, v1: number, u2: number, v2: number): Span {
  return [
    Math.min(u1, u2),
    Math.min(v1, v2),
    Math.max(u1, u2),
    Math.max(v1, v2),
  ];
}

/** Whether the box and a ring of one tile round it are free. */
function isClear(state: MapState, box: Area): boolean {
  for (let y = box.y - 1; y <= box.y + box.height; ++y) {
    for (let x = box.x - 1; x <= box.x + box.width; ++x) {
      if (!isFree(state, x, y)) {
        return false;
      }
    }
  }
  return true;
}
