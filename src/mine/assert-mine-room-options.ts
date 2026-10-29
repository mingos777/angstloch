import { assertFraction } from '../core/assert-fraction';
import { assertRange } from '../core/assert-range';
import { validateTemplate } from '../rooms/templates/validate-template';
import type { PlaceMineRoomsOptions } from './place-mine-rooms-options';

/** Throws a `RangeError` unless the options of the mine rooms, templates included, are valid. */
export function assertMineRoomOptions(options: PlaceMineRoomsOptions): void {
  for (const [name, value] of [
    ['sizeUniformity', options.sizeUniformity],
    ['doorChance', options.doorChance],
    ['veinWindiness', options.veinWindiness],
  ] as const) {
    if (value !== undefined) {
      assertFraction(name, value);
    }
  }
  for (const [name, value, min] of [
    ['roomCount', options.roomCount, 0],
    ['roomWidth', options.roomWidth, 1],
    ['roomHeight', options.roomHeight, 1],
    ['exitsPerRoom', options.exitsPerRoom, 1],
    ['veinWidth', options.veinWidth, 1],
  ] as const) {
    if (value) {
      assertRange(name, value, min);
    }
  }
  options.templates?.forEach((template, index) => {
    validateTemplate(template, index);
  });
}
