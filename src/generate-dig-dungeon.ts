import { assertFraction } from './assert-fraction';
import { assertRange } from './assert-range';
import { carveRoom } from './carve-room';
import { createCenterRoom } from './create-center-room';
import { createSteering } from './create-steering';
import { createRoomPlan } from './create-room-plan';
import { digCorridor } from './dig-corridor';
import type { DigDungeonOptions } from './dig-dungeon-options';
import { createDungeonBuilder } from './dungeon-builder';
import { touching } from './dungeon-builder';
import type { ExitSlot } from './dungeon-builder';
import type { OperationExit } from './dungeon-operation';
import type { DungeonResult } from './dungeon-result';
import { Grid } from './grid';
import { pickDirection } from './pick-direction';
import { pickRandom } from './pick-random';
import { pickRoomSize } from './pick-room-size';
import type { Point } from './point';
import { randomInt } from './random-int';
import { resolveDungeonOptions } from './resolve-dungeon-options';
import { resolveSymmetryOptions } from './resolve-symmetry-options';
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
  const symmetry = resolveSymmetryOptions(options);

  const grid = new Grid(width, height);
  const rooms: Room[] = [];
  const steered =
    symmetry.corridorSymmetry !== 'none' && symmetry.corridorSymmetryChance > 0;
  const plan = createRoomPlan({
    ...resolved,
    spacingUniformity: 0,
    layout: symmetry.layoutSymmetry,
    symmetryChance: symmetry.layoutSymmetryChance,
  });
  if (!plan || roomCount.max === 0) {
    return { grid, rooms, exits: [], fill: 0 };
  }

  const lattice = placement === 'lattice';
  const transforms = plan.transforms;
  const steering = createSteering({ ...resolved, ...symmetry, lattice });
  const builder = createDungeonBuilder(grid, rooms, random, {
    ...resolved,
    lattice,
    layout: { transforms, chance: symmetry.layoutSymmetryChance },
    steering: steered ? steering : undefined,
  });
  const settings = { ...resolved, lattice, share: steering };
  const area = width * height;
  const coverage = (): number =>
    rooms.reduce((sum, room) => sum + room.width * room.height, 0) / area;

  const pickSize = (): { width: number; height: number } => ({
    width: pickRoomSize(random, plan.widths, plan.step, plan.sizeUniformity),
    height: pickRoomSize(random, plan.heights, plan.step, plan.sizeUniformity),
  });

  // a room that is its own mirror image sits on the axis
  const start = createCenterRoom(random, plan);
  if (!start) {
    return { grid, rooms, exits: [], fill: 0 };
  }
  rooms.push(start);
  carveRoom(grid, start);
  builder.registerRoom(start);

  /** Whether new rooms fit where they are, apart from the corridors that lead to them. */
  const accepts = (candidates: Room[], dug: ReadonlySet<number>): boolean => {
    if (rooms.length + candidates.length > roomCount.max) {
      return false;
    }
    return candidates.every((room, i) => {
      if (
        room.x < EDGE_CLEARANCE ||
        room.y < EDGE_CLEARANCE ||
        room.x + room.width > width - EDGE_CLEARANCE ||
        room.y + room.height > height - EDGE_CLEARANCE ||
        rooms.some((other) => roomsConflict(other, room, plan.spacing)) ||
        candidates
          .slice(i + 1)
          .some((other) => roomsConflict(other, room, plan.spacing))
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
    });
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

    const length = randomInt(random, corridorLength.min, corridorLength.max);
    const steps = lattice ? Math.ceil(length / 2) : length;

    let parent: Room;
    let slot: ExitSlot | undefined;
    let origin: Point;
    let direction: number;
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
      direction = pickDirection(random, settings.share(origin));
    } else {
      parent = pickRandom(random, wanting);
      direction = pickDirection(
        random,
        settings.share({
          x: parent.x + parent.width / 2,
          y: parent.y + parent.height / 2,
        }),
      );
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
      const placed = {
        ...roomBeyond(
          random,
          slot.exit,
          direction,
          size.width,
          size.height,
          plan.step,
        ),
        id: rooms.length,
      };
      return builder.place(
        {
          paths: [],
          exits: [{ position: slot.exit, rooms: [parent.id, placed.id] }],
          links: [[parent.id, placed.id]],
          joins: [[parent.id, placed.id]],
        },
        [placed],
        accepts,
      );
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
    const placed = {
      ...roomBeyond(
        random,
        wall,
        dug.direction,
        size.width,
        size.height,
        plan.step,
      ),
      id: rooms.length,
    };
    if (!builder.isExitAllowed(wall) || (slot && touching(slot.exit, wall))) {
      return false;
    }

    const exits: OperationExit[] = [
      {
        position: wall,
        rooms: [placed.id],
        start: { outside: end, direction: (dug.direction + 2) % 4 },
      },
    ];
    if (slot) {
      exits.unshift({ position: slot.exit, rooms: [parent.id], start: slot });
    }
    return builder.place(
      {
        paths: [
          {
            tiles: branching ? [origin, ...dug.tiles] : dug.tiles,
            owner: parent.id,
            crossing: false,
            fixed: branching ? 1 : 0,
            direction,
          },
        ],
        exits,
        links: [[parent.id, placed.id]],
        joins: [[parent.id, placed.id]],
      },
      [placed],
      accepts,
    );
  };

  let failures = 0;
  while (
    rooms.length < roomCount.max &&
    (rooms.length < roomCount.min || coverage() < fill) &&
    failures < MAX_FAILURES
  ) {
    failures = grow(failures >= STALLED_AFTER) ? 0 : failures + 1;
  }

  builder.addExtras(true);
  return {
    grid,
    rooms,
    exits: builder.exits,
    fill: coverage(),
  };
}
