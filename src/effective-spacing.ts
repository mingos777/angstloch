/** Wall tiles between rooms: lattice rooms sit on odd coordinates, which only odd spacings preserve. */
export function effectiveSpacing(
  roomSpacing: number,
  lattice: boolean,
): number {
  return lattice ? roomSpacing + ((roomSpacing + 1) % 2) : roomSpacing;
}
