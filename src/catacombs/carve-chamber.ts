import type { Area } from '../core/area';
import type { Point } from '../core/point';
import { Tile } from '../core/tile';
import { isFree } from '../pipeline/is-free';
import type { MapState } from '../pipeline/map-state';
import type { CatacombSide } from '../rooms/catacomb-side';
import { OUTWARD } from './outward';

/**
 * Digs a burial chamber off a gallery: a `Door` at `door`, in the wall of the
 * gallery, and beyond it on a side a floor of `Floor`, `width` tiles along the
 * wall, `left` of them before the door (left of it, or above it), `depth`
 * tiles deep or as deep as fits, but
 * not below `minDepth`. The floor and its ring of wall must be free wall, so
 * the chamber touches no other floor but through its door, and its floor and
 * door must not be `blocked`, the footprint of another chamber, whose ring it
 * may share. Marks its floor and ring `blocked`. Returns its floor, or
 * `undefined` when it does not fit.
 */
export function carveChamber(
  state: MapState,
  blocked: Uint8Array,
  door: Point,
  side: CatacombSide,
  width: number,
  left: number,
  depth: number,
  minDepth: number,
): Area | undefined {
  const { grid } = state;
  const out = OUTWARD[side];
  const along = { x: Math.abs(out.y), y: Math.abs(out.x) };
  const at = (step: number, across: number): Point => ({
    x: door.x + step * out.x + across * along.x,
    y: door.y + step * out.y + across * along.y,
  });
  // the ring round a floor `deep` tiles deep, its floor and its door
  const each = (deep: number, visit: (tile: Point, own: boolean) => void) => {
    for (let step = 0; step <= deep + 1; ++step) {
      for (let across = -left - 1; across <= width - left; ++across) {
        const inside =
          step >= 1 && step <= deep && across >= -left && across < width - left;
        visit(at(step, across), inside || (step === 0 && across === 0));
      }
    }
  };
  const fits = (deep: number) => {
    let fit = true;
    each(deep, ({ x, y }, own) => {
      if (
        grid.get(x, y) !== Tile.Wall ||
        !isFree(state, x, y) ||
        (own && blocked[y * grid.width + x] === 1)
      ) {
        fit = false;
      }
    });
    return fit;
  };
  let deep = depth;
  while (deep >= minDepth && !fits(deep)) {
    --deep;
  }
  if (deep < minDepth || deep < 1) {
    return undefined;
  }
  each(deep, ({ x, y }) => {
    blocked[y * grid.width + x] = 1;
  });
  const [a, b] = [at(1, -left), at(deep, width - 1 - left)];
  const floor = {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    width: Math.abs(b.x - a.x) + 1,
    height: Math.abs(b.y - a.y) + 1,
  };
  for (let y = floor.y; y < floor.y + floor.height; ++y) {
    for (let x = floor.x; x < floor.x + floor.width; ++x) {
      grid.set(x, y, Tile.Floor);
    }
  }
  grid.set(door.x, door.y, Tile.Door);
  return floor;
}
