import { carveRoom } from './carve-room';
import { carveTemplate } from './carve-template';
import { createTemplateBlocker } from './create-template-blocker';
import { findRoomOpenings } from './find-room-openings';
import { findTemplateOpenings } from './find-template-openings';
import type { Grid } from './grid';
import { linkMazeCell } from './link-maze-cell';
import type { MazeOpening } from './maze-opening';
import type { MazeOptions } from './maze-options';
import { MAZE_ROOM_SPACING } from './maze-room-spacing';
import { placeMazeRooms } from './place-maze-rooms';
import { prepareTemplates } from './prepare-templates';
import type { Point } from './point';
import type { Random } from './random';
import { resolveDungeonOptions } from './resolve-dungeon-options';
import type { Room } from './room';
import { TemplateCell } from './template-cell';

/** The rooms of a maze, placed and carved, and the ways to open them. */
export interface PreparedMazeRooms {
  /** Templated rooms first, then the ordinary ones, with ids in that order. */
  rooms: Room[];
  /** Ways to open the rooms onto the maze, to be made once the maze is carved. */
  openings: MazeOpening[];
  /** Whether a tile belongs to a room, which the maze leaves alone. */
  isBlocked: (x: number, y: number) => boolean;
  /** Carves the maze cells in front of the fixed exits of templated rooms where the maze has not reached them, so that the exits lead somewhere. Throws a `TemplatePlacementError` when that is impossible. */
  reachExits: () => void;
}

/**
 * Places the templates and the ordinary rooms of a maze, in this order, and
 * carves them into the grid. Keeps `start` free, as far as the ordinary rooms
 * go; a `start` inside a templated room throws a `RangeError`.
 */
export function prepareMazeRooms(
  random: Random,
  grid: Grid,
  options: MazeOptions,
  start: Point | undefined,
  doorChance: number,
): PreparedMazeRooms {
  const { width, height } = grid;
  const resolved = resolveDungeonOptions({
    width,
    height,
    random,
    placement: 'lattice',
    roomSpacing: MAZE_ROOM_SPACING,
    doorChance,
  });
  const templated = prepareTemplates(
    random,
    { width, height, templates: options.templates },
    resolved,
    'none',
  );
  const solid = new Uint8Array(width * height);
  const isBlocked = (x: number, y: number): boolean =>
    solid[y * width + x] === 1;

  const rooms = templated.rooms();
  templated.placements.forEach((placement) => {
    carveTemplate(grid, placement, templated.doors);
    placement.cells.forEach((row, dy) => {
      row.forEach((cell, dx) => {
        if (cell !== TemplateCell.Unused) {
          solid[(placement.y + dy) * width + placement.x + dx] = 1;
        }
      });
    });
  });
  if (start && isBlocked(start.x, start.y)) {
    throw new RangeError(
      `start (${String(start.x)}, ${String(start.y)}) is inside a templated room`,
    );
  }

  const ordinary = options.rooms
    ? placeMazeRooms(
        random,
        width,
        height,
        options.rooms,
        start,
        createTemplateBlocker(
          templated.placements,
          width,
          height,
          MAZE_ROOM_SPACING,
        ),
      )
    : [];
  const templatedCount = rooms.length;
  for (const room of ordinary) {
    const placed = { ...room, id: room.id + templatedCount };
    carveRoom(grid, placed);
    for (let y = placed.y; y < placed.y + placed.height; ++y) {
      solid.fill(1, y * width + placed.x, y * width + placed.x + placed.width);
    }
    rooms.push(placed);
  }

  const openings: MazeOpening[] = [];
  templated.placements.forEach((placement, id) => {
    const room = rooms[id];
    if (room) {
      openings.push(
        ...findTemplateOpenings(
          placement,
          room,
          templated.doors,
          width,
          height,
          isBlocked,
        ),
      );
    }
  });
  for (const room of rooms.slice(templated.placements.length)) {
    openings.push(...findRoomOpenings(room, width, height, isBlocked));
  }

  const reachExits = (): void => {
    const fixed = openings.filter((opening) => opening.fixed);
    for (const { wall } of fixed) {
      const group = fixed.filter(
        (other) => other.wall.x === wall.x && other.wall.y === wall.y,
      );
      if (
        !group.some((other) => linkMazeCell(grid, other.outside, isBlocked))
      ) {
        templated.fail(
          group[0]?.room.id ?? 0,
          `the exit at (${String(wall.x)}, ${String(wall.y)}) cannot be joined to the maze`,
        );
      }
    }
  };
  return { rooms, openings, isBlocked, reachExits };
}
