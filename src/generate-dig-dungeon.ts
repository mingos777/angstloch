import { assertFraction } from './assert-fraction';
import { assertRange } from './assert-range';
import { carveRoom } from './carve-room';
import { createRoomPlan } from './create-room-plan';
import { digCorridor } from './dig-corridor';
import type { DigDungeonOptions } from './dig-dungeon-options';
import { createDungeonBuilder } from './dungeon-builder';
import { touching } from './dungeon-builder';
import type { ExitSlot } from './dungeon-builder';
import type { DungeonResult } from './dungeon-result';
import { Grid } from './grid';
import { pickDirection } from './pick-direction';
import { pickRandom } from './pick-random';
import { pickRoomSize } from './pick-room-size';
import type { Point } from './point';
import { randomInt } from './random-int';
import { resolveDungeonOptions } from './resolve-dungeon-options';
import type { Room } from './room';
import { EDGE_CLEARANCE } from './room-plan';
import { roomBeyond } from './room-beyond';
import { roomsConflict } from './rooms-conflict';
import { DIRECTIONS } from './directions';

/** Failed attempts in a row after which rooms may have more exits than they wanted, so that digging can go on. */
const STALLED_AFTER = 20;

/** Failed attempts in a row after which the map counts as full. */
const MAX_FAILURES = 300;

/**
 * Generates a dungeon by digging: it starts with a room in the middle and
 * keeps digging a corridor from a room or from another corridor, and putting a
 * room at the end of it, until there are enough rooms. Corridors that find no
 * space for a room are filled in again. Afterwards rooms get the exits they
 * want, and loops and dead ends are added.
 */
export function generateDigDungeon(options: DigDungeonOptions): DungeonResult {
  const resolved = resolveDungeonOptions(options);
  const { width, height, random, placement, roomCount, fill } = resolved;
  const corridorLength = options.corridorLength ?? { min: 1, max: 8 };
  const branchChance = options.branchChance ?? 0.3;
  assertRange('corridorLength', corridorLength, 0);
  assertFraction('branchChance', branchChance);

  const grid = new Grid(width, height);
  const rooms: Room[] = [];
  const plan = createRoomPlan({
    ...resolved,
    spacingUniformity: 0,
  });
  if (!plan || roomCount.max === 0) {
    return { grid, rooms, exits: [], fill: 0 };
  }

  const lattice = placement === 'lattice';
  const builder = createDungeonBuilder(grid, rooms, random, {
    ...resolved,
    lattice,
  });
  const settings = { ...resolved, lattice };
  let covered = 0;

  const addRoom = (room: Room): Room => {
    const placed = { ...room, id: rooms.length };
    rooms.push(placed);
    carveRoom(grid, placed);
    builder.registerRoom(placed);
    covered += placed.width * placed.height;
    return placed;
  };

  const pickSize = (): { width: number; height: number } => ({
    width: pickRoomSize(random, plan.widths, plan.step, plan.sizeUniformity),
    height: pickRoomSize(random, plan.heights, plan.step, plan.sizeUniformity),
  });

  const first = pickSize();
  const centre = (size: number, mapSize: number): number => {
    const x = Math.max(EDGE_CLEARANCE, Math.floor((mapSize - size) / 2));
    return plan.step === 2 && x % 2 === 0 ? x - 1 : x;
  };
  addRoom({
    id: 0,
    x: centre(first.width, width),
    y: centre(first.height, height),
    ...first,
    exits: [],
    exitCount: 0,
    doorCount: 0,
  });

  /** Whether a new room fits where it is, apart from the corridor that leads to it. */
  const fits = (room: Room, dug: ReadonlySet<number>): boolean => {
    if (
      room.x < EDGE_CLEARANCE ||
      room.y < EDGE_CLEARANCE ||
      room.x + room.width > width - EDGE_CLEARANCE ||
      room.y + room.height > height - EDGE_CLEARANCE ||
      rooms.some((other) => roomsConflict(other, room, plan.spacing))
    ) {
      return false;
    }
    // neither the room nor the wall around it may hold a corridor
    for (let y = room.y - 1; y <= room.y + room.height; ++y) {
      for (let x = room.x - 1; x <= room.x + room.width; ++x) {
        const index = y * width + x;
        if (builder.map.corridor[index] === 1 || dug.has(index)) {
          return false;
        }
      }
    }
    return true;
  };

  /** Digs a corridor from a room or a corridor to a new room, and returns whether there was space for both. */
  const grow = (stalled: boolean): boolean => {
    const hasCorridors = builder.corridors.length > 0;
    let wanting = rooms.filter((room) => !builder.atCapacity(room));
    if (wanting.length === 0 && (!hasCorridors || stalled)) {
      // growth would stop for good, so rooms exceed the exits they wanted
      wanting = rooms;
    }
    const branching =
      hasCorridors && (wanting.length === 0 || random() < branchChance);

    const direction = pickDirection(
      random,
      resolved.horizontalBias,
      resolved.verticalBias,
    );
    const length = randomInt(random, corridorLength.min, corridorLength.max);
    const steps = lattice ? Math.ceil(length / 2) : length;

    let parent: Room;
    let slot: ExitSlot | undefined;
    let origin: Point;
    if (branching) {
      const corridor = pickRandom(random, builder.corridors);
      const tiles = corridor.filter(
        ({ x, y }) => !lattice || (x % 2 === 1 && y % 2 === 1),
      );
      if (tiles.length === 0 || steps === 0) {
        return false;
      }
      origin = pickRandom(random, tiles);
      parent = rooms[builder.ownerOf(origin)] as Room;
    } else {
      parent = pickRandom(random, wanting);
      const slots = builder.slotsOf(parent, direction);
      if (slots.length === 0) {
        return false;
      }
      slot = pickRandom(random, slots);
      origin = slot.exit;
    }

    const size = pickSize();
    if (steps === 0) {
      // the new room is built right against the wall of its parent
      if (!slot) {
        return false;
      }
      const room = roomBeyond(
        random,
        slot.exit,
        direction,
        size.width,
        size.height,
        plan.step,
      );
      if (!fits(room, new Set())) {
        return false;
      }
      const placed = addRoom(room);
      builder.addExit(slot.exit, [parent.id, placed.id]);
      builder.link(parent, placed);
      builder.join(parent.id, placed.id);
      return true;
    }

    const dug = digCorridor(
      builder.map,
      random,
      settings,
      origin,
      branching,
      direction,
      steps,
    );
    const end = dug?.tiles.at(-1);
    if (!dug || !end) {
      return false;
    }
    const heading = DIRECTIONS[dug.direction] as Point;
    const wall = { x: end.x + heading.x, y: end.y + heading.y };
    const room = roomBeyond(
      random,
      wall,
      dug.direction,
      size.width,
      size.height,
      plan.step,
    );
    const dugTiles = new Set(dug.tiles.map(({ x, y }) => y * width + x));
    if (
      !builder.isExitAllowed(wall) ||
      (slot && touching(slot.exit, wall)) ||
      !fits(room, dugTiles)
    ) {
      return false;
    }

    builder.carve(dug.tiles, parent.id);
    const placed = addRoom(room);
    if (slot) {
      builder.addExit(slot.exit, [parent.id], slot);
    }
    builder.addExit(wall, [placed.id], {
      outside: end,
      direction: (dug.direction + 2) % 4,
    });
    builder.link(parent, placed);
    builder.join(parent.id, placed.id);
    return true;
  };

  let failures = 0;
  while (
    rooms.length < roomCount.max &&
    (rooms.length < roomCount.min || covered / (width * height) < fill) &&
    failures < MAX_FAILURES
  ) {
    failures = grow(failures >= STALLED_AFTER) ? 0 : failures + 1;
  }

  builder.addExtras(true);
  return {
    grid,
    rooms,
    exits: builder.exits,
    fill: covered / (width * height),
  };
}
