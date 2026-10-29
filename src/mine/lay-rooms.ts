import type { Area } from '../core/area';
import { DIRECTIONS } from '../core/directions';
import type { Grid } from '../core/grid';
import type { Point } from '../core/point';
import type { Random } from '../core/random';
import { randomInt } from '../core/random-int';
import type { Range } from '../core/range';
import { Tile } from '../core/tile';
import type { NoiseFunction } from '../noise/noise-function';
import { createRoomShape } from '../rooms/create-room-shape';
import { listShapeDoors } from '../rooms/list-shape-doors';
import { pickRoomSize } from '../rooms/pick-room-size';
import type { Exit } from '../rooms/exit';
import type { PlacementArea } from '../rooms/placement-area';
import type { Room } from '../rooms/room';
import type { RoomShape } from '../rooms/room-shape';
import { carveTemplate } from '../rooms/templates/carve-template';
import { decideTemplateDoors } from '../rooms/templates/decide-template-doors';
import { placeTemplateCopies } from '../rooms/templates/place-template-copies';
import type { RoomTemplate } from '../rooms/templates/room-template';
import { TemplateCell } from '../rooms/templates/template-cell';
import type { TemplateExit } from '../rooms/templates/template-exit';
import type { TemplatePlacement } from '../rooms/templates/template-placement';
import { TemplatePlacementError } from '../rooms/templates/template-placement-error';
import { carvePassageTiles } from '../veins/carve-passage-tiles';
import { keepInside, LANE_SPACING, MARGIN } from '../veins/dig-vein';
import type { MinePassage } from '../veins/mine-passage';
import type { MineRoomOptions } from './mine-room-options';
import { measureReach } from './measure-reach';
import type { Reach } from './measure-reach';
import { tracePassage } from '../veins/trace-passage';

/** Wall tiles that stay between a room's footprint and the mine, or another room. */
const SPACING = 2;

/** The settings of the rooms, with the defaults filled in. */
export interface RoomSettings {
  rooms?: MineRoomOptions;
  templates: RoomTemplate[];
  doorChance: number;
  exitsPerRoom: Range;
  veinWidth: Range;
  veinWindiness: number;
  /** Tiles that are never dug or built on, a byte for each tile of the grid, row by row: anything but 0 protects it. Defaults to none. */
  protect?: Uint8Array;
}

/** A room that is placed but not yet joined to the mine. */
interface Pending {
  placement: TemplatePlacement;
  /** Index into the templates, or `undefined` for an ordinary room. */
  template?: number;
  name?: string;
}

/** A way out of a room: the exit cell, and the tile outside it that a tunnel starts at. */
interface Opening {
  exit: TemplateExit;
  outside: Point;
  door: boolean;
}

/**
 * The mine as a placement that the templates keep away from: every tile of
 * floor, and every solid tile, is a cell.
 */
function createMineObstacle(grid: Grid, solid: Uint8Array): TemplatePlacement {
  const cells = Array.from({ length: grid.height }, (_, y) =>
    Array.from({ length: grid.width }, (__, x) =>
      grid.get(x, y) === Tile.Wall && solid[y * grid.width + x] !== 1
        ? TemplateCell.Unused
        : TemplateCell.Floor,
    ),
  );
  return {
    x: 0,
    y: 0,
    width: grid.width,
    height: grid.height,
    cells,
    exits: [],
    rotation: 0,
    mirrored: false,
  };
}

/** How many places to try for an ordinary room. */
const ATTEMPTS = 300;
/** How many of the places that do for an ordinary room to choose the nearest to the mine from. */
const CHOICES = 20;

/**
 * Finds a place for an ordinary room: a box of the given size, walls
 * included, in the rock, `SPACING` tiles clear of the mine and of every solid
 * tile, as near the mine as the places tried allow. Returns nothing when
 * none of them does.
 */
function findRoomSpot(
  grid: Grid,
  random: Random,
  width: number,
  height: number,
  solid: Uint8Array,
): Point | undefined {
  const maxX = grid.width - MARGIN - width;
  const maxY = grid.height - MARGIN - height;
  if (maxX < MARGIN || maxY < MARGIN) {
    return undefined;
  }
  const { distance } = measureReach(grid, solid);
  const free = (x: number, y: number): boolean =>
    !grid.inBounds(x, y) ||
    (grid.get(x, y) === Tile.Wall && solid[y * grid.width + x] !== 1);
  let best: { spot: Point; reach: number } | undefined;
  let found = 0;
  for (let attempt = 0; attempt < ATTEMPTS && found < CHOICES; ++attempt) {
    const x = randomInt(random, MARGIN, maxX);
    const y = randomInt(random, MARGIN, maxY);
    let clear = true;
    for (let dy = -SPACING; clear && dy < height + SPACING; ++dy) {
      for (let dx = -SPACING; clear && dx < width + SPACING; ++dx) {
        clear = free(x + dx, y + dy);
      }
    }
    if (!clear) {
      continue;
    }
    // how far the tile outside the middle of each side is from the mine
    const outside = [
      { x: x + Math.floor(width / 2), y: y - 1 },
      { x: x + Math.floor(width / 2), y: y + height },
      { x: x - 1, y: y + Math.floor(height / 2) },
      { x: x + width, y: y + Math.floor(height / 2) },
    ].map(({ x: ox, y: oy }) => distance[oy * grid.width + ox] ?? -1);
    const reach = Math.min(...outside.filter((value) => value > 0), Infinity);
    if (reach === Infinity) {
      continue;
    }
    ++found;
    if (!best || reach < best.reach) {
      best = { spot: { x, y }, reach };
    }
  }
  return best?.spot;
}

/** Marks the tiles of a room's footprint, walls included, in a mask of the map. */
function mark(
  mask: Uint8Array,
  mapWidth: number,
  { placement }: Pending,
  value: 0 | 1,
): void {
  placement.cells.forEach((row, dy) => {
    row.forEach((cell, dx) => {
      if (cell !== TemplateCell.Unused) {
        mask[(placement.y + dy) * mapWidth + placement.x + dx] = value;
      }
    });
  });
}

/** Clips the areas to the interior of the map. */
function clip(areas: readonly Area[] | undefined, interior: Area): Area[] {
  const clipped = (areas ?? []).flatMap((area) => {
    const x = Math.max(area.x, interior.x);
    const y = Math.max(area.y, interior.y);
    const right = Math.min(area.x + area.width, interior.x + interior.width);
    const bottom = Math.min(area.y + area.height, interior.y + interior.height);
    return right > x && bottom > y
      ? [{ x, y, width: right - x, height: bottom - y }]
      : [];
  });
  return clipped.length > 0 ? clipped : [interior];
}

/**
 * Decides how a room opens onto the mine: every `Exit` and `Door` that leads
 * outside, and as many `OptionalExit` cells as `exitsPerRoom` asks for beyond
 * them, at least one in all, the ones nearest the mine first and none next to
 * another opening, diagonally included. An exit starts
 * its tunnel at the free tile outside it that is nearest the mine. Returns
 * why it cannot be done, when it cannot.
 */
function planOpenings(
  random: Random,
  grid: Grid,
  pending: Pending,
  reach: Reach,
  doors: ReadonlyMap<number, boolean>,
  settings: RoomSettings,
): Opening[] | string {
  const { placement } = pending;
  const outsideOf = (exit: TemplateExit): Point | undefined => {
    let best: Point | undefined;
    let bestDistance = Infinity;
    for (const direction of exit.directions) {
      const step = DIRECTIONS[direction];
      if (!step) {
        continue;
      }
      const x = placement.x + exit.x + step.x;
      const y = placement.y + exit.y + step.y;
      const distance = reach.distance[y * grid.width + x] ?? -1;
      if (
        x >= MARGIN &&
        y >= MARGIN &&
        x < grid.width - MARGIN &&
        y < grid.height - MARGIN &&
        distance > 0 &&
        distance < bestDistance
      ) {
        best = { x, y };
        bestDistance = distance;
      }
    }
    return best;
  };
  const distanceTo = ({ x, y }: Point) =>
    reach.distance[y * grid.width + x] ?? 0;

  const openings: Opening[] = [];
  const optional: { exit: TemplateExit; outside: Point }[] = [];
  for (const exit of placement.exits) {
    const outside = outsideOf(exit);
    if (exit.kind === TemplateCell.OptionalExit) {
      if (outside) {
        optional.push({ exit, outside });
      }
    } else if (outside) {
      const at = (placement.y + exit.y) * grid.width + placement.x + exit.x;
      openings.push({ exit, outside, door: doors.get(at) ?? true });
    } else {
      return `the exit at (${String(placement.x + exit.x)}, ${String(placement.y + exit.y)}) has no free tile outside it to join the mine from`;
    }
  }
  const wanted = randomInt(
    random,
    settings.exitsPerRoom.min,
    settings.exitsPerRoom.max,
  );
  const more = Math.max(
    openings.length === 0 ? 1 : 0,
    wanted - openings.length,
  );
  optional.sort((a, b) => distanceTo(a.outside) - distanceTo(b.outside));
  // an opening is never next to another, diagonally included
  const nextToOpening = (exit: TemplateExit): boolean =>
    openings.some(
      (opened) =>
        Math.abs(opened.exit.x - exit.x) <= 1 &&
        Math.abs(opened.exit.y - exit.y) <= 1,
    );
  let added = 0;
  for (const { exit, outside } of optional) {
    if (added >= more) {
      break;
    }
    if (!nextToOpening(exit)) {
      openings.push({ exit, outside, door: random() < settings.doorChance });
      ++added;
    }
  }
  return openings.length > 0
    ? openings
    : 'cannot be joined to the mine, with no room around it for a tunnel';
}

/**
 * Digs a tunnel from the tile outside a room's exit to the nearest tile of the
 * mine. It winds as the veins do, and when that would cross a room, it follows
 * the shortest way round instead. Returns the tunnel.
 */
function digTunnel(
  grid: Grid,
  random: Random,
  noise: NoiseFunction,
  start: Point,
  reach: Reach,
  solid: Uint8Array,
  settings: RoomSettings,
  lane: number,
): MinePassage {
  const width = randomInt(
    random,
    settings.veinWidth.min,
    settings.veinWidth.max,
  );
  const direct: Point[] = [];
  for (
    let at = start.y * grid.width + start.x;
    at !== -1;
    at = reach.next[at] ?? -1
  ) {
    direct.push({ x: at % grid.width, y: Math.floor(at / grid.width) });
  }
  const end = direct[direct.length - 1] ?? start;
  const winding = keepInside(
    grid,
    tracePassage(grid.width, grid.height, noise, {
      from: start,
      to: end,
      width,
      windiness: settings.veinWindiness,
      lane,
    }),
  );
  const tiles = winding.some(({ x, y }) => solid[y * grid.width + x] === 1)
    ? direct
    : winding;
  carvePassageTiles(grid, tiles, width, MARGIN, undefined, solid);
  return { kind: 'tunnel', tiles, width };
}

/**
 * Places the templated and the ordinary rooms of a mine in the rock beside the
 * tunnels, apart from them and from each other, and joins each to the mine by
 * a tunnel from every exit it opens. Ordinary rooms that find no room, or that
 * cannot be joined, are left out, and a template that cannot be placed or
 * joined throws a `TemplatePlacementError`. Nothing is built on a tile of
 * `protect`, and its floor is not the mine. Returns the rooms with ids from 0,
 * their exits, the tunnels, and the shape of every room, by id.
 */
export function layRooms(
  grid: Grid,
  random: Random,
  noise: NoiseFunction,
  settings: RoomSettings,
  lane: number,
): {
  rooms: Room[];
  roomExits: Exit[];
  passages: MinePassage[];
  roomShapes: RoomShape[];
} {
  const none = { rooms: [], roomExits: [], passages: [], roomShapes: [] };
  const { width: mapWidth, height: mapHeight } = grid;
  const interior: Area = {
    x: MARGIN,
    y: MARGIN,
    width: mapWidth - 2 * MARGIN,
    height: mapHeight - 2 * MARGIN,
  };
  if (interior.width < 1 || interior.height < 1) {
    return none;
  }
  const area: PlacementArea = {
    width: mapWidth,
    height: mapHeight,
    spacing: SPACING,
    lattice: false,
  };
  const solid = new Uint8Array(mapWidth * mapHeight);
  settings.protect?.forEach((value, at) => {
    if (value !== 0) {
      solid[at] = 1;
    }
  });
  const mine = createMineObstacle(grid, solid);
  const pending: Pending[] = [];
  const obstacles = () => [mine, ...pending.map(({ placement }) => placement)];

  settings.templates.forEach((template, index) => {
    const copies = placeTemplateCopies(
      random,
      { ...template, areas: clip(template.areas, interior) },
      index,
      area,
      obstacles(),
    );
    for (const placement of copies) {
      pending.push({ placement, template: index, name: template.name });
    }
  });
  for (const room of pending) {
    mark(solid, mapWidth, room, 1);
  }
  if (settings.rooms) {
    const { count, width, height, sizeUniformity } = {
      count: { min: 1, max: 1 },
      width: { min: 3, max: 7 },
      height: { min: 3, max: 7 },
      sizeUniformity: 0,
      ...settings.rooms,
    };
    const wanted =
      interior.width < 3 || interior.height < 3
        ? 0
        : randomInt(random, count.min, count.max);
    for (let n = 0; n < wanted; ++n) {
      const floorWidth = Math.min(
        interior.width - 2,
        pickRoomSize(random, width, 1, sizeUniformity),
      );
      const floorHeight = Math.min(
        interior.height - 2,
        pickRoomSize(random, height, 1, sizeUniformity),
      );
      const spot = findRoomSpot(
        grid,
        random,
        floorWidth + 2,
        floorHeight + 2,
        solid,
      );
      if (!spot) {
        continue;
      }
      const room: Pending = {
        placement: createRoomShape({
          x: spot.x + 1,
          y: spot.y + 1,
          width: floorWidth,
          height: floorHeight,
        }),
      };
      pending.push(room);
      mark(solid, mapWidth, room, 1);
    }
  }
  const doors = decideTemplateDoors(
    random,
    pending.map(({ placement }) => placement),
    [],
    settings.doorChance,
    mapWidth,
  );

  const kept: { room: Pending; openings: Opening[] }[] = [];
  const passages: MinePassage[] = [];
  for (const room of pending) {
    const reach = measureReach(grid, solid);
    const openings = planOpenings(random, grid, room, reach, doors, settings);
    if (typeof openings === 'string') {
      if (room.template !== undefined) {
        throw new TemplatePlacementError(room.template, room.name, openings);
      }
      mark(solid, mapWidth, room, 0);
      continue;
    }
    for (const { outside } of openings) {
      passages.push(
        digTunnel(
          grid,
          random,
          noise,
          outside,
          measureReach(grid, solid),
          solid,
          settings,
          lane + passages.length * LANE_SPACING,
        ),
      );
    }
    kept.push({ room, openings });
  }

  const rooms: Room[] = [];
  const roomExits: Exit[] = [];
  const roomShapes: RoomShape[] = [];
  kept.forEach(({ room, openings }, id) => {
    const { placement } = room;
    carveTemplate(grid, placement, doors);
    const ordinary = room.template === undefined;
    const record: Room = {
      id,
      x: placement.x + (ordinary ? 1 : 0),
      y: placement.y + (ordinary ? 1 : 0),
      width: placement.width - (ordinary ? 2 : 0),
      height: placement.height - (ordinary ? 2 : 0),
      exits: [],
      exitCount: 0,
      doorCount: 0,
      ...(room.template === undefined
        ? {}
        : {
            template: room.template,
            rotation: placement.rotation,
            mirrored: placement.mirrored,
          }),
    };
    for (const { exit, door } of openings) {
      const position = { x: placement.x + exit.x, y: placement.y + exit.y };
      grid.set(position.x, position.y, door ? Tile.Door : Tile.Floor);
      record.exits.push(roomExits.length);
      roomExits.push({ position, rooms: [id], door });
      if (door) {
        ++record.doorCount;
      }
    }
    record.exitCount = record.exits.length;
    rooms.push(record);
    roomShapes.push({
      ...placement,
      doors: listShapeDoors(placement, doors, mapWidth),
    });
  });
  return { rooms, roomExits, passages, roomShapes };
}
