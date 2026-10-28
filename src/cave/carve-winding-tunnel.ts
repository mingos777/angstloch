import { carveDirectTunnel } from './carve-direct-tunnel';
import { carveTunnelBrush } from './carve-tunnel-brush';
import { DIRECTIONS } from '../core/directions';
import type { Grid } from '../core/grid';
import type { Point } from '../core/point';
import type { Random } from '../core/random';
import { randomInt } from '../core/random-int';
import type { TunnelOptions } from './tunnel-options';

/** The chance of a random step at a windiness of 1. It stays below 1 so that the walk drifts towards its goal. */
const MAX_WANDER = 0.8;

/**
 * Carves a tunnel from one position to another by a random walk. Each step
 * either goes in a random direction or heads for the goal, and the windiness
 * sets how often it wanders. A step onto a blocked tile is not taken. A walk
 * that takes too long finishes straight.
 */
export function carveWindingTunnel(
  grid: Grid,
  random: Random,
  from: Point,
  to: Point,
  options: TunnelOptions,
): void {
  const { width, windiness, borderWalls, blocked } = options;
  const margin = borderWalls ? 1 : 0;
  const maxSteps = grid.width * grid.height * 10;
  let { x, y } = from;
  carveTunnelBrush(grid, x, y, width, borderWalls, blocked);
  for (let steps = 0; x !== to.x || y !== to.y; ++steps) {
    if (steps >= maxSteps) {
      carveDirectTunnel(grid, random, { x, y }, to, options);
      return;
    }
    let stepX: number;
    let stepY: number;
    if (random() < windiness * MAX_WANDER) {
      const step = DIRECTIONS[randomInt(random, 0, DIRECTIONS.length - 1)];
      stepX = step?.x ?? 0;
      stepY = step?.y ?? 0;
    } else {
      const left = Math.abs(to.x - x);
      const down = Math.abs(to.y - y);
      const horizontal = random() * (left + down) < left;
      stepX = horizontal ? Math.sign(to.x - x) : 0;
      stepY = horizontal ? 0 : Math.sign(to.y - y);
    }
    const nextX = x + stepX;
    const nextY = y + stepY;
    if (
      nextX < margin ||
      nextY < margin ||
      nextX >= grid.width - margin ||
      nextY >= grid.height - margin ||
      blocked?.[nextY * grid.width + nextX]
    ) {
      continue;
    }
    x = nextX;
    y = nextY;
    carveTunnelBrush(grid, x, y, width, borderWalls, blocked);
  }
}
