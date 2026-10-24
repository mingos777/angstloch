import { DIRECTIONS } from './directions';
import type { Exit } from './exit';
import { createSearchBuffers, findCorridor } from './find-corridor';
import type { CorridorMap, CorridorTarget } from './find-corridor';
import type { Grid } from './grid';
import { pickRandom } from './pick-random';
import type { Point } from './point';
import type { Random } from './random';
import { randomInt } from './random-int';
import type { Range } from './range';
import type { Room } from './room';
import { Tile } from './tile';

export interface DungeonBuilderOptions {
  lattice: boolean;
  doorChance: number;
  straight: number;
  horizontalBias: number;
  verticalBias: number;
  exitsPerRoom: Range;
  loopChance: number;
  deadEndChance: number;
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
export type ExitSlot = Start & { exit: Point };

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

/** Neighbours of every room that may get an extra link. */
const LOOP_NEIGHBOURS = 3;

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
 * grid whose rooms are carved already, kept in one place so that the dungeon
 * generators share it.
 */
export interface DungeonBuilder {
  /** The map that corridors are routed on. */
  readonly map: CorridorMap;
  /** Every exit made so far. */
  readonly exits: Exit[];
  /** The tiles of every corridor, in the order they were carved. */
  readonly corridors: Point[][];
  /** Starts counting a room that is carved on the grid. */
  registerRoom: (room: Room) => void;
  /** Whether a room has all the exits it wanted. */
  atCapacity: (room: Room) => boolean;
  /** Places on one wall of a room where a new exit can go. */
  slotsOf: (room: Room, direction: number) => ExitSlot[];
  /** Whether no other exit is next to the tile. */
  isExitAllowed: (position: Point) => boolean;
  /** Opens an exit on the wall, with a door if the dice say so. */
  addExit: (position: Point, ids: number[], start?: Start) => void;
  /** The id of the room that the corridor on a tile belongs to. */
  ownerOf: (tile: Point) => number;
  /** Carves the tiles of a corridor, noting which room it belongs to. */
  carve: (path: Point[], owner: number) => void;
  /** Notes that two rooms are in the same group of connected rooms. */
  join: (a: number, b: number) => void;
  /** Notes that two rooms are linked to each other. */
  link: (a: Room, b: Room) => void;
  /** Links the rooms with corridors and doors, and returns the ids of rooms that could not be joined to the biggest group. */
  connectAll: () => number[];
  /** Adds the exits that rooms want, loops, and dead ends if asked for. */
  addExtras: (deadEnds: boolean) => void;
}

/**
 * Creates a builder for the rooms of a grid. More rooms can be registered
 * later, which is how a generator that places rooms one by one uses it.
 */
export function createDungeonBuilder(
  grid: Grid,
  rooms: Room[],
  random: Random,
  options: DungeonBuilderOptions,
): DungeonBuilder {
  const { width, height } = grid;
  const exits: Exit[] = [];
  const reserved = new Uint8Array(width * height);

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
  // for every corridor tile, the room whose link carved it
  const owner = new Int32Array(width * height).fill(-1);
  // tiles around exits, where no other exit may go
  const exitBlocked = new Uint8Array(width * height);
  // how many exits each room would like
  const wanted: number[] = [];
  // where the corridor of each exit starts, so that more corridors can branch off it
  const exitStarts: (Start | undefined)[] = [];
  // pairs of rooms with a link between them
  const linked = new Set<string>();
  // the tiles of every corridor, in the order they were carved
  const corridors: Point[][] = [];

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

  const addExit = (position: Point, ids: number[], start?: Start): void => {
    const door = options.doorChance > random();
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
  const registerRoom = (room: Room): void => {
    for (let y = room.y - 1; y <= room.y + room.height; ++y) {
      for (let x = room.x - 1; x <= room.x + room.width; ++x) {
        if (grid.inBounds(x, y)) {
          reserved[y * width + x] = 1;
        }
      }
    }
    wanted[room.id] = randomInt(
      random,
      options.exitsPerRoom.min,
      options.exitsPerRoom.max,
    );
    group[room.id] = room.id;
  };
  const pairKey = (a: Room, b: Room): string =>
    a.id < b.id
      ? `${String(a.id)}-${String(b.id)}`
      : `${String(b.id)}-${String(a.id)}`;

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
    const vertical = step.y !== 0;
    const length = vertical ? room.width : room.height;
    for (let i = 0; i < length; ++i) {
      const exit = vertical
        ? { x: room.x + i, y: step.y < 0 ? room.y - 1 : room.y + room.height }
        : { x: step.x < 0 ? room.x - 1 : room.x + room.width, y: room.y + i };
      const along = vertical ? exit.x : exit.y;
      if (options.lattice && along % 2 === 0) {
        continue;
      }
      const outside = { x: exit.x + step.x, y: exit.y + step.y };
      if (!isExitAllowed(exit)) {
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

  /** Wall tiles that open straight into the other room, when exactly one wall separates the two. */
  const sharedWalls = (a: Room, b: Room): Point[] => {
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
    if (walls.length === 0) {
      return false;
    }
    addExit(pickRandom(random, walls), [a.id, b.id]);
    linked.add(pairKey(a, b));
    return true;
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

  const centreOf = (room: Room): Point => ({
    x: room.x + room.width / 2,
    y: room.y + room.height / 2,
  });

  const startCorridor = (room: Room, start: Start): void => {
    if (start.exit) {
      addExit(start.exit, [room.id], start);
    }
  };

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
    for (const startA of startsFor(a, modes[0], centreOf(b))) {
      for (const { target, start: startB } of targetsFor(b, modes[1], startA)) {
        const path = findCorridor(
          map,
          startA.outside,
          startA.direction,
          target,
          crossing,
        );
        if (path) {
          carve(path, a.id);
          startCorridor(a, startA);
          if (startB) {
            startCorridor(b, startB);
          }
          linked.add(pairKey(a, b));
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

  /** Joins a room to the nearest corridor of any other group, whichever way it can be reached. */
  const joinCorridor = (room: Room): boolean => {
    let nearest: Point | undefined;
    let nearestDistance = Infinity;
    const centre = centreOf(room);
    for (let y = 0; y < height; ++y) {
      for (let x = 0; x < width; ++x) {
        const distance = manhattan({ x, y }, centre);
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
          if (path && end) {
            const target = owner[end.y * width + end.x] as number;
            carve(path, room.id);
            startCorridor(room, slot);
            join(room.id, target);
            return true;
          }
        }
      }
    }
    return false;
  };

  const byDistance = (from: Room, others: Room[]): Room[] =>
    others
      .map((room) => ({ room, distance: distanceBetween(from, room) }))
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
      if (path && path.length > 1) {
        carve(path, owner[start.y * width + start.x] as number);
        return;
      }
    }
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
    const edges: Edge[] = rooms.flatMap((a, i) =>
      rooms
        .slice(i + 1)
        .map((b) => ({ a, b, distance: distanceBetween(a, b) })),
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
    // rooms that want more exits get links to their nearest neighbours
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

    // loops are extra links between neighbouring rooms
    const neighbours = new Map<string, Edge>();
    for (const room of rooms) {
      for (const other of byDistance(
        room,
        rooms.filter((r) => r !== room),
      ).slice(0, LOOP_NEIGHBOURS)) {
        neighbours.set(pairKey(room, other), {
          a: room,
          b: other,
          distance: distanceBetween(room, other),
        });
      }
    }
    for (const { a, b } of [...neighbours.values()].sort(
      (p, q) => p.distance - q.distance,
    )) {
      if (!linked.has(pairKey(a, b)) && options.loopChance > random()) {
        addLink(a, b);
      }
    }

    // dead ends branch off corridors and lead nowhere
    if (deadEnds) {
      for (const corridor of [...corridors]) {
        if (options.deadEndChance > random()) {
          growDeadEnd(corridor);
        }
      }
    }
  };

  for (const room of rooms) {
    registerRoom(room);
  }

  return {
    map,
    exits,
    corridors,
    registerRoom,
    atCapacity,
    slotsOf,
    isExitAllowed,
    addExit,
    ownerOf: ({ x, y }) => owner[y * width + x] as number,
    carve,
    join,
    link: (a, b) => linked.add(pairKey(a, b)),
    connectAll,
    addExtras,
  };
}

function distanceBetween(a: Room, b: Room): number {
  return (
    (a.x + a.width / 2 - b.x - b.width / 2) ** 2 +
    (a.y + a.height / 2 - b.y - b.height / 2) ** 2
  );
}

/** Whether two tiles are the same or next to each other, diagonally too. */
export function touching(a: Point, b: Point): boolean {
  return Math.abs(a.x - b.x) <= 1 && Math.abs(a.y - b.y) <= 1;
}

function manhattan(a: Point, b: Point): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}
