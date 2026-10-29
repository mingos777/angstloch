import { DIRECTIONS } from '../core/directions';
import type { Grid } from '../core/grid';
import type { Point } from '../core/point';
import { Tile } from '../core/tile';
import type { MapState } from './map-state';
import { openReserved } from './open-reserved';
import { Reserve } from './reserve';

/**
 * Opens every `Openable` wall that has open ground of two different pieces on
 * opposite sides, such as the entrance of a cell block that a later step dug a
 * hall right up to, since no corridor or vein through rock can reach it. It
 * becomes floor and is opened with `openReserved`. Once two pieces are joined,
 * no other wall between them is opened. A tile that `skip` marks with 1 is
 * left alone. Returns the walls it opened.
 */
export function joinTouchingPieces(
  state: Pick<MapState, 'grid' | 'reserved'>,
  skip?: Uint8Array,
): Point[] {
  const { grid, reserved } = state;
  let label = labelPieces(grid);
  const opened: Point[] = [];
  for (let at = 0; at < grid.width * grid.height; ++at) {
    const x = at % grid.width;
    const y = (at - x) / grid.width;
    if (
      reserved[at] !== Reserve.Openable ||
      skip?.[at] === 1 ||
      grid.get(x, y) !== Tile.Wall
    ) {
      continue;
    }
    const touches = [
      [x - 1, y, x + 1, y],
      [x, y - 1, x, y + 1],
    ].some(([ax, ay, bx, by]) => {
      const a = labelAt(grid, label, ax as number, ay as number);
      const b = labelAt(grid, label, bx as number, by as number);
      return a !== 0 && b !== 0 && a !== b;
    });
    if (touches) {
      grid.set(x, y, Tile.Floor);
      openReserved(state, x, y);
      opened.push({ x, y });
      label = labelPieces(grid);
    }
  }
  return opened;
}

/** 1 + the index of the piece of open ground that holds each tile, 0 for wall. */
function labelPieces(grid: Grid): Int32Array {
  const label = new Int32Array(grid.width * grid.height);
  let pieces = 0;
  for (let start = 0; start < label.length; ++start) {
    const sx = start % grid.width;
    if (
      label[start] !== 0 ||
      grid.get(sx, (start - sx) / grid.width) === Tile.Wall
    ) {
      continue;
    }
    label[start] = ++pieces;
    for (const queue = [start]; queue.length > 0;) {
      const at = queue.pop() as number;
      const x = at % grid.width;
      const y = (at - x) / grid.width;
      for (const step of DIRECTIONS) {
        const [nx, ny] = [x + step.x, y + step.y];
        const next = ny * grid.width + nx;
        if (
          grid.inBounds(nx, ny) &&
          label[next] === 0 &&
          grid.get(nx, ny) !== Tile.Wall
        ) {
          label[next] = pieces;
          queue.push(next);
        }
      }
    }
  }
  return label;
}

function labelAt(grid: Grid, label: Int32Array, x: number, y: number): number {
  return grid.inBounds(x, y) ? (label[y * grid.width + x] ?? 0) : 0;
}
