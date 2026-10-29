import { createTransforms } from '../rooms/templates/create-transforms';
import { findCaveTwin } from './find-cave-twin';
import { Grid } from '../core/grid';
import type { LayoutSymmetry } from '../core/layout-symmetry';
import type { NoiseFunction } from '../noise/noise-function';
import type { NoiseCaveShape } from './noise-cave-shape';
import type { Random } from '../core/random';
import { Tile } from '../core/tile';

/** The settings that shape the starting grid of a noise cave. */
export interface NoiseCaveGridOptions {
  width: number;
  height: number;
  noise: NoiseFunction;
  shape: NoiseCaveShape;
  fill: number;
  cornerBias: number;
  borderWalls: boolean;
  symmetry: LayoutSymmetry;
  symmetryChance: number;
}

/**
 * Turns noise into the walls and floors that a noise cave starts from. Every
 * tile gets a score from the noise at its center: the noise itself for
 * `blobs`, and minus its distance from 0 for `veins`, lowered near the map
 * corners by the corner bias (see below). The lowest scores, `fill` of them,
 * become walls.
 *
 * The corner bias lowers the score of a tile by up to 2, which is more than the
 * whole range of the noise, and the lowering fades out smoothly (a smoothstep)
 * with the distance from the nearest corner of the map, reaching 0 at a
 * distance of `cornerBias` tiles. So only the corners are pulled toward wall,
 * and the straight edges are left alone. A tile and its mirror images are
 * equally far from their nearest corners, so the bias keeps a symmetry intact.
 *
 * With a symmetry, a tile samples the noise at its first twin (row by row)
 * with the chance `symmetryChance`, and at its own position otherwise. The
 * walls are picked after that, so `fill` stays accurate. Tiles that tie at
 * the threshold all become floor, which keeps twins together.
 */
export function createNoiseCaveGrid(
  random: Random,
  {
    width,
    height,
    noise,
    shape,
    fill,
    cornerBias,
    borderWalls,
    symmetry,
    symmetryChance,
  }: NoiseCaveGridOptions,
): Grid {
  const images = createTransforms(symmetry, width, height, false);
  const scored: { x: number; y: number; score: number }[] = [];
  for (let y = 0; y < height; ++y) {
    for (let x = 0; x < width; ++x) {
      const isBorder =
        x === 0 || y === 0 || x === width - 1 || y === height - 1;
      if (borderWalls && isBorder) {
        continue;
      }
      const twin = findCaveTwin(images, { x, y }, width);
      const copies =
        (twin.x !== x || twin.y !== y) && random() < symmetryChance;
      const at = copies ? twin : { x, y };
      const value = noise(at.x + 0.5, at.y + 0.5);
      const corner = Math.hypot(
        Math.min(x, width - 1 - x),
        Math.min(y, height - 1 - y),
      );
      const near = cornerBias > 0 ? Math.max(0, 1 - corner / cornerBias) : 0;
      scored.push({
        x,
        y,
        score:
          (shape === 'veins' ? -Math.abs(value) : value) -
          2 * near * near * (3 - 2 * near),
      });
    }
  }

  const sorted = scored.map(({ score }) => score).sort((a, b) => a - b);
  const walls = Math.round(fill * sorted.length);
  const threshold = sorted[walls] ?? Infinity;
  const grid = new Grid(width, height);
  for (const { x, y, score } of scored) {
    grid.set(x, y, score < threshold ? Tile.Wall : Tile.Floor);
  }
  return grid;
}
