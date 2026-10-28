import type { Area } from '../core/area';
import { DIRECTIONS } from '../core/directions';
import type { Point } from '../core/point';
import type { MapState } from '../pipeline/map-state';
import { Reserve } from '../pipeline/reserve';
import { TemplateCell } from '../rooms/templates/template-cell';
import type { TemplateExit } from '../rooms/templates/template-exit';
import type { TemplatePlacement } from '../rooms/templates/template-placement';

/** The pieces of floor that no room holds, which `carveCorridors` joins as if they were rooms. */
export interface StandIns {
  /**
   * One shape per piece, in the order of their first tile, row by row: the
   * piece's tiles as `Floor` cells, and the free walls that touch it from
   * outside as `OptionalExit` cells, each leading away from the piece.
   */
  shapes: TemplatePlacement[];
  /** The floor of each piece, as a box, in the order of `shapes`. */
  floors: Area[];
  /** The first tile of each piece, row by row, in the order of `shapes`, to name it by. */
  firsts: Point[];
  /** One byte per tile, 1 for rock that pieces enclose, such as a pillar, which corridors cannot reach. */
  holes: Uint8Array;
}

/**
 * Finds every piece of floor, joined along edges, that lies outside the
 * shapes of the rooms: a cavern, a hall, a mine, a maze, or the corridors of
 * an earlier step. Any tile that is not the base counts as floor. Rock that
 * the pieces enclose and that nothing else reaches is a hole: it is no exit,
 * and nothing is built in it. A wall is a potential exit of a piece when it
 * holds the base, is not reserved and is not a hole.
 */
export function findStandIns(
  state: Pick<MapState, 'grid' | 'base' | 'reserved'>,
  shapes: readonly TemplatePlacement[],
): StandIns {
  const { grid, base, reserved } = state;
  const { width, height } = grid;
  const covered = new Uint8Array(width * height);
  for (const shape of shapes) {
    shape.cells.forEach((row, dy) => {
      row.forEach((cell, dx) => {
        if (cell !== TemplateCell.Unused) {
          covered[(shape.y + dy) * width + shape.x + dx] = 1;
        }
      });
    });
  }
  // 1 + the index of the piece that holds each tile, 0 for none
  const piece = new Int32Array(width * height);
  const pieces: Point[][] = [];
  for (let start = 0; start < width * height; ++start) {
    const x = start % width;
    const y = (start - x) / width;
    if (piece[start] !== 0 || covered[start] || grid.get(x, y) === base) {
      continue;
    }
    piece[start] = pieces.length + 1;
    const tiles: Point[] = [];
    for (const queue = [{ x, y }]; queue.length > 0;) {
      const tile = queue.pop() as Point;
      tiles.push(tile);
      for (const step of DIRECTIONS) {
        const [nx, ny] = [tile.x + step.x, tile.y + step.y];
        const at = ny * width + nx;
        if (
          grid.inBounds(nx, ny) &&
          piece[at] === 0 &&
          !covered[at] &&
          grid.get(nx, ny) !== base
        ) {
          piece[at] = pieces.length + 1;
          queue.push({ x: nx, y: ny });
        }
      }
    }
    pieces.push(tiles);
  }

  const holes = findHoles(state, piece);
  const isExit = (x: number, y: number): boolean => {
    const at = y * width + x;
    return (
      grid.inBounds(x, y) &&
      piece[at] === 0 &&
      holes[at] === 0 &&
      reserved[at] === Reserve.None &&
      grid.get(x, y) === base
    );
  };
  const floors: StandIns['floors'] = [];
  const placements = pieces.map((tiles) => {
    // the walls round the piece, with the ways out of each
    const ways = new Map<number, number[]>();
    for (const { x, y } of tiles) {
      for (const [direction, step] of DIRECTIONS.entries()) {
        const [wx, wy] = [x + step.x, y + step.y];
        if (isExit(wx, wy)) {
          const key = wy * width + wx;
          ways.set(key, [...(ways.get(key) ?? []), direction]);
        }
      }
    }
    const floor = boxOf(tiles);
    floors.push(floor);
    const box = boxOf([
      ...tiles,
      ...[...ways.keys()].map((key) => ({
        x: key % width,
        y: Math.floor(key / width),
      })),
    ]);
    const cells = Array.from({ length: box.height }, () =>
      Array.from(
        { length: box.width },
        (): TemplateCell => TemplateCell.Unused,
      ),
    );
    for (const { x, y } of tiles) {
      (cells[y - box.y] as TemplateCell[])[x - box.x] = TemplateCell.Floor;
    }
    const exits: TemplateExit[] = [];
    for (const [key, directions] of [...ways.entries()].sort(
      ([p], [q]) => p - q,
    )) {
      const [x, y] = [key % width, Math.floor(key / width)];
      (cells[y - box.y] as TemplateCell[])[x - box.x] =
        TemplateCell.OptionalExit;
      exits.push({
        x: x - box.x,
        y: y - box.y,
        kind: TemplateCell.OptionalExit,
        directions: directions.sort((p, q) => p - q),
      });
    }
    return {
      ...box,
      cells,
      exits,
      rotation: 0,
      mirrored: false,
    } satisfies TemplatePlacement;
  });
  return {
    shapes: placements,
    floors,
    firsts: pieces.map(([first]) => first as Point),
    holes,
  };
}

/**
 * Marks the tiles outside every piece that only pieces reach: flooding from
 * the edge of the map and from every tile that something else holds (a room,
 * a reserved tile), whatever is left over is enclosed by the pieces alone.
 */
function findHoles(
  state: Pick<MapState, 'grid' | 'base' | 'reserved'>,
  piece: Int32Array,
): Uint8Array {
  const { grid, base, reserved } = state;
  const { width, height } = grid;
  const reached = new Uint8Array(width * height);
  const queue: number[] = [];
  for (let at = 0; at < width * height; ++at) {
    const x = at % width;
    const y = (at - x) / width;
    const edge = x === 0 || y === 0 || x === width - 1 || y === height - 1;
    if (
      piece[at] === 0 &&
      (edge || reserved[at] !== Reserve.None || grid.get(x, y) !== base)
    ) {
      reached[at] = 1;
      queue.push(at);
    }
  }
  for (let head = 0; head < queue.length; ++head) {
    const at = queue[head] as number;
    const x = at % width;
    const y = (at - x) / width;
    for (const step of DIRECTIONS) {
      const [nx, ny] = [x + step.x, y + step.y];
      const next = ny * width + nx;
      if (grid.inBounds(nx, ny) && piece[next] === 0 && reached[next] === 0) {
        reached[next] = 1;
        queue.push(next);
      }
    }
  }
  const holes = new Uint8Array(width * height);
  for (let at = 0; at < width * height; ++at) {
    holes[at] = piece[at] === 0 && reached[at] === 0 ? 1 : 0;
  }
  return holes;
}

function boxOf(tiles: readonly Point[]): Area {
  const xs = tiles.map(({ x }) => x);
  const ys = tiles.map(({ y }) => y);
  const [x, y] = [Math.min(...xs), Math.min(...ys)];
  return {
    x,
    y,
    width: Math.max(...xs) - x + 1,
    height: Math.max(...ys) - y + 1,
  };
}
