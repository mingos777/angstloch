import type { LayoutSymmetry } from '../layout-symmetry';
import type { DungeonResult } from '../dungeon-result';
import type { Grid } from '../grid';
import type { Point } from '../point';
import type { Room } from '../room';
import { Tile } from '../tile';

export function overlap(a: Room, b: Room, gap: number) {
  return (
    a.x < b.x + b.width + gap &&
    b.x < a.x + a.width + gap &&
    a.y < b.y + b.height + gap &&
    b.y < a.y + a.height + gap
  );
}

export const NEIGHBOURS = [
  { x: 0, y: -1 },
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
];

export function inRoom(room: Room, x: number, y: number) {
  return (
    x >= room.x &&
    x < room.x + room.width &&
    y >= room.y &&
    y < room.y + room.height
  );
}

export function roomAt(rooms: Room[], x: number, y: number) {
  return rooms.find((room) => inRoom(room, x, y));
}

/** Tiles reachable from the first room without crossing a wall. */
export function reachableFrom(result: DungeonResult, room: Room) {
  const { grid } = result;
  const key = (x: number, y: number) => y * grid.width + x;
  const seen = new Set([key(room.x, room.y)]);
  const queue = [{ x: room.x, y: room.y }];
  for (let point = queue.shift(); point; point = queue.shift()) {
    for (const n of NEIGHBOURS) {
      const x = point.x + n.x;
      const y = point.y + n.y;
      if (grid.get(x, y) !== Tile.Wall && !seen.has(key(x, y))) {
        seen.add(key(x, y));
        queue.push({ x, y });
      }
    }
  }
  return (x: number, y: number) => seen.has(key(x, y));
}

export function allTiles(grid: Grid) {
  const tiles: Point[] = [];
  for (let y = 0; y < grid.height; ++y) {
    for (let x = 0; x < grid.width; ++x) {
      tiles.push({ x, y });
    }
  }
  return tiles;
}

/** Corner points where two open tiles touch diagonally with walls on both other tiles of the 2x2 block. */
export function diagonalJumps(grid: Grid) {
  return allTiles(grid).filter(({ x, y }) => {
    const open = (dx: number, dy: number) =>
      grid.get(x + dx, y + dy) !== Tile.Wall;
    return (
      (open(0, 0) && open(1, 1) && !open(1, 0) && !open(0, 1)) ||
      (open(1, 0) && open(0, 1) && !open(0, 0) && !open(1, 1))
    );
  });
}

export function corridorTiles(result: DungeonResult) {
  return allTiles(result.grid).filter(
    ({ x, y }) =>
      result.grid.get(x, y) !== Tile.Wall && !roomAt(result.rooms, x, y),
  );
}

export function deadEnds(result: DungeonResult) {
  return corridorTiles(result).filter(
    ({ x, y }) =>
      NEIGHBOURS.filter((n) => result.grid.get(x + n.x, y + n.y) !== Tile.Wall)
        .length === 1,
  );
}

/** Number of independent cycles in the map, counting every room as a single junction. */
export function cycles(result: DungeonResult) {
  const { grid, rooms } = result;
  const node = (x: number, y: number) => {
    const room = roomAt(rooms, x, y);
    return room ? `room ${String(room.id)}` : `${String(x)},${String(y)}`;
  };
  const nodes = new Set<string>();
  const edges = new Set<string>();
  for (const { x, y } of allTiles(grid)) {
    if (grid.get(x, y) === Tile.Wall) {
      continue;
    }
    nodes.add(node(x, y));
    for (const n of [NEIGHBOURS[1], NEIGHBOURS[2]]) {
      const nx = x + (n as Point).x;
      const ny = y + (n as Point).y;
      const [a, b] = [node(x, y), node(nx, ny)];
      if (grid.get(nx, ny) !== Tile.Wall && a !== b) {
        edges.add([a, b].sort().join(' | '));
      }
    }
  }
  return edges.size - nodes.size + 1;
}

export function isConnected(result: DungeonResult) {
  const first = result.rooms[0];
  const reaches = first && reachableFrom(result, first);
  return result.rooms.every((room) => reaches?.(room.x, room.y));
}

export const SEEDS = [1, 2, 3, 4, 5, 6, 7, 8];

/** Pairs of exits that are the same or next to each other, diagonally too. */
export function touchingExits(result: DungeonResult) {
  return result.exits.flatMap((a, i) =>
    result.exits
      .slice(i + 1)
      .filter(
        (b) =>
          Math.abs(a.position.x - b.position.x) <= 1 &&
          Math.abs(a.position.y - b.position.y) <= 1,
      )
      .map((b) => [a, b]),
  );
}

/** How many tiles differ from the tile at their mirror image. */
export function asymmetry(
  { grid }: DungeonResult,
  symmetry: LayoutSymmetry,
  lattice: boolean,
) {
  const extent = (size: number) =>
    lattice && size % 2 === 0 ? size - 1 : size;
  const [w, h] = [extent(grid.width), extent(grid.height)];
  const flipX = symmetry !== 'vertical';
  const flipY = symmetry !== 'horizontal';
  let differing = 0;
  for (let y = 0; y < grid.height; ++y) {
    for (let x = 0; x < grid.width; ++x) {
      const image = grid.get(flipX ? w - 1 - x : x, flipY ? h - 1 - y : y);
      differing += grid.get(x, y) === image ? 0 : 1;
    }
  }
  return differing;
}
