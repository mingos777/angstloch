import type { Grid } from '../core/grid';
import type { RoomShape } from './room-shape';
import { TemplateCell } from './templates/template-cell';

/**
 * Tells which room each tile of a finished map belongs to: one number per
 * tile, row by row (`y * width + x`), the id of the room whose floor holds it,
 * or -1. Every room of every kind counts, halls and caverns included, through
 * the `Floor` cells of its shape. Walls, exits and doors belong to no room,
 * since an exit may belong to two, and neither do corridors, veins or any
 * other floor outside the rooms.
 */
export function createRoomMap(result: {
  grid: Pick<Grid, 'width' | 'height'>;
  roomShapes: readonly RoomShape[];
}): Int32Array {
  const { width, height } = result.grid;
  const map = new Int32Array(width * height).fill(-1);
  result.roomShapes.forEach((shape, id) => {
    shape.cells.forEach((row, dy) => {
      row.forEach((cell, dx) => {
        const [x, y] = [shape.x + dx, shape.y + dy];
        if (
          cell === TemplateCell.Floor &&
          x >= 0 &&
          y >= 0 &&
          x < width &&
          y < height
        ) {
          map[y * width + x] = id;
        }
      });
    });
  });
  return map;
}
