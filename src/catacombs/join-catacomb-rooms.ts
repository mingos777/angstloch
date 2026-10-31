import { DIRECTIONS } from '../core/directions';
import type { Point } from '../core/point';
import type { Random } from '../core/random';
import { Tile } from '../core/tile';
import { isFree } from '../pipeline/is-free';
import type { MapState } from '../pipeline/map-state';
import { Reserve } from '../pipeline/reserve';
import type { RoomShape } from '../rooms/room-shape';
import { TemplateCell } from '../rooms/templates/template-cell';
import type { CatacombMirror } from './create-catacomb-mirrors';
import { createRoots } from './create-roots';
import type { LatticeEdge } from './lattice';

/** A room in the area of a catacomb, to be entered from its galleries. */
export interface CatacombRoom {
  shape: RoomShape;
  /** Whether the room must be joined, as a crypt must, or may be left as it is. */
  must: boolean;
  /** Throws the error that fails the attempt for the room. */
  fail: (problem: string) => never;
}

/** Where a passage enters a room: the opened tile of its wall, and the floor dug from it to a gallery. */
export interface CatacombEntry {
  /** The index of the room among those given. */
  room: number;
  wall: Point;
  door: boolean;
  /** The tiles from the one outside the wall up to the gallery, none when the wall faces the gallery. */
  passage: Point[];
}

/** A way to enter a room, and the node of the gallery its passage reaches. */
interface Candidate extends CatacombEntry {
  fixed: boolean;
  kind: TemplateCell;
  node: number;
}

/**
 * Plans how the galleries of a catacomb enter the rooms in its area. Each
 * room is entered through the `Openable` tiles of its shape: every `Exit` and
 * `Door` that leads outside, and when it has none, the `OptionalExit` with
 * the shortest passage. A passage is the shortest way through free wall, inside
 * the ring of the state, from the tile beyond the opening to a tile next to a
 * gallery. More `OptionalExit` tiles are opened, shortest passage first, where
 * they join galleries or rooms still apart, so a room can join the pieces of
 * the lattice it cut apart; no two are next to each other, even corner to
 * corner. Of what is joined then, the piece with the most `edges` is kept.
 *
 * A fixed exit with no passage, and a room that `must` be joined and is not in
 * the kept piece, fail through the room's `fail`; another room left out is
 * not entered. An `Exit` gets a door as its shape's `doors` say, and an
 * `OptionalExit` by `doorChance`. Returns the kept edges, in their order, and
 * the entries, room by room.
 *
 * With `mirrors`, a passage is the image of the one from the first of the
 * images of its start, row by row, where that one is as short and all free
 * wall, so the twins of a room get the twins of its passages.
 */
export function joinCatacombRooms(
  state: MapState,
  random: Random,
  nodes: number,
  edges: readonly LatticeEdge[],
  rooms: readonly CatacombRoom[],
  doorChance: number,
  mirrors: readonly CatacombMirror[] = [],
): { edges: LatticeEdge[]; entries: CatacombEntry[] } {
  const { grid, reserved } = state;
  const { width, height } = grid;
  const gallery = new Int32Array(width * height).fill(-1);
  for (const { span, from } of edges) {
    for (let y = span.y; y < span.y + span.height; ++y) {
      for (let x = span.x; x < span.x + span.width; ++x) {
        gallery[y * width + x] = from;
      }
    }
  }
  const inside = (x: number, y: number) =>
    x >= 1 && y >= 1 && x <= width - 2 && y <= height - 2;
  const isRock = (x: number, y: number) =>
    grid.get(x, y) === Tile.Wall && isFree(state, x, y);

  /** The shortest passage from a tile to a gallery, and the node it reaches. */
  const shortest = (
    from: Point,
  ): Pick<Candidate, 'passage' | 'node'> | null => {
    if (!inside(from.x, from.y)) {
      return null;
    }
    const reached = gallery[from.y * width + from.x] ?? -1;
    if (reached >= 0) {
      return { passage: [], node: reached };
    }
    if (!isRock(from.x, from.y)) {
      return null;
    }
    const previous = new Int32Array(width * height).fill(-2);
    previous[from.y * width + from.x] = -1;
    const queue = [from.y * width + from.x];
    for (let head = 0; head < queue.length; ++head) {
      const at = queue[head] as number;
      const [x, y] = [at % width, Math.floor(at / width)];
      for (const step of DIRECTIONS) {
        const [nx, ny] = [x + step.x, y + step.y];
        if (!inside(nx, ny)) {
          continue;
        }
        const next = ny * width + nx;
        const node = gallery[next] ?? -1;
        if (node >= 0) {
          const passage: Point[] = [];
          for (let back = at; back >= 0; back = previous[back] ?? -1) {
            passage.unshift({ x: back % width, y: Math.floor(back / width) });
          }
          return { passage, node };
        }
        if (previous[next] === -2 && isRock(nx, ny)) {
          previous[next] = at;
          queue.push(next);
        }
      }
    }
    return null;
  };

  /** The node next to the end of a passage from a tile, if any. */
  const reachedFrom = (from: Point, passage: readonly Point[]) => {
    const end = passage[passage.length - 1] ?? from;
    for (const step of passage.length > 0 ? DIRECTIONS : [{ x: 0, y: 0 }]) {
      const node = gallery[(end.y + step.y) * width + end.x + step.x] ?? -1;
      if (inside(end.x + step.x, end.y + step.y) && node >= 0) {
        return node;
      }
    }
    return -1;
  };

  /** The passage from a tile: the image of the one from the first of its images, where that is as short and all free wall, or else its own. */
  const route = (from: Point): Pick<Candidate, 'passage' | 'node'> | null => {
    const own = shortest(from);
    const first = mirrors.reduce<{ start: Point; mirror?: CatacombMirror }>(
      (best, mirror) => {
        const image = mirror.point(from);
        return image.y < best.start.y ||
          (image.y === best.start.y && image.x < best.start.x)
          ? { start: image, mirror }
          : best;
      },
      { start: from },
    );
    const { mirror } = first;
    const twin = mirror ? shortest(first.start) : null;
    if (!mirror || !twin || (own && own.passage.length < twin.passage.length)) {
      return own;
    }
    const passage = twin.passage.map((tile) => mirror.point(tile));
    const node = reachedFrom(from, passage);
    return node >= 0 &&
      passage.every(({ x, y }) => inside(x, y) && isRock(x, y))
      ? { passage, node }
      : own;
  };

  const roots = createRoots(nodes + rooms.length);
  for (const edge of edges) {
    roots.join(edge.from, edge.to);
  }
  const chosen: Candidate[] = [];
  const spare: Candidate[] = [];
  rooms.forEach(({ shape, fail }, room) => {
    const candidates: Candidate[] = [];
    for (const exit of shape.exits) {
      const wall = { x: shape.x + exit.x, y: shape.y + exit.y };
      if (
        !grid.inBounds(wall.x, wall.y) ||
        reserved[wall.y * width + wall.x] !== Reserve.Openable
      ) {
        continue;
      }
      const fixed = exit.kind !== TemplateCell.OptionalExit;
      let best: Candidate | undefined;
      for (const direction of exit.directions) {
        const step = DIRECTIONS[direction] as Point;
        const found = route({ x: wall.x + step.x, y: wall.y + step.y });
        if (found && (!best || found.passage.length < best.passage.length)) {
          best = { room, wall, door: false, fixed, kind: exit.kind, ...found };
        }
      }
      if (best) {
        candidates.push(best);
      } else if (fixed) {
        fail(
          `its exit at (${String(wall.x)}, ${String(wall.y)}) has no way to a gallery`,
        );
      }
    }
    const fixed = candidates.filter((candidate) => candidate.fixed);
    const optional = candidates
      .filter((candidate) => !candidate.fixed)
      .sort((p, q) => p.passage.length - q.passage.length);
    const first = fixed.length > 0 ? fixed : optional.slice(0, 1);
    for (const candidate of first) {
      chosen.push(candidate);
      roots.join(nodes + room, candidate.node);
    }
    spare.push(...optional.filter((candidate) => !first.includes(candidate)));
  });
  spare.sort((p, q) => p.passage.length - q.passage.length);
  for (const candidate of spare) {
    const crowded = chosen.some(
      ({ wall }) =>
        Math.abs(wall.x - candidate.wall.x) <= 1 &&
        Math.abs(wall.y - candidate.wall.y) <= 1,
    );
    if (!crowded && roots.join(nodes + candidate.room, candidate.node)) {
      chosen.push(candidate);
    }
  }

  const sizes = new Map<number, number>();
  for (const edge of edges) {
    const root = roots.find(edge.from);
    sizes.set(root, (sizes.get(root) ?? 0) + 1);
  }
  let largest = -1;
  for (const [root, size] of sizes) {
    if (largest < 0 || size > (sizes.get(largest) ?? 0)) {
      largest = root;
    }
  }
  rooms.forEach(({ must, fail }, room) => {
    if (must && roots.find(nodes + room) !== largest) {
      fail('has no way to the galleries');
    }
  });
  const entries = chosen
    .filter(({ room }) => roots.find(nodes + room) === largest)
    .sort((p, q) => p.room - q.room)
    .map(({ room, wall, kind, passage }): CatacombEntry => {
      const decided = rooms[room]?.shape.doors.find(
        ({ x, y }) => x === wall.x && y === wall.y,
      );
      const door =
        kind === TemplateCell.Door ||
        (decided ? decided.door : random() < doorChance);
      return { room, wall, door, passage };
    });
  return {
    edges: edges.filter((edge) => roots.find(edge.from) === largest),
    entries,
  };
}
