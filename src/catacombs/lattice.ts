import type { Area } from '../core/area';

/** A straight gallery across the whole lattice of a catacomb: a row or a column. */
export interface GalleryLine {
  /** The first row of a row, or the first column of a column, on the map. */
  start: number;
  /** How many tiles wide it is. */
  width: number;
  main: boolean;
}

/** The lattice of a catacomb: rows and columns of galleries, from the top and from the left. Where a row and a column cross is a node, numbered `row * columns.length + column`. */
export interface Lattice {
  columns: GalleryLine[];
  rows: GalleryLine[];
}

/** A stretch of gallery between two nodes of a lattice next to each other along a row or a column. */
export interface LatticeEdge {
  /** The node on the left or at the top. */
  from: number;
  /** The node on the right or at the bottom. */
  to: number;
  /** The row or the column it runs along. */
  line: GalleryLine;
  horizontal: boolean;
  /** Its floor between the two nodes. */
  between: Area;
  /** Its floor with the two nodes. */
  span: Area;
}
