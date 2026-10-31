import type { Point } from '../core/point';
import { Tile } from '../core/tile';
import { isFree } from '../pipeline/is-free';
import type { MapState } from '../pipeline/map-state';
import type { CatacombSide } from '../rooms/catacomb-side';
import { OUTWARD } from './outward';

/**
 * Digs a niche as `Floor`, one tile wide, from `mouth` straight out on a side,
 * `depth` tiles deep or as deep as fits: its tiles, the tiles on both sides of
 * them and the tile behind its back must be free wall, so it touches no other
 * floor but what it opens onto, and its tiles must not be `blocked`, the
 * footprint of a chamber, but for its mouth when the niche opens off the
 * chamber whose wall that is (`inChamber`). Returns its tiles from its mouth
 * to its back, or `undefined` when not even one fits.
 */
export function carveNiche(
  state: MapState,
  blocked: Uint8Array,
  mouth: Point,
  side: CatacombSide,
  depth: number,
  inChamber: boolean,
): Point[] | undefined {
  const { grid } = state;
  const out = OUTWARD[side];
  const along = { x: Math.abs(out.y), y: Math.abs(out.x) };
  const at = (step: number, across: number): Point => ({
    x: mouth.x + step * out.x + across * along.x,
    y: mouth.y + step * out.y + across * along.y,
  });
  const fits = (deep: number) => {
    for (let step = 0; step <= deep; ++step) {
      for (let across = -1; across <= 1; ++across) {
        const { x, y } = at(step, across);
        if (grid.get(x, y) !== Tile.Wall || !isFree(state, x, y)) {
          return false;
        }
        const own = across === 0 && step < deep;
        if (
          own &&
          !(inChamber && step === 0) &&
          blocked[y * grid.width + x] === 1
        ) {
          return false;
        }
      }
    }
    return true;
  };
  let deep = depth;
  while (deep > 0 && !fits(deep)) {
    --deep;
  }
  if (deep === 0) {
    return undefined;
  }
  const tiles = Array.from({ length: deep }, (_, step) => at(step, 0));
  for (const { x, y } of tiles) {
    grid.set(x, y, Tile.Floor);
  }
  return tiles;
}
