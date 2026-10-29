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

/** How many random spots are tried for a block. */
const SPOT_ATTEMPTS = 100;

/** The options of the guard room, with the defaults filled in. */
export interface GuardRoomSettings {
  chance: number;
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
  /** The guard room beside the tunnel, for a block that has one. */
  guardRoom?: { floor: Area; door: Point };
  /** The floor of the tunnel from the end of the corridor to the entrance, for a block with a guard room. */
  tunnel?: Area;
}

/** A box in the coordinates of the block, from its lowest corner to its highest, both included. */
type Span = readonly [u1: number, v1: number, u2: number, v2: number];

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
 * A block with a guard room gets a tunnel, one tile wide, from that end of the
 * corridor outwards, past the door of the guard room that stands beside it.
 * The wall between the corridor and the tunnel becomes a door, and the
 * entrance moves to the wall beyond the tunnel. The guard room and the tunnel,
 * with their walls, are reserved `Solid` and need a free ring too.
 *
 * The block is built along `u` (the corridor) and across it along `v`, then
 * turned onto the map: a vertical block swaps the two.
 */
export function layCellBlock(
  state: MapState,
  random: Random,
  settings: CellBlockSettings,
): CellBlock {
  const width = randomInt(
    random,
    settings.cellWidth.min,
    settings.cellWidth.max,
  );
  const depth = randomInt(
    random,
    settings.cellDepth.min,
    settings.cellDepth.max,
  );
  const perSide = randomInt(
    random,
    settings.cellsPerSide.min,
    settings.cellsPerSide.max,
  );
  const sides = randomInt(random, settings.sides.min, settings.sides.max);
  const corridorWidth = randomInt(
    random,
    settings.corridorWidth.min,
    settings.corridorWidth.max,
  );
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
  const entranceRow = randomInt(random, 0, corridorWidth - 1);

  // from the outer wall: the cells, their fronts, the corridor and, on a
  // second side, the fronts and cells again, then the outer wall
  const length = perSide * (width + 1) + 1;
  const across = sides * (depth + 1) + corridorWidth + 2;
  const firstFront = depth + 1;
  const corridorStart = depth + 2;
  const secondFront = corridorStart + corridorWidth;

  const gate = {
    u: entranceAtStart ? 0 : length - 1,
    v: corridorStart + entranceRow,
  };
  const outward = entranceAtStart ? -1 : 1;
  // k tiles out from the end of the corridor
  const out = (k: number) => gate.u + k * outward;

  const blockSpan = span(0, 0, length - 1, across - 1);
  const guard = settings.guardRoom && layGuardRoom(random, settings.guardRoom);
  // the guard room, its walls included, and the tunnel between its walls
  const guardSpans = guard && {
    room: span(
      out(1),
      gate.v + guard.side,
      out(guard.width + 2),
      gate.v + guard.side * (guard.depth + 2),
    ),
    tunnel: span(out(1), gate.v - 1, out(guard.tunnel + 1), gate.v + 1),
  };
  const spans = guardSpans
    ? [blockSpan, guardSpans.room, guardSpans.tunnel]
    : [blockSpan];
  const entrance = guard ? { u: out(guard.tunnel + 1), v: gate.v } : gate;

  const uMin = Math.min(...spans.map(([u]) => u));
  const vMin = Math.min(...spans.map(([, v]) => v));
  const uMax = Math.max(...spans.map(([, , u]) => u));
  const vMax = Math.max(...spans.map(([, , , v]) => v));
  const [along, wide] = [uMax - uMin + 1, vMax - vMin + 1];
  const size = vertical
    ? { width: wide, height: along }
    : { width: along, height: wide };

  const { width: mapWidth, height: mapHeight } = state.grid;
  const spotsX = mapWidth - size.width - 2;
  const spotsY = mapHeight - size.height - 2;
  for (
    let attempt = 0;
    attempt < SPOT_ATTEMPTS && spotsX >= 0 && spotsY >= 0;
    ++attempt
  ) {
    const origin = {
      x: 1 + randomInt(random, 0, spotsX),
      y: 1 + randomInt(random, 0, spotsY),
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
      floor: box(
        span(
          out(2),
          gate.v + guard.side * 2,
          out(guard.width + 1),
          gate.v + guard.side * (guard.depth + 1),
        ),
      ),
      door: toMap(out(2 + guard.doorAt), gate.v + guard.side),
    };
    const tunnel =
      guard && box(span(out(1), gate.v, out(guard.tunnel), gate.v));
    if (guardRoom && tunnel) {
      floors.push(guardRoom.floor, tunnel);
      fixedDoors.push(guardRoom.door, toMap(gate.u, gate.v));
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
      ...(guardRoom && tunnel ? { guardRoom, tunnel } : {}),
    };
  }
  throw new Error(
    `No free spot for a cell block of ${String(size.width)} by ${String(size.height)} tiles in an area of ${String(mapWidth)} by ${String(mapHeight)} after ${String(SPOT_ATTEMPTS)} tries. Make the cells smaller or fewer, give the blocks a bigger area, or place them before the steps that fill the map.`,
  );
}

/**
 * Draws the guard room of a block, or none by its chance: the size of its
 * floor, the side of the tunnel it stands on (-1 or 1 along `v`), where its
 * door sits counted from the block, and how many tiles the tunnel runs from
 * the end of the corridor to the entrance, which is past that door.
 */
function layGuardRoom(random: Random, settings: GuardRoomSettings) {
  if (random() >= settings.chance) {
    return undefined;
  }
  const width = randomInt(random, settings.width.min, settings.width.max);
  const depth = randomInt(random, settings.depth.min, settings.depth.max);
  const side = random() < 0.5 ? -1 : 1;
  const doorAt = Math.floor((width - 1) / 2);
  const past = randomInt(random, settings.tunnel.min, settings.tunnel.max);
  return { width, depth, side, doorAt, tunnel: 2 + doorAt + past };
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
