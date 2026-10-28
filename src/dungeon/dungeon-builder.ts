import { distanceBetween } from './distance-between';
import { planBspLinks } from './plan-bsp-links';
import type { RoomConnection } from './room-connection';
import { createRoomShape } from '../rooms/create-room-shape';
import { corridorTileCost } from './corridor-tile-cost';
import { DIRECTIONS } from '../core/directions';
import type {
  Operation,
  OperationExit,
  OperationPath,
} from './dungeon-operation';
import type { Exit } from '../rooms/exit';
import { createSearchBuffers, findCorridor } from './find-corridor';
import type { CorridorMap, CorridorTarget } from './find-corridor';
import type { Grid } from '../core/grid';
import { pickRandom } from '../core/pick-random';
import type { Point } from '../core/point';
import type { Random } from '../core/random';
import { randomInt } from '../core/random-int';
import { TemplateCell } from '../rooms/templates/template-cell';
import type { TemplatePlacement } from '../rooms/templates/template-placement';
import type { Range } from '../core/range';
import type { Room } from '../rooms/room';
import { Tile } from '../core/tile';
import type { Transform } from '../rooms/templates/create-transforms';

export interface DungeonBuilderOptions {
  /** How rooms are joined. Defaults to `nearest`. */
  connection?: RoomConnection;
  lattice: boolean;
  doorChance: number;
  straight: number;
  horizontalBias: number;
  verticalBias: number;
  exitsPerRoom: Range;
  loopChance: number;
  deadEndChance: number;
  /** Mirror images that every addition to the dungeon is repeated as, and how often. */
  layout?: { transforms: Transform[]; chance: number };
  /** The share of horizontal directions that corridors favor at a tile, which makes routed corridors follow a pattern. */
  steering?: (at: Point) => number;
  /** The shapes of the rooms, by room id. A room without one gets the ring of `createRoomShape`. */
  shapes?: readonly (TemplatePlacement | undefined)[];
  /** One byte per tile, 1 where corridors must not go, besides the rooms: what earlier steps built. */
  blocked?: Uint8Array;
  /** One byte per tile, 1 where no exit may be opened, such as a wall that an earlier step sealed. */
  sealed?: Uint8Array;
  /** Whether each `Exit` and `Door` cell of the templates gets a door, keyed by `y * width + x`. */
  doors?: ReadonlyMap<number, boolean>;
  /**
   * The id from which the rooms stand in for floor that is not a room, such
   * as a cavern: their shapes are the floor and the walls round it. They are
   * never joined by a door in a shared wall, their exits get no door, and the
   * distance to them is measured to their nearest wall. Defaults to none.
   */
  firstStandIn?: number;
}

/** An exit of a templated room that could not be opened or joined to the rest of the dungeon. */
export interface UnconnectedExit {
  /** Id of the room. */
  room: number;
  /** The exit cell. */
  position: Point;
}

/** Where a corridor leaves a room: the tile outside the room's wall, and the wall tile to open unless the exit exists already. */
export interface Start {
  outside: Point;
  /** Index into `DIRECTIONS` of the wall the start is on. */
  direction: number;
  exit?: Point;
  /** Set when the tile outside is already a corridor of another group of rooms. */
  joins?: boolean;
}

/** A start that opens a new exit. */
type ExitSlot = Start & { exit: Point };

/** Whether a corridor starts at a new exit or at one the room has already. */
type Mode = 'new' | 'reuse';

interface Edge {
  a: Room;
  b: Room;
  distance: number;
}

/** Cost of a turn at full `straight`. */
const TURN_COST = 6;

/** Largest random cost of a tile at no `straight`. */
const MAX_NOISE = 1.5;

/** Neighbors of every room that may get an extra link. */
const LOOP_NEIGHBORS = 3;

/** How far apart the ends of a loop are at the very least, in tiles. */
const MIN_LOOP_SPAN = 6;

/** How many corridor tiles of a room are tried as places to branch off. */
const BRANCH_TRIES = 4;

/** Tries at finding room for a dead end. */
const DEAD_END_TRIES = 8;

/** Length of a dead end, in tiles. */
const DEAD_END_LENGTH: Range = { min: 3, max: 8 };

/**
 * Everything that is needed to build the corridors and exits of a dungeon on a
 * grid whose rooms are carved already, kept in one place for `connectRooms`.
 */
export interface DungeonBuilder {
  /** Every exit made so far. */
  readonly exits: Exit[];
  /** Links the rooms with corridors and doors, and returns the ids of rooms that could not be joined to the biggest group. */
  connectAll: () => number[];
  /** Adds the exits that rooms want, loops, and dead ends if asked for. */
  addExtras: (deadEnds: boolean) => void;
  /** Joins the corridor stubs of the templated rooms' fixed exits to the rest of the corridors, and returns the exits that could not be opened or joined. */
  connectStubs: () => UnconnectedExit[];
}

/** Creates a builder for the rooms that are carved on a grid. */
export function createDungeonBuilder(
  grid: Grid,
  rooms: Room[],
  random: Random,
  options: DungeonBuilderOptions,
): DungeonBuilder {
  const { width, height } = grid;
  const exits: Exit[] = [];
  const reserved = options.blocked
    ? Uint8Array.from(options.blocked)
    : new Uint8Array(width * height);

  const horizontalShare =
    options.horizontalBias + options.verticalBias > 0
      ? options.horizontalBias / (options.horizontalBias + options.verticalBias)
      : 0.5;
  const noise = new Float32Array(width * height);
  for (let i = 0; i < noise.length; ++i) {
    noise[i] = random() * (1 - options.straight) * MAX_NOISE;
  }
  const map: CorridorMap = {
    search: createSearchBuffers(width * height),
    width,
    height,
    lattice: options.lattice,
    reserved,
    corridor: new Uint8Array(width * height),
    noise,
    horizontalCost: 1.5 - horizontalShare,
    verticalCost: 0.5 + horizontalShare,
    turnCost: options.straight * TURN_COST,
    averageCost: 1 + ((1 - options.straight) * MAX_NOISE) / 2,
  };
  if (options.steering) {
    const steering = options.steering;
    map.steer = new Float32Array(width * height).map((_, i) =>
      steering({ x: i % width, y: Math.floor(i / width) }),
    );
  }
  // for every corridor tile, the room whose link carved it
  const owner = new Int32Array(width * height).fill(-1);
  // tiles around exits, where no other exit may go
  const exitBlocked = options.sealed
    ? Uint8Array.from(options.sealed)
    : new Uint8Array(width * height);
  // how many exits each room would like
  const wanted: number[] = [];
  // where the corridor of each exit starts, so that more corridors can branch off it
  const exitStarts: (Start | undefined)[] = [];
  // pairs of rooms with a link between them
  const linked = new Set<string>();
  // the tiles of every corridor, in the order they were carved
  const corridors: Point[][] = [];
  // the id of the room at each position, to find the mirror image of a room
  const geometry = new Map<string, number>();
  const transforms = options.layout?.transforms ?? [];
  const mirrorChance = options.layout?.chance ?? 0;
  const firstStandIn = options.firstStandIn ?? rooms.length;
  const isStandIn = (room: Room): boolean => room.id >= firstStandIn;

  /** Whether a corridor can start or end on the tile, which excludes tiles beside an existing corridor, diagonally too. */
  const isFree = (x: number, y: number): boolean =>
    x >= 1 &&
    y >= 1 &&
    x <= width - 2 &&
    y <= height - 2 &&
    map.reserved[y * width + x] === 0 &&
    [-1, 0, 1].every((dy) =>
      [-1, 0, 1].every((dx) => map.corridor[(y + dy) * width + x + dx] === 0),
    );

  const isExitAllowed = (position: Point): boolean =>
    exitBlocked[position.y * width + position.x] === 0;

  const addExit = (
    position: Point,
    ids: number[],
    start?: Start,
    forcedDoor?: boolean,
  ): void => {
    const door =
      !ids.some((id) => id >= firstStandIn) &&
      (forcedDoor ?? options.doorChance > random());
    grid.set(position.x, position.y, door ? Tile.Door : Tile.Floor);
    for (let y = position.y - 1; y <= position.y + 1; ++y) {
      for (let x = position.x - 1; x <= position.x + 1; ++x) {
        if (grid.inBounds(x, y)) {
          exitBlocked[y * width + x] = 1;
        }
      }
    }
    for (const id of ids) {
      const room = rooms[id] as Room;
      room.exits.push(exits.length);
      ++room.exitCount;
      room.doorCount += door ? 1 : 0;
    }
    exitStarts.push(
      start && ids.length === 1
        ? { outside: start.outside, direction: start.direction }
        : undefined,
    );
    exits.push({ position, rooms: ids, door });
  };

  // rooms that are joined belong to the same group
  const group: number[] = [];
  const groupOf = (id: number): number => {
    let root = id;
    while (group[root] !== root) {
      root = group[root] as number;
    }
    group[id] = root;
    return root;
  };
  const join = (a: number, b: number): void => {
    group[groupOf(a)] = groupOf(b);
  };
  // the shape of every room, by id
  const shapes: TemplatePlacement[] = [];
  const shapeOf = (room: Room): TemplatePlacement =>
    shapes[room.id] as TemplatePlacement;
  const registerRoom = (room: Room): void => {
    const shape = options.shapes?.[room.id] ?? createRoomShape(room);
    shapes[room.id] = shape;
    // a room reserves what it is made of, and leaves the unused cells to corridors
    shape.cells.forEach((row, dy) => {
      row.forEach((cell, dx) => {
        if (cell !== TemplateCell.Unused) {
          reserved[(shape.y + dy) * width + shape.x + dx] = 1;
        }
      });
    });
    wanted[room.id] = randomInt(
      random,
      options.exitsPerRoom.min,
      options.exitsPerRoom.max,
    );
    group[room.id] = room.id;
    geometry.set(geometryKey(room), room.id);
  };
  const idKey = (a: number, b: number): string =>
    a < b ? `${String(a)}-${String(b)}` : `${String(b)}-${String(a)}`;
  const pairKey = (a: Room, b: Room): string => idKey(a.id, b.id);

  const carve = (path: Point[], id: number): void => {
    for (const { x, y } of path) {
      grid.set(x, y, Tile.Floor);
      if (map.corridor[y * width + x] === 0) {
        map.corridor[y * width + x] = 1;
        owner[y * width + x] = id;
      }
    }
    corridors.push(path);
  };

  const atCapacity = (room: Room): boolean =>
    room.exitCount >= (wanted[room.id] as number);
  const naturalMode = (room: Room): Mode =>
    atCapacity(room) ? 'reuse' : 'new';

  const commit = (operation: Operation): void => {
    // the rooms that a corridor connects are the ones that own the corridor
    // it starts or ends on, or that have an exit where it starts or ends
    const attached = ({ x, y }: Point): number[] => [
      ...(map.corridor[y * width + x] === 1
        ? [owner[y * width + x] as number]
        : []),
      ...operation.exits
        .filter(({ start }) => start?.outside.x === x && start.outside.y === y)
        .flatMap((exit) => exit.rooms),
    ];
    const connected = operation.paths.map(({ tiles }) => [
      ...attached(tiles[0] as Point),
      ...attached(tiles.at(-1) as Point),
    ]);
    for (const path of operation.paths) {
      carve(path.tiles, path.owner);
    }
    for (const exit of operation.exits) {
      addExit(exit.position, exit.rooms, exit.start, exit.door);
    }
    for (const [a, b] of operation.links) {
      linked.add(idKey(a, b));
    }
    for (const [a, b] of operation.joins) {
      join(a, b);
    }
    for (const [first, ...others] of connected) {
      for (const id of others) {
        join(first as number, id);
      }
    }
  };

  /** Whether a mirror image of a corridor can be carved next to the tiles of the corridors that are about to be, without touching them. */
  const isPathValid = (path: OperationPath, pending: Set<number>): boolean => {
    const last = path.tiles.at(-1) as Point;
    let previous = path.tiles[path.fixed - 1];
    for (const [i, tile] of path.tiles.entries()) {
      const index = tile.y * width + tile.x;
      if (i < path.fixed) {
        if (map.corridor[index] !== 1) {
          return false;
        }
        continue;
      }
      const direction = previous
        ? headingTo(previous, tile)
        : (path.direction as number);
      const cost = corridorTileCost(map, tile.x, tile.y, direction, {
        crossing: path.crossing,
        isTarget: (x, y) => x === last.x && y === last.y,
        from: previous,
        pending,
      });
      if (cost === undefined || pending.has(index)) {
        return false;
      }
      previous = tile;
    }
    return true;
  };

  /** The operation together with its mirror images, or `undefined` if some room has no twin to take part. */
  const mirrorPlan = (operation: Operation): Operation[] | undefined => {
    const twinOf = (i: number, id: number): number | undefined => {
      const image = (transforms[i] as Transform).room(rooms[id] as Room);
      return geometry.get(geometryKey(image));
    };

    const operations = [operation];
    const seenPaths = new Set<string>(operation.paths.map(pathKey));
    const seenExits = new Set<number>(
      operation.exits.map(({ position }) => position.y * width + position.x),
    );
    const seenLinks = new Set<string>(
      operation.links.map(([a, b]) => idKey(a, b)),
    );
    const seenJoins = new Set<string>(
      operation.joins.map(([a, b]) => idKey(a, b)),
    );
    for (const [i, transform] of transforms.entries()) {
      const twin: Operation = { paths: [], exits: [], links: [], joins: [] };
      for (const path of operation.paths) {
        const owner = twinOf(i, path.owner);
        if (owner === undefined) {
          return undefined;
        }
        const image: OperationPath = {
          ...path,
          owner,
          tiles: path.tiles.map(transform.point),
          direction:
            path.direction === undefined
              ? undefined
              : transform.direction(path.direction),
        };
        if (!seenPaths.has(pathKey(image))) {
          seenPaths.add(pathKey(image));
          twin.paths.push(image);
        }
      }
      for (const exit of operation.exits) {
        const ids = exit.rooms.map((id) => twinOf(i, id));
        if (ids.some((id) => id === undefined)) {
          return undefined;
        }
        const position = transform.point(exit.position);
        const index = position.y * width + position.x;
        if (!seenExits.has(index)) {
          seenExits.add(index);
          twin.exits.push({
            position,
            rooms: ids as number[],
            door: exit.door,
            start: exit.start && {
              outside: transform.point(exit.start.outside),
              direction: transform.direction(exit.start.direction),
            },
          });
        }
      }
      for (const [list, seen, target] of [
        [operation.links, seenLinks, twin.links],
        [operation.joins, seenJoins, twin.joins],
      ] as const) {
        for (const [a, b] of list) {
          const [x, y] = [twinOf(i, a), twinOf(i, b)];
          if (x === undefined || y === undefined) {
            return undefined;
          }
          if (!seen.has(idKey(x, y))) {
            seen.add(idKey(x, y));
            target.push([x, y]);
          }
        }
      }
      operations.push(twin);
    }
    return operations;
  };

  /**
   * Adds corridors and exits to the dungeon, together with their mirror images
   * if the layout is symmetric and the dice say so. Nothing is added, and
   * `false` returned, if a mirror image does not fit.
   */
  const place = (operation: Operation): boolean => {
    const mirrored = transforms.length > 0 && mirrorChance > random();
    const decided: Operation = mirrored
      ? {
          ...operation,
          exits: operation.exits.map((exit) => ({
            ...exit,
            door: exit.door ?? options.doorChance > random(),
          })),
        }
      : operation;
    // exits of the step that are mirror images of each other share a door
    for (let pass = 0; mirrored && pass <= transforms.length; ++pass) {
      for (const transform of transforms) {
        for (const exit of decided.exits) {
          const { x, y } = transform.point(exit.position);
          const image = decided.exits.find(
            ({ position }) => position.x === x && position.y === y,
          );
          if (image) {
            image.door = exit.door;
          }
        }
      }
    }
    const operations = (mirrored ? mirrorPlan(decided) : undefined) ?? [
      decided,
    ];

    const pending = new Set<number>();
    const placedExits: Point[] = [];
    for (const [i, { paths, exits: added }] of operations.entries()) {
      for (const path of paths) {
        if (i > 0 && !isPathValid(path, pending)) {
          return false;
        }
        for (const { x, y } of path.tiles.slice(path.fixed)) {
          pending.add(y * width + x);
        }
      }
      for (const { position } of added) {
        if (
          i > 0 &&
          (!isExitAllowed(position) ||
            placedExits.some((other) => touching(other, position)))
        ) {
          return false;
        }
        placedExits.push(position);
      }
    }
    for (const committed of operations) {
      commit(committed);
    }
    return true;
  };

  const isOtherGroup = ({ x, y }: Point, room: Room): boolean => {
    const index = y * width + x;
    return (
      map.corridor[index] === 1 &&
      groupOf(owner[index] as number) !== groupOf(room.id)
    );
  };

  /**
   * Places for new exits on one wall of a room. When `joining` is set, a slot
   * may also open straight onto a corridor of another group of rooms.
   */
  const slotsOf = (
    room: Room,
    direction: number,
    joining = false,
  ): ExitSlot[] => {
    const step = DIRECTIONS[direction] as Point;
    const slots: ExitSlot[] = [];
    const shape = shapeOf(room);
    // only optional exits are free to open: the fixed ones are open already
    for (const candidate of shape.exits) {
      if (
        candidate.kind !== TemplateCell.OptionalExit ||
        !candidate.directions.includes(direction)
      ) {
        continue;
      }
      const exit = { x: shape.x + candidate.x, y: shape.y + candidate.y };
      const outside = { x: exit.x + step.x, y: exit.y + step.y };
      if (
        !isExitAllowed(exit) ||
        (options.lattice && (outside.x % 2 === 0 || outside.y % 2 === 0))
      ) {
        continue;
      }
      if (isFree(outside.x, outside.y)) {
        slots.push({ exit, outside, direction });
      } else if (joining && isOtherGroup(outside, room)) {
        slots.push({ exit, outside, direction, joins: true });
      }
    }
    return slots;
  };

  /** Wall tiles that open straight into the other room, when exactly one wall separates two ordinary rooms. */
  const sharedWalls = (a: Room, b: Room): Point[] => {
    if (
      a.template !== undefined ||
      b.template !== undefined ||
      isStandIn(a) ||
      isStandIn(b)
    ) {
      return [];
    }
    const walls: Point[] = [];
    const acrossX =
      a.x + a.width + 1 === b.x ? a : b.x + b.width + 1 === a.x ? b : undefined;
    const acrossY =
      a.y + a.height + 1 === b.y
        ? a
        : b.y + b.height + 1 === a.y
          ? b
          : undefined;
    const rowFrom = Math.max(a.y, b.y);
    const rowTo = Math.min(a.y + a.height, b.y + b.height);
    const columnFrom = Math.max(a.x, b.x);
    const columnTo = Math.min(a.x + a.width, b.x + b.width);
    if (acrossX) {
      for (let y = rowFrom; y < rowTo; ++y) {
        walls.push({ x: acrossX.x + acrossX.width, y });
      }
    }
    if (acrossY) {
      for (let x = columnFrom; x < columnTo; ++x) {
        walls.push({ x, y: acrossY.y + acrossY.height });
      }
    }
    return walls.filter(
      (wall) =>
        isExitAllowed(wall) &&
        (!options.lattice || (acrossX ? wall.y : wall.x) % 2 === 1),
    );
  };

  const connectDirectly = (a: Room, b: Room): boolean => {
    const walls = sharedWalls(a, b);
    while (walls.length > 0) {
      const [wall] = walls.splice(randomInt(random, 0, walls.length - 1), 1);
      if (
        wall &&
        place({
          paths: [],
          exits: [{ position: wall, rooms: [a.id, b.id] }],
          links: [[a.id, b.id]],
          joins: [[a.id, b.id]],
        })
      ) {
        return true;
      }
    }
    return false;
  };

  /** Directions of a room's walls, ordered by how well they face a point. */
  const wallsToward = (a: Room, target: Point): number[] => {
    const dx = target.x - (a.x + a.width / 2);
    const dy = target.y - (a.y + a.height / 2);
    const horizontal = dx > 0 ? 1 : 3;
    const vertical = dy > 0 ? 2 : 0;
    // the bias tips which axis counts as the one the target is apart on
    const [first, second] =
      Math.abs(dx) / map.horizontalCost > Math.abs(dy) / map.verticalCost
        ? [horizontal, vertical]
        : [vertical, horizontal];
    return [first, second, (second + 2) % 4, (first + 2) % 4];
  };

  const centerOf = (room: Room): Point => ({
    x: room.x + room.width / 2,
    y: room.y + room.height / 2,
  });

  /** The walls of a stand-in, where its exits may go, on the map. */
  const edgeOf = (room: Room): Point[] => {
    const shape = shapeOf(room);
    return shape.exits.map(({ x, y }) => ({ x: shape.x + x, y: shape.y + y }));
  };

  /** The point of a room to head for from a point: its center, or a stand-in's nearest wall. */
  const pointOf = (room: Room, from: Point): Point => {
    const [first, ...others] = isStandIn(room) ? edgeOf(room) : [];
    return first
      ? others.reduce(
          (best, tile) =>
            squared(tile, from) < squared(best, from) ? tile : best,
          first,
        )
      : centerOf(room);
  };

  /** The point of `b` that a corridor from `a` heads for. */
  const aimOf = (a: Room, b: Room): Point =>
    pointOf(b, pointOf(a, centerOf(b)));

  const distances = new Map<string, number>();
  /** How far apart two rooms are, squared, which orders pairs of rooms: from center to center, or to the nearest wall of a stand-in. */
  const distance = (a: Room, b: Room): number => {
    if (!isStandIn(a) && !isStandIn(b)) {
      return distanceBetween(a, b);
    }
    const key = pairKey(a, b);
    let known = distances.get(key);
    if (known === undefined) {
      const [near, far] = isStandIn(a) ? [b, a] : [a, b];
      const from = isStandIn(near) ? edgeOf(near) : [centerOf(near)];
      const to = edgeOf(far);
      known = Infinity;
      for (const p of from) {
        for (const q of to) {
          known = Math.min(known, squared(p, q));
        }
      }
      distances.set(key, known);
    }
    return known;
  };

  /** The exit that a corridor starts or ends with, if it opens a new one. */
  const exitOf = (room: Room, start?: Start): OperationExit[] =>
    start?.exit ? [{ position: start.exit, rooms: [room.id], start }] : [];

  /** A corridor along a path, which may start on a corridor that exists already. */
  const pathOf = (
    tiles: Point[],
    owner: number,
    crossing: boolean,
    direction: number,
  ): OperationPath => ({
    tiles,
    owner,
    crossing,
    fixed:
      map.corridor[(tiles[0] as Point).y * width + (tiles[0] as Point).x] === 1
        ? 1
        : 0,
    direction,
  });

  /** The way a corridor from `from` towards `to` is heading, as an index into `DIRECTIONS`. */
  const headingTo = (from: Point, to: Point): number => {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    return Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 1 : 3) : dy > 0 ? 2 : 0;
  };

  /**
   * Every corridor tile that can be reached from the exits of a room without
   * crossing a room, going through the door it shares with another room if it
   * has one.
   */
  const corridorsOf = (room: Room): Point[] => {
    const tiles: Point[] = [];
    const seen = new Set<number>();
    const visited = new Set<number>([room.id]);
    const queue: Point[] = [];
    for (const id of visited) {
      for (const index of (rooms[id] as Room).exits) {
        const outside = exitStarts[index]?.outside;
        if (outside) {
          queue.push(outside);
        }
        for (const other of (exits[index] as Exit).rooms) {
          visited.add(other);
        }
      }
    }
    for (const tile of queue) {
      seen.add(tile.y * width + tile.x);
    }
    for (let tile = queue.shift(); tile; tile = queue.shift()) {
      tiles.push(tile);
      for (const step of DIRECTIONS) {
        const x = tile.x + step.x;
        const y = tile.y + step.y;
        if (map.corridor[y * width + x] === 1 && !seen.has(y * width + x)) {
          seen.add(y * width + x);
          queue.push({ x, y });
        }
      }
    }
    return tiles;
  };

  /**
   * Candidates for where a room's corridor starts, best first: a free spot on
   * each wall for a new exit, or tiles along the corridors it has already.
   */
  const startsFor = (room: Room, mode: Mode, toward: Point): Start[] => {
    if (mode === 'new' && isStandIn(room)) {
      // a stand-in has walls all round, so the slots nearest the target come first
      return DIRECTIONS.flatMap((_, direction) => slotsOf(room, direction))
        .sort(
          (p, q) => manhattan(p.outside, toward) - manhattan(q.outside, toward),
        )
        .slice(0, BRANCH_TRIES);
    }
    if (mode === 'new') {
      return wallsToward(room, toward)
        .map((direction) => slotsOf(room, direction))
        .filter((slots) => slots.length > 0)
        .map((slots) => pickRandom(random, slots));
    }
    return corridorsOf(room)
      .filter(({ x, y }) => !options.lattice || (x % 2 === 1 && y % 2 === 1))
      .sort((p, q) => manhattan(p, toward) - manhattan(q, toward))
      .slice(0, BRANCH_TRIES)
      .map((outside) => ({
        outside,
        direction: headingTo(outside, toward),
      }));
  };

  /** Candidates for where a corridor from `from` ends in a room: the free spot nearest to it on each wall, or any corridor of the room. */
  const targetsFor = (
    room: Room,
    mode: Mode,
    from: Start,
  ): { target: CorridorTarget; start?: Start }[] => {
    if (mode === 'new') {
      return [
        (from.direction + 2) % 4,
        ...wallsToward(room, from.outside),
      ].flatMap((direction) => {
        // two exits made by the same corridor must not touch either
        const slots = slotsOf(room, direction).filter(
          (slot) => !from.exit || !touching(slot.exit, from.exit),
        );
        if (slots.length === 0) {
          return [];
        }
        const nearest = Math.min(
          ...slots.map((slot) => manhattan(slot.outside, from.outside)),
        );
        const start = pickRandom(
          random,
          slots.filter(
            (slot) => manhattan(slot.outside, from.outside) === nearest,
          ),
        );
        return [{ target: start.outside, start }];
      });
    }
    const tiles = corridorsOf(room);
    const own = new Set(tiles.map(({ x, y }) => y * width + x));
    // when both rooms use the same network of corridors, the new corridor
    // makes a loop, and it must not just run along the corridor it starts on
    const loop = own.has(from.outside.y * width + from.outside.x);
    const aim = tiles.sort(
      (p, q) => manhattan(p, from.outside) - manhattan(q, from.outside),
    )[loop ? Math.min(tiles.length - 1, 5) : 0];
    if (!aim) {
      return [];
    }
    return [
      {
        target: {
          test: (x, y) =>
            own.has(y * width + x) &&
            (!loop || manhattan({ x, y }, from.outside) >= MIN_LOOP_SPAN),
          aim,
        },
      },
    ];
  };

  /** Tries to run a corridor between two rooms, each starting at a new exit or branching off the corridors it has already. */
  const tryCorridor = (
    a: Room,
    b: Room,
    modes: [Mode, Mode],
    crossing: boolean,
  ): boolean => {
    for (const startA of startsFor(a, modes[0], aimOf(a, b))) {
      for (const { target, start: startB } of targetsFor(b, modes[1], startA)) {
        const path = findCorridor(
          map,
          startA.outside,
          startA.direction,
          target,
          crossing,
        );
        if (
          path &&
          place({
            paths: [pathOf(path, a.id, crossing, startA.direction)],
            exits: [...exitOf(a, startA), ...exitOf(b, startB)],
            links: [[a.id, b.id]],
            joins: [],
          })
        ) {
          return true;
        }
      }
    }
    return false;
  };

  const otherMode = (mode: Mode): Mode => (mode === 'new' ? 'reuse' : 'new');

  /**
   * Links two rooms whatever it takes: through a door or a corridor, starting
   * at the exits the rooms would like to use and, failing that, at any others.
   */
  const connect = (a: Room, b: Room): boolean => {
    if (!atCapacity(a) && !atCapacity(b) && connectDirectly(a, b)) {
      return true;
    }
    // a stand-in may be walled in, and the searches that fail to reach it are dear
    if ((isStandIn(a) || isStandIn(b)) && !mayJoin(a, b)) {
      return false;
    }
    const [modeA, modeB] = [naturalMode(a), naturalMode(b)];
    const combinations: [Mode, Mode][] = [
      [modeA, modeB],
      [modeA, otherMode(modeB)],
      [otherMode(modeA), modeB],
      [otherMode(modeA), otherMode(modeB)],
    ];
    for (const crossing of [false, true]) {
      for (const modes of combinations) {
        if (tryCorridor(a, b, modes, crossing)) {
          return true;
        }
      }
    }
    return connectDirectly(a, b);
  };

  /** Adds a link between two connected rooms that stays within their exit counts, if there is room for it. */
  const addLink = (a: Room, b: Room): boolean =>
    (!atCapacity(a) && !atCapacity(b) && connectDirectly(a, b)) ||
    tryCorridor(a, b, [naturalMode(a), naturalMode(b)], false);

  /**
   * Whether a corridor that may cross others could get from one of the free
   * tiles to a tile that passes the test. It floods the map with the steps
   * that `findCorridor` takes, without their costs: which steps a corridor
   * may take depends on the tile and the way it moves, not on the way it
   * faced before, so the flood reaches exactly the tiles that a crossing
   * search can, and a search that does not cross reaches fewer.
   */
  const canReach = (
    starts: Point[],
    test: (x: number, y: number) => boolean,
  ): boolean => {
    const stride = options.lattice ? 2 : 1;
    const rules = { crossing: true, isTarget: test };
    const seen = new Uint8Array(width * height);
    const queue = starts.map(({ x, y }) => y * width + x);
    for (const tile of queue) {
      seen[tile] = 1;
    }
    for (const tile of queue) {
      const x = tile % width;
      const y = (tile - x) / width;
      if (test(x, y)) {
        return true;
      }
      for (const [direction, step] of DIRECTIONS.entries()) {
        let open = true;
        for (let i = 1; i <= stride && open; ++i) {
          open =
            corridorTileCost(
              map,
              x + step.x * i,
              y + step.y * i,
              direction,
              rules,
            ) !== undefined;
        }
        const next = (y + step.y * stride) * width + x + step.x * stride;
        if (open && seen[next] === 0) {
          seen[next] = 1;
          queue.push(next);
        }
      }
    }
    return false;
  };

  /**
   * Whether any corridor of `tryCorridor` could join two rooms: whether a
   * flood from the slots and corridors of one reaches those of the other.
   */
  const mayJoin = (a: Room, b: Room): boolean => {
    const ends = (room: Room): Point[] => [
      ...DIRECTIONS.flatMap((_, direction) =>
        slotsOf(room, direction).map(({ outside }) => outside),
      ),
      ...corridorsOf(room),
    ];
    const targets = new Set(ends(b).map(({ x, y }) => y * width + x));
    return canReach(ends(a), (x, y) => targets.has(y * width + x));
  };

  /** Joins a room to the nearest corridor of any other group, whichever way it can be reached. */
  const joinCorridor = (room: Room): boolean => {
    let nearest: Point | undefined;
    let nearestDistance = Infinity;
    const center = centerOf(room);
    for (let y = 0; y < height; ++y) {
      for (let x = 0; x < width; ++x) {
        const distance = manhattan({ x, y }, center);
        if (distance < nearestDistance && isOtherGroup({ x, y }, room)) {
          nearest = { x, y };
          nearestDistance = distance;
        }
      }
    }
    if (!nearest) {
      return false;
    }

    const target: CorridorTarget = {
      test: (x, y) => isOtherGroup({ x, y }, room),
      aim: nearest,
      unbounded: true,
    };
    // an unbounded search that cannot reach the target covers the whole map
    // before it gives up, once for every slot and both ways of crossing, so
    // one flood rules that out first
    const starts = DIRECTIONS.flatMap((_, direction) =>
      slotsOf(room, direction, true).map(({ outside }) => outside),
    );
    if (!canReach(starts, target.test)) {
      return false;
    }
    for (const crossing of [false, true]) {
      for (const direction of wallsToward(room, nearest)) {
        const slots = slotsOf(room, direction, true).sort(
          (p, q) =>
            Number(q.joins) - Number(p.joins) ||
            manhattan(p.outside, nearest) - manhattan(q.outside, nearest),
        );
        for (const slot of slots) {
          const path = slot.joins
            ? [slot.outside]
            : findCorridor(map, slot.outside, slot.direction, target, crossing);
          const end = path?.at(-1);
          if (
            path &&
            end &&
            place({
              paths: [pathOf(path, room.id, crossing, slot.direction)],
              exits: exitOf(room, slot),
              links: [],
              joins: [],
            })
          ) {
            return true;
          }
        }
      }
    }
    return false;
  };

  const byDistance = (from: Room, others: Room[]): Room[] =>
    others
      .map((room) => ({ room, distance: distance(from, room) }))
      .sort((p, q) => p.distance - q.distance)
      .map(({ room }) => room);

  const growDeadEnd = (corridor: Point[]): void => {
    const step = options.lattice ? 2 : 1;
    const starts = corridor.filter(
      ({ x, y }) => !options.lattice || (x % 2 === 1 && y % 2 === 1),
    );
    if (starts.length === 0) {
      return;
    }
    for (let attempt = 0; attempt < DEAD_END_TRIES; ++attempt) {
      const start = pickRandom(random, starts);
      const direction = randomInt(random, 0, 3);
      const heading = DIRECTIONS[direction] as Point;
      const sideways = DIRECTIONS[(direction + 1) % 4] as Point;
      const length =
        step *
        randomInt(
          random,
          Math.ceil(DEAD_END_LENGTH.min / step),
          DEAD_END_LENGTH.max / step,
        );
      const drift = step * randomInt(random, -1, 1);
      const end = {
        x: start.x + heading.x * length + sideways.x * drift,
        y: start.y + heading.y * length + sideways.y * drift,
      };
      if (!isFree(end.x, end.y)) {
        continue;
      }
      const path = findCorridor(map, start, direction, end, false);
      if (
        path &&
        path.length > 1 &&
        place({
          paths: [
            pathOf(
              path,
              owner[start.y * width + start.x] as number,
              false,
              direction,
            ),
          ],
          exits: [],
          links: [],
          joins: [],
        })
      ) {
        return;
      }
    }
  };

  // the corridor tile in front of each fixed exit of a templated room
  const stubs: (UnconnectedExit & { outside: Point; direction: number })[] = [];
  const stubTiles = new Set<number>();
  const unopened: UnconnectedExit[] = [];
  // the rooms that have a fixed exit on a tile, to find doorways that rooms share
  const fixedAt = new Map<number, number[]>();
  const sharedDoorways = new Set<number>();
  for (const room of rooms) {
    const shape = options.shapes?.[room.id];
    for (const candidate of shape?.exits ?? []) {
      if (shape && candidate.kind !== TemplateCell.OptionalExit) {
        const key = (shape.y + candidate.y) * width + shape.x + candidate.x;
        fixedAt.set(key, [...(fixedAt.get(key) ?? []), room.id]);
      }
    }
  }

  /** Opens the exits of a template that are always there, each with a corridor tile in front of it. */
  const openFixedExits = (room: Room, placement: TemplatePlacement): void => {
    let fixed = 0;
    let optional = 0;
    for (const candidate of placement.exits) {
      if (candidate.kind === TemplateCell.OptionalExit) {
        ++optional;
        continue;
      }
      const position = {
        x: placement.x + candidate.x,
        y: placement.y + candidate.y,
      };
      const key = position.y * width + position.x;
      const sharing = fixedAt.get(key) ?? [];
      if (sharing.length > 1) {
        // a doorway of two rooms has no corridor of its own
        if (!sharedDoorways.has(key)) {
          sharedDoorways.add(key);
          addExit(position, sharing, undefined, options.doors?.get(key));
          join(sharing[0] as number, sharing[1] as number);
          linked.add(idKey(sharing[0] as number, sharing[1] as number));
        }
        ++fixed;
        continue;
      }
      const usable = candidate.directions.filter((direction) => {
        const step = DIRECTIONS[direction] as Point;
        const x = position.x + step.x;
        const y = position.y + step.y;
        return (
          x >= 1 &&
          y >= 1 &&
          x <= width - 2 &&
          y <= height - 2 &&
          reserved[y * width + x] === 0 &&
          (!options.lattice || (x % 2 === 1 && y % 2 === 1))
        );
      });
      if (usable.length === 0) {
        unopened.push({ room: room.id, position });
        continue;
      }
      const direction = pickRandom(random, usable);
      const step = DIRECTIONS[direction] as Point;
      const outside = { x: position.x + step.x, y: position.y + step.y };
      addExit(
        position,
        [room.id],
        { outside, direction, exit: position },
        options.doors?.get(position.y * width + position.x),
      );
      // a stub on or beside the stub of another room is one corridor with it
      const beside = [
        outside,
        ...DIRECTIONS.map((step) => ({
          x: outside.x + step.x,
          y: outside.y + step.y,
        })),
      ].filter((tile) => stubTiles.has(tile.y * width + tile.x));
      carve([outside], room.id);
      for (const tile of beside) {
        const other = owner[tile.y * width + tile.x] as number;
        join(room.id, other);
        linked.add(idKey(room.id, other));
      }
      stubs.push({ room: room.id, position, outside, direction });
      stubTiles.add(outside.y * width + outside.x);
      ++fixed;
    }
    // the fixed exits are all there are, and optional ones come on top
    wanted[room.id] = Math.min(
      Math.max(wanted[room.id] as number, fixed),
      fixed + optional,
    );
  };

  /** The tiles of the corridors that a tile belongs to. */
  const corridorAt = (start: Point): Set<number> => {
    const seen = new Set<number>([start.y * width + start.x]);
    const queue = [start];
    for (let tile = queue.shift(); tile; tile = queue.shift()) {
      for (const step of DIRECTIONS) {
        const x = tile.x + step.x;
        const y = tile.y + step.y;
        const index = y * width + x;
        if (map.corridor[index] === 1 && !seen.has(index)) {
          seen.add(index);
          queue.push({ x, y });
        }
      }
    }
    return seen;
  };

  const connectStubs = (): UnconnectedExit[] => {
    const failures = [...unopened];
    for (const stub of stubs) {
      const own = corridorAt(stub.outside);
      // a stub that has a corridor leading off it is joined already
      if ([...own].some((index) => !stubTiles.has(index))) {
        continue;
      }
      let nearest: Point | undefined;
      let nearestDistance = Infinity;
      for (let y = 0; y < height; ++y) {
        for (let x = 0; x < width; ++x) {
          const distance = manhattan({ x, y }, stub.outside);
          if (
            distance < nearestDistance &&
            map.corridor[y * width + x] === 1 &&
            !own.has(y * width + x)
          ) {
            nearest = { x, y };
            nearestDistance = distance;
          }
        }
      }
      // with no other corridor on the map there is nothing to join
      if (!nearest) {
        continue;
      }
      const target: CorridorTarget = {
        test: (x, y) =>
          map.corridor[y * width + x] === 1 && !own.has(y * width + x),
        aim: nearest,
        unbounded: true,
      };
      const joined = [false, true].some((crossing) => {
        const path = findCorridor(
          map,
          stub.outside,
          stub.direction,
          target,
          crossing,
        );
        return (
          path !== undefined &&
          place({
            paths: [pathOf(path, stub.room, crossing, stub.direction)],
            exits: [],
            links: [],
            joins: [],
          })
        );
      });
      if (!joined) {
        failures.push({ room: stub.room, position: stub.position });
      }
    }
    return failures;
  };

  const groupSizes = (): Map<number, number> => {
    const sizes = new Map<number, number>();
    for (const room of rooms) {
      const root = groupOf(room.id);
      sizes.set(root, (sizes.get(root) ?? 0) + 1);
    }
    return sizes;
  };

  const connectAll = (): number[] => {
    if (options.connection === 'bsp' || options.connection === 'bsp-random') {
      // every cut gets one corridor, between the first pair of rooms that can be joined
      const plan = planBspLinks(
        rooms.filter((room) => !isStandIn(room)),
        options.connection === 'bsp-random' ? random : undefined,
      );
      for (const cut of plan) {
        for (const { a, b } of cut) {
          if (groupOf(a.id) === groupOf(b.id)) {
            // the sides of the cut are joined already
            break;
          }
          if (connect(a, b)) {
            join(a.id, b.id);
            break;
          }
        }
      }
    }
    // joins what is not joined yet, which is everything without a plan and is the fallback with one
    const edges: Edge[] = rooms.flatMap((a, i) =>
      rooms.slice(i + 1).map((b) => ({ a, b, distance: distance(a, b) })),
    );
    edges.sort((p, q) => p.distance - q.distance);
    for (const { a, b } of edges) {
      if (groupOf(a.id) !== groupOf(b.id) && connect(a, b)) {
        join(a.id, b.id);
      }
    }

    // rooms that could not reach another room may still reach a corridor
    for (let progress = true; progress;) {
      const sizes = groupSizes();
      progress =
        sizes.size > 1 &&
        [...rooms]
          .sort(
            (p, q) =>
              (sizes.get(groupOf(p.id)) ?? 0) - (sizes.get(groupOf(q.id)) ?? 0),
          )
          .some(joinCorridor);
    }

    const [main] = [...groupSizes().entries()].sort((p, q) => q[1] - p[1]);
    return rooms
      .filter((room) => groupOf(room.id) !== main?.[0])
      .map((room) => room.id);
  };

  const addExtras = (deadEnds: boolean): void => {
    // rooms that want more exits get links to their nearest neighbors
    for (const room of rooms) {
      for (const other of byDistance(
        room,
        rooms.filter((r) => r !== room),
      )) {
        if (room.exitCount >= (wanted[room.id] as number)) {
          break;
        }
        if (
          !linked.has(pairKey(room, other)) &&
          ((!atCapacity(other) && connectDirectly(room, other)) ||
            tryCorridor(room, other, ['new', naturalMode(other)], false))
        ) {
          linked.add(pairKey(room, other));
        }
      }
    }

    // loops are extra links between neighboring rooms
    const neighbors = new Map<string, Edge>();
    for (const room of rooms) {
      for (const other of byDistance(
        room,
        rooms.filter((r) => r !== room),
      ).slice(0, LOOP_NEIGHBORS)) {
        neighbors.set(pairKey(room, other), {
          a: room,
          b: other,
          distance: distance(room, other),
        });
      }
    }
    for (const { a, b } of [...neighbors.values()].sort(
      (p, q) => p.distance - q.distance,
    )) {
      if (!linked.has(pairKey(a, b)) && options.loopChance > random()) {
        addLink(a, b);
      }
    }

    // dead ends branch off corridors and lead nowhere
    if (deadEnds) {
      const snapshot = [...corridors];
      const keys = new Map(snapshot.map((tiles, i) => [tilesKey(tiles), i]));
      for (const [i, corridor] of snapshot.entries()) {
        // the mirror image of a corridor that has been dealt with is left alone
        const imaged = transforms.some(
          (transform) =>
            (keys.get(tilesKey(corridor.map(transform.point))) ?? i) < i,
        );
        if (!imaged && options.deadEndChance > random()) {
          growDeadEnd(corridor);
        }
      }
    }
  };

  for (const room of rooms) {
    registerRoom(room);
  }
  for (const room of rooms) {
    if (room.template !== undefined) {
      openFixedExits(room, shapeOf(room));
    }
  }
  // twins want the same number of exits, so that they can be linked alike
  for (const room of rooms) {
    for (const transform of transforms) {
      const twin = geometry.get(geometryKey(transform.room(room)));
      if (twin !== undefined && twin > room.id) {
        wanted[twin] = wanted[room.id] as number;
      }
    }
  }

  return {
    exits,
    connectAll,
    addExtras,
    connectStubs,
  };
}

/** Whether two tiles are the same or next to each other, diagonally too. */
function touching(a: Point, b: Point): boolean {
  return Math.abs(a.x - b.x) <= 1 && Math.abs(a.y - b.y) <= 1;
}

function squared(a: Point, b: Point): number {
  return (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
}

function manhattan(a: Point, b: Point): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

function geometryKey(room: Pick<Room, 'x' | 'y' | 'width' | 'height'>): string {
  return `${String(room.x)},${String(room.y)},${String(room.width)},${String(room.height)}`;
}

/** Identifies a corridor by the tiles it holds, whatever their order. */
function tilesKey(tiles: Point[]): string {
  return tiles
    .map(({ x, y }) => `${String(x)},${String(y)}`)
    .sort()
    .join(' ');
}

function pathKey(path: OperationPath): string {
  return tilesKey(path.tiles);
}
