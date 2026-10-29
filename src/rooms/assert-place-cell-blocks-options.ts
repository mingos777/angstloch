import { assertFraction } from '../core/assert-fraction';
import { assertRange } from '../core/assert-range';
import type { PlaceCellBlocksOptions } from './place-cell-blocks-options';

const ORIENTATIONS: readonly string[] = ['horizontal', 'vertical', 'any'];
const CELL_DOORS: readonly string[] = ['centered', 'jittered'];
const PLACEMENTS: readonly string[] = ['free', 'lattice'];
const GUARD_PLACEMENTS: readonly string[] = ['beside', 'through', 'any'];

/** Throws a `RangeError` unless the options of `placeCellBlocks` are valid. The `area` is checked against the map later. */
export function assertPlaceCellBlocksOptions(
  options: PlaceCellBlocksOptions,
): void {
  for (const [name, range, min] of [
    ['blocks', options.blocks, 0],
    ['cellSize.width', options.cellSize?.width, 1],
    ['cellSize.depth', options.cellSize?.depth, 1],
    ['cellsPerSide', options.cellsPerSide, 1],
    ['sides', options.sides, 1],
    ['corridorWidth', options.corridorWidth, 1],
    ['count', options.count, 0],
    ['guardRoom.size.width', options.guardRoom?.size?.width, 1],
    ['guardRoom.size.depth', options.guardRoom?.size?.depth, 1],
    ['guardRoom.tunnel', options.guardRoom?.tunnel, 0],
  ] as const) {
    if (range) {
      assertRange(name, range, min);
    }
  }
  if (options.sides && options.sides.max > 2) {
    throw new RangeError(
      `sides.max must be at most 2, got ${String(options.sides.max)}`,
    );
  }
  if (
    options.orientation !== undefined &&
    !ORIENTATIONS.includes(options.orientation)
  ) {
    throw new RangeError(
      `orientation must be one of ${ORIENTATIONS.join(', ')}, got ${options.orientation}`,
    );
  }
  if (
    options.cellDoors !== undefined &&
    !CELL_DOORS.includes(options.cellDoors)
  ) {
    throw new RangeError(
      `cellDoors must be one of ${CELL_DOORS.join(', ')}, got ${options.cellDoors}`,
    );
  }
  if (
    options.placement !== undefined &&
    !PLACEMENTS.includes(options.placement)
  ) {
    throw new RangeError(
      `placement must be one of ${PLACEMENTS.join(', ')}, got ${options.placement}`,
    );
  }
  const guard = options.guardRoom;
  if (guard?.chance !== undefined) {
    assertFraction('guardRoom.chance', guard.chance);
  }
  if (
    guard?.placement !== undefined &&
    !GUARD_PLACEMENTS.includes(guard.placement)
  ) {
    throw new RangeError(
      `guardRoom.placement must be one of ${GUARD_PLACEMENTS.join(', ')}, got ${guard.placement}`,
    );
  }
}
