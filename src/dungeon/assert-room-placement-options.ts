import { assertFraction } from '../core/assert-fraction';
import { assertLayoutSymmetry } from '../core/assert-layout-symmetry';
import { assertRange } from '../core/assert-range';
import { assertWholeNumber } from '../core/assert-whole-number';
import { validateTemplate } from '../rooms/templates/validate-template';
import { validateTemplateLattice } from '../rooms/templates/validate-template-lattice';
import type { RoomPlacementOptions } from './room-placement-options';

/** Throws a `RangeError` unless the options of a room placement step, templates included, are valid as far as they can be told without the map. */
export function assertRoomPlacementOptions(
  options: RoomPlacementOptions & { spacingUniformity?: number },
): void {
  // widened, since the placements may be added to
  const placement: string = options.placement ?? 'free';
  if (placement !== 'free' && placement !== 'lattice') {
    throw new RangeError(
      `placement must be 'free' or 'lattice', got ${placement}`,
    );
  }
  for (const [name, value] of [
    ['sizeUniformity', options.sizeUniformity],
    ['spacingUniformity', options.spacingUniformity],
    ['fill', options.fill],
    ['doorChance', options.doorChance],
    ['symmetryChance', options.symmetryChance],
  ] as const) {
    if (value !== undefined) {
      assertFraction(name, value);
    }
  }
  for (const [name, value, min] of [
    ['roomWidth', options.roomWidth, 1],
    ['roomHeight', options.roomHeight, 1],
    ['roomCount', options.roomCount, 0],
    ['count', options.count, 0],
  ] as const) {
    if (value) {
      assertRange(name, value, min);
    }
  }
  if (options.roomSpacing !== undefined) {
    assertWholeNumber('roomSpacing', options.roomSpacing, 1);
  }
  if (options.symmetry !== undefined) {
    assertLayoutSymmetry('symmetry', options.symmetry);
  }
  options.templates?.forEach((template, index) => {
    validateTemplate(template, index);
    if (placement === 'lattice') {
      validateTemplateLattice(template, index);
    }
  });
}
