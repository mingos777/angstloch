import type { Point } from '../core/point';
import type { Random } from '../core/random';
import { Tile } from '../core/tile';
import { isFree } from '../pipeline/is-free';
import { joinTouchingPieces } from '../pipeline/join-touching-pieces';
import type { MapState } from '../pipeline/map-state';
import { openReserved } from '../pipeline/open-reserved';
import { Reserve } from '../pipeline/reserve';
import type { Exit } from '../rooms/exit';
import { isFeatureRoom } from '../rooms/is-feature-room';
import { recordDugEntries } from '../rooms/record-dug-entries';
import { reserveRoomShape } from '../rooms/reserve-room-shape';
import type { Room } from '../rooms/room';
import type { RoomShape } from '../rooms/room-shape';
import { createTransforms } from '../rooms/templates/create-transforms';
import type { Transform } from '../rooms/templates/create-transforms';
import { TemplateCell } from '../rooms/templates/template-cell';
import { TemplatePlacementError } from '../rooms/templates/template-placement-error';
import type { DigCorridorsOptions } from './dig-corridors-options';
import { connectRooms } from './connect-rooms';
import { createSteering } from './create-steering';
import { findStandIns } from './find-stand-ins';
import type { PlacedRooms } from './placed-rooms';

/**
 * Times the corridors are routed before a templated room that is cut off
 * fails the attempt. Routing again rarely helps, since the rooms stay where
 * they are: over 1,200 maps of `check:dungeon` with 5 to 20 templates, a
 * second routing saved 6 and later ones none, so a new map comes soon.
 */
const MAX_ROUTINGS = 3;

/** The options of `digCorridors` with every default filled in. */
export type CorridorSettings = Required<DigCorridorsOptions>;

/** The extras that `digCorridors` adds. */
export interface JoinedRooms extends PlacedRooms {
  roomExits: Exit[];
}

/** The rooms that one routing joined, by their place in the list it was given, or why it failed. */
type Routing =
  | {
      scratch: MapState;
      kept: Room[];
      rooms: Room[];
      exits: Exit[];
      entered: Point[];
    }
  | { error: Error };

/**
 * Joins the rooms that have no exits yet with corridors, the core of
 * `digCorridors`. There may be no rooms: the pieces of floor are joined alone. Each try routes on a copy of the map, so a try that fails
 * leaves nothing behind; an ordinary room that cannot be joined is dropped,
 * with its twins, and the rest are routed again. A templated room is never
 * dropped: after `MAX_ROUTINGS` tries in which one is cut off, it throws a
 * `TemplatePlacementError`. `onTry` is called before each try, for
 * `check:dungeon` to count them.
 *
 * Every piece of floor outside the rooms that are joined (see
 * `findStandIns`) is joined too, as a stand-in room that is never dropped: one
 * that is cut off fails like a templated room, with a plain `Error`. Rooms
 * that have exits already count as one with the floor their doors open onto,
 * so a stand-in may hold rooms, such as the cells and the guard room of a cell
 * block with its corridor. A corridor that reaches a stand-in opens its wall
 * into floor, which is no exit of the result. Where that wall was reserved
 * `Openable`, the entrance of a cell block, it is opened through
 * `openReserved` and gets a door by `doorChance`, and where it is in the shape
 * of a room that had exits already, it becomes an exit of that room too. Such
 * an entrance with the floor of another piece right beyond it is opened first,
 * the same way, with no corridor (see `joinTouchingPieces`). Where a corridor
 * or such an entrance enters a hall or a cavern, that is an exit of the hall or
 * the cavern (see `recordDugEntries`).
 */
export function joinRooms(
  given: MapState & Partial<PlacedRooms> & Partial<JoinedRooms>,
  random: Random,
  settings: CorridorSettings,
  onTry?: () => void,
): JoinedRooms {
  // no rooms is a map of features alone, such as halls, which are joined all the same
  const state = {
    ...given,
    rooms: given.rooms ?? [],
    roomShapes: given.roomShapes ?? [],
  };
  const { width, height } = state.grid;
  // to tell where the corridors entered the halls and caverns
  const before = state.grid.clone();
  // halls and caverns are joined as stand-ins, on their floor
  const joining = state.rooms.filter(
    (room) =>
      room.exitCount === 0 && !isFeatureRoom(room) && state.roomShapes[room.id],
  );
  const shapeOf = (room: Room): RoomShape =>
    state.roomShapes[room.id] as RoomShape;
  // an entrance that the floor beyond reaches already needs no corridor, but
  // the rooms to join are entered through their own exits
  const covered = new Uint8Array(width * height);
  for (const shape of joining.map(shapeOf)) {
    shape.cells.forEach((row, dy) => {
      row.forEach((cell, dx) => {
        if (cell !== TemplateCell.Unused) {
          covered[(shape.y + dy) * width + shape.x + dx] = 1;
        }
      });
    });
  }
  const touched = joinTouchingPieces(state, covered);
  for (const { x, y } of touched) {
    if (random() < settings.doorChance) {
      state.grid.set(x, y, Tile.Door);
    }
  }
  const lattice = settings.placement === 'lattice';
  const transforms =
    settings.symmetry === 'none'
      ? []
      : createTransforms(settings.symmetry, width, height, lattice);
  const steered =
    settings.corridorSymmetry !== 'none' && settings.corridorSymmetryChance > 0;
  const steering = createSteering({
    ...settings,
    width,
    height,
    lattice,
    random,
  });

  /** Routes the corridors once, on a copy of the map. */
  const route = (): Routing => {
    const scratch: MapState = {
      ...state,
      grid: state.grid.clone(),
      prunable: state.prunable.slice(),
      reserved: state.reserved.slice(),
    };
    let kept = joining;
    for (;;) {
      // rooms with exits are part of the stand-in their doors open onto
      const standIns = findStandIns(scratch, kept.map(shapeOf));
      const doors = new Map(
        kept
          .map(shapeOf)
          .flatMap(({ doors: decided }) =>
            decided.map(({ x, y, door }) => [y * width + x, door] as const),
          ),
      );
      const shapes = [...kept.map(shapeOf), ...standIns.shapes];
      // the potential exits of stand-ins that something reserved as its way in
      const entrances = new Set(
        standIns.shapes.flatMap((shape) =>
          shape.exits
            .map(({ x, y }) => (shape.y + y) * width + shape.x + x)
            .filter((at) => scratch.reserved[at] === Reserve.Openable),
        ),
      );
      const blocked = new Uint8Array(width * height);
      const sealed = new Uint8Array(width * height);
      for (let y = 0; y < height; ++y) {
        for (let x = 0; x < width; ++x) {
          blocked[y * width + x] =
            isFree(scratch, x, y) && standIns.holes[y * width + x] === 0
              ? 0
              : 1;
          sealed[y * width + x] =
            scratch.reserved[y * width + x] === Reserve.Solid ? 1 : 0;
        }
      }
      const rooms: Room[] = [...kept, ...standIns.floors].map((room, id) => ({
        kind: 'room' as const,
        ...room,
        id,
        exits: [],
        exitCount: 0,
        doorCount: 0,
      }));
      const grid = scratch.grid.clone();
      const { exits, stranded, unconnected } = connectRooms(
        grid,
        rooms,
        random,
        {
          ...settings,
          lattice,
          layout: { transforms, chance: settings.symmetryChance },
          steering: steered ? steering : undefined,
          shapes,
          doors,
          blocked,
          sealed,
          firstStandIn: kept.length,
          entrances,
        },
      );
      const [lost] = unconnected;
      if (lost) {
        const room = kept[lost.room] as Room;
        return {
          error: templateError(
            room,
            `the exit at (${String(lost.position.x)}, ${String(lost.position.y)}) of room ${String(room.id)} cannot be joined to the rest of the dungeon`,
          ),
        };
      }
      const strandedFloor = stranded.find((id) => id >= kept.length);
      if (strandedFloor !== undefined) {
        const { x, y } = standIns.firsts[strandedFloor - kept.length] as Point;
        return {
          error: new Error(
            `the floor at (${String(x)}, ${String(y)}), which is no room, cannot be joined to the rest of the dungeon; leave free rock round it for a corridor to reach it`,
          ),
        };
      }
      const cutOff = stranded
        .map((id) => kept[id] as Room)
        .find((room) => room.template !== undefined);
      if (cutOff) {
        return {
          error: templateError(
            cutOff,
            `room ${String(cutOff.id)} cannot be joined to the rest of the dungeon`,
          ),
        };
      }
      if (stranded.length === 0) {
        // the exits into stand-ins are plain openings, not exits of rooms
        const index = new Map<number, number>();
        const roomExits = exits.filter((exit, i) => {
          const ofRooms = exit.rooms.every((id) => id < kept.length);
          if (ofRooms) {
            index.set(i, index.size);
          }
          return ofRooms;
        });
        return {
          scratch: { ...scratch, grid },
          kept,
          rooms: rooms.slice(0, kept.length).map((room) => ({
            ...room,
            exits: room.exits.map((i) => index.get(i) as number),
          })),
          exits: roomExits,
          entered: exits
            .map(({ position }) => position)
            .filter(({ x, y }) => entrances.has(y * width + x)),
        };
      }
      const dropped = withTwins(stranded, rooms, transforms);
      for (const id of dropped) {
        erase(scratch, shapeOf(kept[id] as Room));
      }
      kept = kept.filter((_, id) => !dropped.has(id));
      // a wall that a dropped room shared is the other room's alone again
      for (const room of kept) {
        reserveRoomShape(scratch, shapeOf(room));
      }
    }
  };

  for (let tries = 1; ; ++tries) {
    onTry?.();
    const routed = route();
    if ('scratch' in routed) {
      const joined = finish(state, joining, routed, touched);
      return {
        ...joined,
        ...recordDugEntries(
          before,
          state.grid,
          state.base,
          joined,
          joined.roomShapes,
          joined.rooms.filter(isFeatureRoom),
          state.roomExits?.length ?? 0,
        ),
      };
    }
    if (tries === MAX_ROUTINGS) {
      throw routed.error;
    }
  }
}

/** The error of a templated room that is cut off. */
function templateError(room: Room, problem: string): TemplatePlacementError {
  return new TemplatePlacementError(room.template ?? 0, undefined, problem);
}

/** The ids of the stranded rooms and of the ordinary rooms that are their mirror images. */
function withTwins(
  stranded: number[],
  rooms: Room[],
  transforms: Transform[],
): Set<number> {
  const dropped = new Set(stranded);
  for (const id of stranded) {
    for (const transform of transforms) {
      const image = transform.room(rooms[id] as Room);
      const twin = rooms.find(
        (room) =>
          room.template === undefined &&
          room.x === image.x &&
          room.y === image.y &&
          room.width === image.width &&
          room.height === image.height,
      );
      if (twin) {
        dropped.add(twin.id);
      }
    }
  }
  return dropped;
}

/** Turns the footprint of a room back into untouched ground. */
function erase(state: MapState, shape: RoomShape): void {
  shape.cells.forEach((row, dy) => {
    row.forEach((cell, dx) => {
      if (cell !== TemplateCell.Unused) {
        const [x, y] = [shape.x + dx, shape.y + dy];
        state.grid.set(x, y, state.base);
        state.reserved[y * state.grid.width + x] = Reserve.None;
      }
    });
  });
}

/**
 * Copies a routing that joined every room back into the map, opens its exits,
 * and returns the rooms without the dropped ones, renumbered together with
 * their shapes and the exits. The walls opened into a stand-in, by a corridor
 * or by `joinTouchingPieces` (`touched`), become exits of the rooms that had
 * exits already and whose shapes hold them.
 */
function finish(
  state: MapState & PlacedRooms & Partial<JoinedRooms>,
  joining: Room[],
  routed: Extract<Routing, { scratch: MapState }>,
  touched: readonly Point[],
): JoinedRooms {
  const { grid, reserved } = state;
  for (let y = 0; y < grid.height; ++y) {
    for (let x = 0; x < grid.width; ++x) {
      grid.set(x, y, routed.scratch.grid.get(x, y));
    }
  }
  reserved.set(routed.scratch.reserved);
  for (const { position } of routed.exits) {
    openReserved(state, position.x, position.y);
  }
  for (const { x, y } of routed.entered) {
    openReserved(state, x, y);
  }

  const kept = new Set(routed.kept.map(({ id }) => id));
  const dropped = new Set(
    joining.filter(({ id }) => !kept.has(id)).map(({ id }) => id),
  );
  const newId = new Map<number, number>();
  for (const room of state.rooms) {
    if (!dropped.has(room.id)) {
      newId.set(room.id, newId.size);
    }
  }
  const renumber = (ids: number[]): number[] =>
    ids.map((id) => newId.get(id) as number);
  const firstExit = state.roomExits?.length ?? 0;
  const joined = new Map(
    routed.kept.map((room, index) => [room.id, routed.rooms[index] as Room]),
  );
  const entries = findEntries(
    state,
    state.rooms.filter(
      (room) => !joining.includes(room) && !isFeatureRoom(room),
    ),
    [...touched, ...routed.entered],
  );
  const firstEntry = firstExit + routed.exits.length;
  // the entries into each room, by their place in `entries`
  const entered = new Map<number, number[]>();
  entries.forEach((entry, index) => {
    for (const id of entry.rooms) {
      entered.set(id, [...(entered.get(id) ?? []), index]);
    }
  });
  return {
    rooms: state.rooms
      .filter(({ id }) => !dropped.has(id))
      .map((room) => {
        const done = joined.get(room.id);
        return {
          ...room,
          id: newId.get(room.id) as number,
          ...(done && {
            exits: done.exits.map((exit) => exit + firstExit),
            exitCount: done.exitCount,
            doorCount: done.doorCount,
          }),
          ...(entered.has(room.id) && {
            exits: [
              ...room.exits,
              ...(entered.get(room.id) ?? []).map((i) => firstEntry + i),
            ],
            exitCount: room.exitCount + (entered.get(room.id) ?? []).length,
            doorCount:
              room.doorCount +
              (entered.get(room.id) ?? []).filter((i) => entries[i]?.door)
                .length,
          }),
        };
      }),
    roomShapes: state.roomShapes.filter((_, id) => !dropped.has(id)),
    roomExits: [
      ...(state.roomExits ?? []).map((exit) => ({
        ...exit,
        rooms: renumber(exit.rooms),
      })),
      ...routed.exits.map((exit) => ({
        ...exit,
        rooms: renumber(
          exit.rooms.map((local) => (routed.kept[local] as Room).id),
        ),
      })),
      ...entries.map((exit) => ({ ...exit, rooms: renumber(exit.rooms) })),
    ],
  };
}

/** The exits of the opened walls that lie in the shapes of the rooms, each with the rooms that hold it, by their ids before renumbering. */
function findEntries(
  state: MapState & PlacedRooms,
  rooms: readonly Room[],
  walls: readonly Point[],
): Exit[] {
  return walls.flatMap((position) => {
    const ids = rooms
      .filter((room) => {
        const shape = state.roomShapes[room.id];
        const cell =
          shape?.cells[position.y - shape.y]?.[position.x - shape.x] ??
          TemplateCell.Unused;
        return cell !== TemplateCell.Unused;
      })
      .map(({ id }) => id);
    return ids.length > 0
      ? [
          {
            position,
            rooms: ids,
            door: state.grid.get(position.x, position.y) === Tile.Door,
          },
        ]
      : [];
  });
}
