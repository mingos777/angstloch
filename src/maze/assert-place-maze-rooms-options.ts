import { assertFraction } from '../core/assert-fraction';
import { assertRange } from '../core/assert-range';
import { validateTemplate } from '../rooms/templates/validate-template';
import { validateTemplateLattice } from '../rooms/templates/validate-template-lattice';
import type { PlaceMazeRoomsOptions } from './place-maze-rooms-options';

/** Throws a `RangeError` unless the options of the maze rooms, templates included, are valid as far as they can be told without the map. */
export function assertPlaceMazeRoomsOptions(
  options: PlaceMazeRoomsOptions,
): void {
  for (const [name, value] of [
    ['sizeUniformity', options.sizeUniformity],
    ['doorChance', options.doorChance],
  ] as const) {
    if (value !== undefined) {
      assertFraction(name, value);
    }
  }
  for (const [name, value, min] of [
    ['roomCount', options.roomCount, 0],
    ['roomWidth', options.roomWidth, 1],
    ['roomHeight', options.roomHeight, 1],
  ] as const) {
    if (value) {
      assertRange(name, value, min);
    }
  }
  const { keepClear } = options;
  if (
    keepClear &&
    (!Number.isInteger(keepClear.x) || !Number.isInteger(keepClear.y))
  ) {
    throw new RangeError(
      `keepClear must have whole coordinates, got (${String(keepClear.x)}, ${String(keepClear.y)})`,
    );
  }
  options.templates?.forEach((template, index) => {
    validateTemplate(template, index);
    validateTemplateLattice(template, index);
  });
}
