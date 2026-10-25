import type { CorridorSymmetry } from './corridor-symmetry';
import { horizontalShare } from './pick-direction';
import type { Point } from './point';
import type { Random } from './random';
import { symmetricExtent } from './symmetric-extent';

export interface SteeringOptions {
  width: number;
  height: number;
  lattice: boolean;
  random: Random;
  horizontalBias: number;
  verticalBias: number;
  corridorSymmetry: CorridorSymmetry;
  corridorSymmetryChance: number;
}

/**
 * Returns a function that gives the share of horizontal directions that a
 * corridor at a tile should favor. It is the share that the biases ask for,
 * except that with a corridor symmetry, the choice follows the pattern of a
 * maze for as often as the chance says: `snowflake` goes horizontally where
 * the tile is further from the center horizontally than vertically, and
 * `whirlpool` the other way round.
 */
export function createSteering(
  options: SteeringOptions,
): (at: Point) => number {
  const share = horizontalShare(options.horizontalBias, options.verticalBias);
  if (
    options.corridorSymmetry === 'none' ||
    options.corridorSymmetryChance <= 0
  ) {
    return () => share;
  }
  const centerX = (symmetricExtent(options.width, options.lattice) - 1) / 2;
  const centerY = (symmetricExtent(options.height, options.lattice) - 1) / 2;
  return ({ x, y }) => {
    if (options.corridorSymmetryChance <= options.random()) {
      return share;
    }
    const dx = x - centerX;
    const dy = y - centerY;
    const [ox, oy] =
      options.corridorSymmetry === 'whirlpool' ? [dy, -dx] : [dx, dy];
    return Math.abs(ox) === Math.abs(oy)
      ? 0.5
      : Math.abs(ox) > Math.abs(oy)
        ? 1
        : 0;
  };
}
