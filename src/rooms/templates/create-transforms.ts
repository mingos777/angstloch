import type { LayoutSymmetry } from '../layout-symmetry';
import type { Point } from '../../core/point';
import type { Room } from '../room';
import { symmetricExtent } from '../symmetric-extent';

/** A mirroring or rotation of the map that maps tiles, directions and rooms onto their images. */
export interface Transform {
  point: (point: Point) => Point;
  /** The image of a direction, as an index into `DIRECTIONS`. */
  direction: (direction: number) => number;
  /** The image of a room, without id or exits. */
  room: (room: Room) => Room;
}

/**
 * The transforms that a symmetry adds to the identity, for a map of a given
 * size: none, one or three. They map tiles onto tiles.
 */
export function createTransforms(
  symmetry: LayoutSymmetry,
  width: number,
  height: number,
  lattice: boolean,
): Transform[] {
  const w = symmetricExtent(width, lattice);
  const h = symmetricExtent(height, lattice);
  const make = (flipX: boolean, flipY: boolean): Transform => ({
    point: ({ x, y }) => ({
      x: flipX ? w - 1 - x : x,
      y: flipY ? h - 1 - y : y,
    }),
    direction: (direction) =>
      direction % 2 === 1
        ? flipX
          ? (direction + 2) % 4
          : direction
        : flipY
          ? (direction + 2) % 4
          : direction,
    room: (room) => ({
      id: 0,
      x: flipX ? w - room.x - room.width : room.x,
      y: flipY ? h - room.y - room.height : room.y,
      width: room.width,
      height: room.height,
      exits: [],
      exitCount: 0,
      doorCount: 0,
    }),
  });
  switch (symmetry) {
    case 'horizontal':
      return [make(true, false)];
    case 'vertical':
      return [make(false, true)];
    case 'both':
      return [make(true, false), make(false, true), make(true, true)];
    case 'rotational':
      return [make(true, true)];
    case 'none':
      return [];
  }
}
