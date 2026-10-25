/** The map as seen by template placement. */
export interface PlacementArea {
  width: number;
  height: number;
  /** Fewest tiles between the footprints of two placements. */
  spacing: number;
  /** Whether rooms sit on the lattice, which puts bounding boxes on even coordinates and needs odd dimensions. */
  lattice: boolean;
}
