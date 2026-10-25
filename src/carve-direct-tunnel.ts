import { carveTunnelBrush } from './carve-tunnel-brush';
import type { Grid } from './grid';
import type { Point } from './point';
import type { Random } from './random';
import type { TunnelOptions } from './tunnel-options';

/** Carves an L-shaped tunnel from one position to another, going horizontally first or vertically first at random. */
export function carveDirectTunnel(
  grid: Grid,
  random: Random,
  from: Point,
  to: Point,
  { width, borderWalls }: TunnelOptions,
): void {
  const horizontalFirst = random() < 0.5;
  const corner = horizontalFirst
    ? { x: to.x, y: from.y }
    : { x: from.x, y: to.y };
  for (const [start, end] of [
    [from, corner],
    [corner, to],
  ] as const) {
    const stepX = Math.sign(end.x - start.x);
    const stepY = Math.sign(end.y - start.y);
    let { x, y } = start;
    carveTunnelBrush(grid, x, y, width, borderWalls);
    while (x !== end.x || y !== end.y) {
      x += stepX;
      y += stepY;
      carveTunnelBrush(grid, x, y, width, borderWalls);
    }
  }
}
