import type { Area } from '../core/area';
import type { LayoutSymmetry } from '../core/layout-symmetry';
import type { Point } from '../core/point';
import type { CatacombSide } from '../rooms/catacomb-side';

/** A mirroring of the state of a catacomb about its center, one of those its symmetry adds to the identity. */
export interface CatacombMirror {
  /** Whether it mirrors left to right. */
  x: boolean;
  /** Whether it mirrors top to bottom. */
  y: boolean;
  point: (point: Point) => Point;
  area: (area: Area) => Area;
  side: (side: CatacombSide) => CatacombSide;
  /** Whether it turns the way along a wall on a side around: left to right for the top and the bottom, top to bottom for the left and the right. */
  flipsAlong: (side: CatacombSide) => boolean;
}

const FLIPS: Record<LayoutSymmetry, readonly (readonly [boolean, boolean])[]> =
  {
    none: [],
    horizontal: [[true, false]],
    vertical: [[false, true]],
    both: [
      [true, false],
      [false, true],
      [true, true],
    ],
    rotational: [[true, true]],
  };

const OPPOSITE: Record<CatacombSide, CatacombSide> = {
  top: 'bottom',
  right: 'left',
  bottom: 'top',
  left: 'right',
};

/** The mirrorings that a symmetry adds to the identity, for a state of a given size: none, one or three. */
export function createCatacombMirrors(
  symmetry: LayoutSymmetry,
  width: number,
  height: number,
): CatacombMirror[] {
  return FLIPS[symmetry].map(([x, y]) => ({
    x,
    y,
    point: (point) => ({
      x: x ? width - 1 - point.x : point.x,
      y: y ? height - 1 - point.y : point.y,
    }),
    area: (area) => ({
      x: x ? width - area.x - area.width : area.x,
      y: y ? height - area.y - area.height : area.y,
      width: area.width,
      height: area.height,
    }),
    side: (side) =>
      (side === 'left' || side === 'right' ? x : y) ? OPPOSITE[side] : side,
    flipsAlong: (side) => (side === 'top' || side === 'bottom' ? x : y),
  }));
}
