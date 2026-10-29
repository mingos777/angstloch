import type { Grid } from '../core/grid';
import { measureDistances } from '../core/measure-distances';
import type { MeasureDistancesOptions } from '../core/measure-distances-options';
import type { Point } from '../core/point';
import { createRoomMap } from './create-room-map';
import type { RoomShape } from './room-shape';

/**
 * Measures the walk between every two rooms of a finished map, as
 * `measureDistances` does, with each room's floor from `createRoomMap` as its
 * place, so every room of every kind counts, halls and caverns included.
 * Returns a rooms by rooms matrix indexed by room id; a room with no floor on
 * the map has -1 everywhere.
 */
export function measureRoomDistances(
  result: { grid: Grid; roomShapes: readonly RoomShape[] },
  options: MeasureDistancesOptions = {},
): number[][] {
  const { grid, roomShapes } = result;
  const places: Point[][] = roomShapes.map(() => []);
  createRoomMap(result).forEach((id, tile) => {
    const x = tile % grid.width;
    places[id]?.push({ x, y: (tile - x) / grid.width });
  });
  return measureDistances(grid, places, options);
}
