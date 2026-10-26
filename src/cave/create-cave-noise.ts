import { createTransforms } from '../rooms/templates/create-transforms';
import { findCaveTwin } from './find-cave-twin';
import { Grid } from '../core/grid';
import type { LayoutSymmetry } from '../core/layout-symmetry';
import type { Random } from '../core/random';
import { Tile } from '../core/tile';

/** The settings that shape the starting noise of a cave. */
export interface CaveNoiseOptions {
  width: number;
  height: number;
  fillChance: number;
  borderWalls: boolean;
  symmetry: LayoutSymmetry;
  symmetryChance: number;
}

/**
 * Fills a grid with the random walls and floors that a cave starts from. With
 * a symmetry, the first tile of every set of mirror images (row by row) is
 * random, and each of its twins copies it with the chance `symmetryChance` and
 * is random otherwise.
 */
export function createCaveNoise(
  random: Random,
  {
    width,
    height,
    fillChance,
    borderWalls,
    symmetry,
    symmetryChance,
  }: CaveNoiseOptions,
): Grid {
  const grid = new Grid(width, height);
  const images = createTransforms(symmetry, width, height, false);
  for (let y = 0; y < height; ++y) {
    for (let x = 0; x < width; ++x) {
      const isBorder =
        x === 0 || y === 0 || x === width - 1 || y === height - 1;
      if (borderWalls && isBorder) {
        grid.set(x, y, Tile.Wall);
        continue;
      }
      const source = findCaveTwin(images, { x, y }, width);
      const copies =
        (source.x !== x || source.y !== y) && random() < symmetryChance;
      const isWall = copies
        ? grid.get(source.x, source.y) === Tile.Wall
        : random() < fillChance;
      grid.set(x, y, isWall ? Tile.Wall : Tile.Floor);
    }
  }
  return grid;
}
