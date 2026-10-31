/** The odd size a lattice uses for a size drawn from a range that starts at `min`: the size itself when odd, else the next odd size down, or up when that would be 0 or below `min`. */
export function snapToLattice(size: number, min: number): number {
  if (size % 2 === 1) {
    return size;
  }
  return size - 1 >= min && size > 1 ? size - 1 : size + 1;
}
