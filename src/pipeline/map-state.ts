import type { Grid } from '../core/grid';
import type { Tile } from '../core/tile';

/**
 * The map while a pipeline builds it. Steps change `grid` and `prunable` in
 * place; whatever else they report is merged in by the pipeline as extras.
 */
export interface MapState {
  /** The tiles. */
  grid: Grid;
  /** The tile the map started as. A tile that still holds it is untouched ground. */
  base: Tile;
  /**
   * One byte per tile, row by row like the grid: 1 where the tile is ground
   * cover that a later step may remove (a tree), 0 elsewhere. A step that
   * stamps a tile clears its byte, see `stampTile`.
   */
  prunable: Uint8Array;
  /**
   * One byte per tile, row by row, holding a `Reserve` value: `None` where a
   * step may build, `Solid` where none may dig through (a room, a template) and
   * `Openable` where a step may also open an exit. Unlike `prunable`,
   * `stampTile` leaves it alone, see `reserveTile` and `openReserved`.
   */
  reserved: Uint8Array;
}
