/**
 * The size of a map along one axis as far as symmetry is concerned. On the
 * lattice an even size counts as the odd size below it, which leaves the last
 * row or column as extra border, so that the axis falls on a lattice tile.
 */
export function symmetricExtent(size: number, lattice: boolean): number {
  return lattice && size % 2 === 0 ? size - 1 : size;
}
