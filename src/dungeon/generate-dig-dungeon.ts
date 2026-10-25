import { assertFraction } from '../core/assert-fraction';
import { assertRange } from '../core/assert-range';
import { carveRoom } from '../rooms/carve-room';
import { carveTemplate } from '../rooms/templates/carve-template';
import { createCenterRoom } from '../rooms/create-center-room';
import { createSteering } from './create-steering';
import { createRoomPlan } from '../rooms/create-room-plan';
import { digCorridor } from './dig-corridor';
import type { DigDungeonOptions } from './dig-dungeon-options';
import { createDungeonBuilder } from './dungeon-builder';
import { touching } from './dungeon-builder';
import type { ExitSlot } from './dungeon-builder';
import type { OperationExit } from './dungeon-operation';
import type { DungeonResult } from './dungeon-result';
import { Grid } from '../core/grid';
import { prepareTemplates } from '../rooms/templates/prepare-templates';
import { pickDirection } from '../rooms/pick-direction';
import { pickRandom } from '../core/pick-random';
import { pickRoomSize } from '../rooms/pick-room-size';
import type { Point } from '../core/point';
import { randomInt } from '../core/random-int';
import { resolveDungeonOptions } from '../rooms/resolve-dungeon-options';
import { resolveSymmetryOptions } from '../rooms/resolve-symmetry-options';
import type { Room } from '../rooms/room';
import { EDGE_CLEARANCE } from '../rooms/room-plan';
import { roomBeyond } from '../rooms/room-beyond';
import { roomsConflict } from '../rooms/rooms-conflict';
import { DIRECTIONS } from '../core/directions';
import type { TemplatePlacement } from '../rooms/templates/template-placement';

/** Failed attempts in a row after which rooms may have more exits than they wanted, so that digging can go on. */
const STALLED_AFTER = 20;

/** Failed attempts in a row after which the map counts as full. */
const MAX_FAILURES = 300;

/** Times a dungeon is dug before a template that is cut off is reported. */
const MAX_ATTEMPTS = 10;

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

  const lattice = placement === 'lattice';
  const plan = createRoomPlan({
    ...resolved,
    spacingUniformity: 0,
    layout: symmetry.layoutSymmetry,
    symmetryChance: symmetry.layoutSymmetryChance,
  });
  const steered =
    symmetry.corridorSymmetry !== 'none' && symmetry.corridorSymmetryChance > 0;
  const transforms = plan?.transforms ?? [];
  const steering = createSteering({ ...resolved, ...symmetry, lattice });
  const settings = { ...resolved, lattice, share: steering };
  const area = width * height;

  // the first template, if any, is the room that digging starts from
  const templated = prepareTemplates(
    random,
    options,
    resolved,
    symmetry.layoutSymmetry,
    true,
  );
  const { placements } = templated;

  /** Digs a dungeon, or says which templated room is cut off and why. */
  const attempt = (): DungeonResult | { room: number; problem: string } => {
    const grid = new Grid(width, height);
    const rooms: Room[] = templated.rooms();
    for (const room of rooms) {
      carveTemplate(
        grid,
        placements[room.id] as TemplatePlacement,
        templated.doors,
      );
    }
    const builder = createDungeonBuilder(grid, rooms, random, {
      ...resolved,
      lattice,
      layout: { transforms, chance: symmetry.layoutSymmetryChance },
      steering: steered ? steering : undefined,
      templates: placements,
      doors: templated.doors,
    });
    const coverage = (): number =>
      rooms.reduce(
        (sum, room) =>
          sum + (placements[room.id] ? 0 : room.width * room.height),
        templated.floor,
      ) / area;

    if (plan && (rooms.length > 0 || roomCount.max > 0)) {
      const pickSize = (): { width: number; height: number } => ({
        width: pickRoomSize(
          random,
          plan.widths,
          plan.step,
          plan.sizeUniformity,
        ),
        height: pickRoomSize(
          random,
          plan.heights,
          plan.step,
          plan.sizeUniformity,
        ),
      });

      if (rooms.length === 0) {
        // a room that is its own mirror image sits on the axis
        const start = createCenterRoom(random, plan);
        if (!start) {
          return { grid, rooms, exits: [], fill: 0 };
        }
        rooms.push(start);
        carveRoom(grid, start);
        builder.registerRoom(start);
      }

      /** Whether new rooms fit where they are, apart from the corridors that lead to them. */
      const accepts = (
        candidates: Room[],
        dug: ReadonlySet<number>,
      ): boolean => {
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

        const length = randomInt(
          random,
          corridorLength.min,
          corridorLength.max,
        );
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
        if (
          !builder.isExitAllowed(wall) ||
          (slot && touching(slot.exit, wall))
        ) {
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
          exits.unshift({
            position: slot.exit,
            rooms: [parent.id],
            start: slot,
          });
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
    } else if (rooms.length === 0) {
      return { grid, rooms, exits: [], fill: 0 };
    }

    if (rooms.length > 0 && placements.length > 0) {
      // templates other than the first are joined to the rest afterwards
      const stranded = rooms.length > 1 ? builder.connectAll() : [];
      const [lost] = builder.connectStubs();
      if (lost) {
        return {
          room: lost.room,
          problem: `the exit at (${String(lost.position.x)}, ${String(lost.position.y)}) cannot be joined to the rest of the dungeon`,
        };
      }
      if (stranded.length > 0) {
        return {
          room: stranded.find((id) => placements[id]) ?? 0,
          problem: 'cannot be joined to the rest of the dungeon',
        };
      }
    }
    builder.addExtras(true);
    return {
      grid,
      rooms,
      exits: builder.exits,
      fill: coverage(),
    };
  };

  // Corridors can box in a fixed exit of a template, which digging again
  // usually fixes, so the dungeon is tried again before giving up.
  for (let tries = 1; ; ++tries) {
    const built = attempt();
    if ('grid' in built) {
      return built;
    }
    if (tries === MAX_ATTEMPTS) {
      templated.fail(built.room, built.problem);
    }
  }
}
