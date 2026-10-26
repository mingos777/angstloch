import type { Area } from '../core/area';
import type { Grid } from '../core/grid';
import type { Random } from '../core/random';
import { randomInt } from '../core/random-int';
import type { Range } from '../core/range';
import { Tile } from '../core/tile';
import { createRaggedMask, raggedDepth } from './create-ragged-mask';

/** How the pillars of a hall look. */
export interface PillarStyle {
  size: Range;
  spacing: Range;
  ragged: number;
  jitter: number;
}

/**
 * Leaves pillars standing in a hall of floor: islands of wall in a regular
 * pattern that is jittered, with ragged edges. The pattern has cells as large as the
 * largest pillar plus the gap between pillars, which is picked once for the
 * hall, and every pillar sits in its own cell. A pillar is left out where it
 * would touch the walls of the hall or another pillar, or where it would cover
 * a tile of `keep`, so the floor around the pillars stays in one piece.
 * Changes `grid` in place and returns how many tiles became wall.
 */
export function placePillars(
  grid: Grid,
  random: Random,
  hall: Area,
  keep: ReadonlySet<number>,
  style: PillarStyle,
): number {
  const { size, spacing, ragged, jitter } = style;
  const gap = randomInt(random, spacing.min, spacing.max);
  const pitch = size.max + gap;
  const reach = Math.floor((jitter * (gap - 1)) / 2);
  // keep clear of the ragged edge, which cuts into the hall by so much at most
  const edge = (side: number) => raggedDepth(side, ragged) + 1;
  const marginX = edge(hall.width);
  const marginY = edge(hall.height);
  const columns = Math.floor((hall.width - 2 * marginX + gap) / pitch);
  const rows = Math.floor((hall.height - 2 * marginY + gap) / pitch);
  // center the pattern in the hall
  const startX =
    hall.x + Math.floor((hall.width - (columns * pitch - gap)) / 2);
  const startY = hall.y + Math.floor((hall.height - (rows * pitch - gap)) / 2);
  let walled = 0;
  for (let row = 0; row < rows; ++row) {
    for (let column = 0; column < columns; ++column) {
      const cx = startX + column * pitch;
      const cy = startY + row * pitch;
      const width = randomInt(random, size.min, size.max);
      const height = randomInt(random, size.min, size.max);
      const left =
        cx +
        Math.floor((size.max - width) / 2) +
        randomInt(random, -reach, reach);
      const top =
        cy +
        Math.floor((size.max - height) / 2) +
        randomInt(random, -reach, reach);
      const mask = createRaggedMask(random, width, height, ragged);
      const tiles: { x: number; y: number }[] = [];
      for (let y = 0; y < height; ++y) {
        for (let x = 0; x < width; ++x) {
          if (mask[y * width + x] === 1) {
            tiles.push({ x: left + x, y: top + y });
          }
        }
      }
      const own = new Set(tiles.map((tile) => tile.y * grid.width + tile.x));
      const stands = tiles.every(({ x, y }) => {
        if (keep.has(y * grid.width + x) || grid.get(x, y) !== Tile.Floor) {
          return false;
        }
        for (let dy = -1; dy <= 1; ++dy) {
          for (let dx = -1; dx <= 1; ++dx) {
            const near = (y + dy) * grid.width + x + dx;
            if (!own.has(near) && grid.get(x + dx, y + dy) !== Tile.Floor) {
              return false;
            }
          }
        }
        return true;
      });
      if (stands) {
        for (const { x, y } of tiles) {
          grid.set(x, y, Tile.Wall);
        }
        walled += tiles.length;
      }
    }
  }
  return walled;
}
