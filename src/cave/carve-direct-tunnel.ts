import { carveTunnelBrush } from './carve-tunnel-brush';
import { findTunnelPath } from './find-tunnel-path';
import type { Grid } from '../core/grid';
import type { Point } from '../core/point';
import type { Random } from '../core/random';
import type { TunnelOptions } from './tunnel-options';

/** The tiles of a straight run from one position to another, both included. */
function line(start: Point, end: Point): Point[] {
  const stepX = Math.sign(end.x - start.x);
  const stepY = Math.sign(end.y - start.y);
  const tiles = [start];
  for (let { x, y } = start; x !== end.x || y !== end.y;) {
    x += stepX;
    y += stepY;
    tiles.push({ x, y });
  }
  return tiles;
}

/** The tiles of an L-shaped walk from one position to another, bending once. */
function bend(from: Point, to: Point, horizontalFirst: boolean): Point[] {
  const corner = horizontalFirst
    ? { x: to.x, y: from.y }
    : { x: from.x, y: to.y };
  return [...line(from, corner), ...line(corner, to)];
}

/**
 * Carves an L-shaped tunnel from one position to another, going horizontally
 * first or vertically first at random. When `blocked` stands in the way of
 * that bend, it takes the other one, and when it stands in the way of both, it
 * takes the shortest walk round it. It carves nothing when there is none.
 */
export function carveDirectTunnel(
  grid: Grid,
  random: Random,
  from: Point,
  to: Point,
  options: TunnelOptions,
): void {
  const { width, borderWalls, blocked } = options;
  const horizontalFirst = random() < 0.5;
  const clear = (tiles: Point[]) =>
    !blocked || tiles.every(({ x, y }) => !blocked[y * grid.width + x]);
  const walks = [
    bend(from, to, horizontalFirst),
    bend(from, to, !horizontalFirst),
  ];
  const walk =
    walks.find(clear) ?? findTunnelPath(grid, from, to, options) ?? [];
  for (const { x, y } of walk) {
    carveTunnelBrush(grid, x, y, width, borderWalls, blocked);
  }
}
