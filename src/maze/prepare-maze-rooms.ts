import { carveRoom } from '../rooms/carve-room';
import { carveTemplate } from '../rooms/templates/carve-template';
import { createTemplateBlocker } from '../rooms/templates/create-template-blocker';
import type { Grid } from '../core/grid';
import type { MazeRoomOptions } from './maze-room-options';
import { MAZE_ROOM_SPACING } from './maze-room-spacing';
import { planMazeRooms } from './plan-maze-rooms';
import { prepareTemplates } from '../rooms/templates/prepare-templates';
import type { Point } from '../core/point';
import type { Random } from '../core/random';
import { resolveDungeonOptions } from '../rooms/resolve-dungeon-options';
import type { Room } from '../rooms/room';
import { TemplateCell } from '../rooms/templates/template-cell';
import type { RoomTemplate } from '../rooms/templates/room-template';
import type { TemplatePlacement } from '../rooms/templates/template-placement';

/** The rooms of a maze, placed and carved. */
export interface PreparedMazeRooms {
  /** Templated rooms first, then the ordinary ones, with ids in that order. */
  rooms: Room[];
  /** Whether a tile belongs to a room, which the maze leaves alone. */
  isBlocked: (x: number, y: number) => boolean;
  /** The placement of each templated room, by room id. */
  placements: TemplatePlacement[];
  /** Whether each `Exit` and `Door` cell of a template gets a door, keyed by `y * width + x`. */
  doors: ReadonlyMap<number, boolean>;
  /** Throws a `TemplatePlacementError` for the templated room with an id. */
  fail: (room: number, problem: string) => never;
}

/**
 * Places the templates and the ordinary rooms of a maze, in this order, and
 * carves them into the grid. The ordinary rooms keep `start` free; the
 * templates do not, so the caller checks it with `isBlocked`.
 */
export function prepareMazeRooms(
  random: Random,
  grid: Grid,
  options: { templates?: RoomTemplate[]; rooms?: MazeRoomOptions },
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
  const ordinary = options.rooms
    ? planMazeRooms(
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

  return {
    rooms,
    isBlocked,
    placements: templated.placements,
    doors: templated.doors,
    fail: templated.fail,
  };
}
