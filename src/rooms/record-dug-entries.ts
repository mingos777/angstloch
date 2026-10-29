import { DIRECTIONS } from '../core/directions';
import type { Grid } from '../core/grid';
import type { Point } from '../core/point';
import { Tile } from '../core/tile';
import type { Exit } from './exit';
import type { Room } from './room';
import type { RoomShape } from './room-shape';
import { TemplateCell } from './templates/template-cell';

/** The rooms and their exits, as `recordDugEntries` takes and returns them. */
export interface RoomEntries {
  rooms: Room[];
  roomExits: Exit[];
}

/**
 * Records the ways into rooms that a step dug, as exits. A tile that was the
 * base in `before` and is open in `grid` is a way into each of the rooms
 * `entered` that holds it in its shape, or whose floor it touches along an
 * edge, which is how a hall or a cavern, whose shape is its floor alone, is
 * entered. The tiles of one room that touch each other along an edge are one
 * way in, so a wide vein makes one exit. A way in that holds an exit from
 * index `first` on (one the step made, or one this made for another room)
 * joins that exit; any other gets an exit of its own at its middle tile, in
 * row order, with a door when the tile is one.
 * Returns the rooms with their new exits and the exits with the new ones
 * appended.
 */
export function recordDugEntries(
  before: Grid,
  grid: Grid,
  base: Tile,
  { rooms, roomExits }: RoomEntries,
  roomShapes: readonly RoomShape[],
  entered: readonly Room[],
  first: number,
): RoomEntries {
  const { width } = grid;
  const dug = (x: number, y: number): boolean =>
    grid.inBounds(x, y) && before.get(x, y) === base && grid.get(x, y) !== base;
  const exits = roomExits.map((exit) => ({ ...exit, rooms: [...exit.rooms] }));
  // the exits each room gets, by its id
  const added = new Map<number, number[]>();
  for (const room of entered) {
    const shape = roomShapes[room.id];
    if (!shape) {
      continue;
    }
    const cellAt = (x: number, y: number): TemplateCell =>
      shape.cells[y - shape.y]?.[x - shape.x] ?? TemplateCell.Unused;
    const holds = (x: number, y: number): boolean =>
      cellAt(x, y) !== TemplateCell.Unused ||
      DIRECTIONS.some(
        (step) => cellAt(x + step.x, y + step.y) === TemplateCell.Floor,
      );
    const ways = new Set<number>();
    for (let y = shape.y - 1; y <= shape.y + shape.height; ++y) {
      for (let x = shape.x - 1; x <= shape.x + shape.width; ++x) {
        if (dug(x, y) && holds(x, y)) {
          ways.add(y * width + x);
        }
      }
    }
    for (const way of groupTiles(ways, width)) {
      const known = exits.findIndex(
        ({ position }, index) =>
          index >= first &&
          way.some(({ x, y }) => x === position.x && y === position.y),
      );
      const index = known === -1 ? exits.length : known;
      if (known === -1) {
        const position = way[Math.floor((way.length - 1) / 2)] as Point;
        exits.push({
          position,
          rooms: [],
          door: grid.get(position.x, position.y) === Tile.Door,
        });
      }
      const exit = exits[index] as Exit;
      if (!exit.rooms.includes(room.id)) {
        exit.rooms.push(room.id);
        added.set(room.id, [...(added.get(room.id) ?? []), index]);
      }
    }
  }
  return {
    rooms: rooms.map((room) => {
      const indices = added.get(room.id);
      return indices
        ? {
            ...room,
            exits: [...room.exits, ...indices],
            exitCount: room.exitCount + indices.length,
            doorCount:
              room.doorCount +
              indices.filter((index) => exits[index]?.door).length,
          }
        : room;
    }),
    roomExits: exits,
  };
}

/** Splits the tiles, keyed by `y * width + x`, into groups that touch along edges, each in row order. */
function groupTiles(tiles: ReadonlySet<number>, width: number): Point[][] {
  const seen = new Set<number>();
  const groups: Point[][] = [];
  for (const start of [...tiles].sort((a, b) => a - b)) {
    if (seen.has(start)) {
      continue;
    }
    seen.add(start);
    const group: number[] = [];
    for (const queue = [start]; queue.length > 0;) {
      const at = queue.pop() as number;
      group.push(at);
      const x = at % width;
      for (const next of [
        at - width,
        at + width,
        x > 0 ? at - 1 : -1,
        x < width - 1 ? at + 1 : -1,
      ]) {
        if (tiles.has(next) && !seen.has(next)) {
          seen.add(next);
          queue.push(next);
        }
      }
    }
    groups.push(
      group
        .sort((a, b) => a - b)
        .map((at) => ({ x: at % width, y: Math.floor(at / width) })),
    );
  }
  return groups;
}
