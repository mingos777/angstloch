import { assertDimensions } from '../core/assert-dimensions';
import { assertFraction } from '../core/assert-fraction';
import { assertRange } from '../core/assert-range';
import { assertWholeNumber } from '../core/assert-whole-number';
import type { MineOptions } from './mine-options';

/** Throws a `RangeError` unless the mine options are valid. */
export function assertMineOptions(options: MineOptions): void {
  const { width, height, angle = 'random' } = options;
  // widened, since the layouts may be added to
  const layout: string = options.layout ?? 'fishbone';
  assertDimensions(width, height);
  if (
    layout !== 'fishbone' &&
    layout !== 'veins' &&
    layout !== 'pillars' &&
    layout !== 'rings'
  ) {
    throw new RangeError(
      `layout must be 'fishbone', 'veins', 'pillars' or 'rings', got ${layout}`,
    );
  }
  // widened, since the shapes may be added to
  const ringShape: string = options.ringShape ?? 'oval';
  if (ringShape !== 'oval' && ringShape !== 'circle') {
    throw new RangeError(
      `ringShape must be 'oval' or 'circle', got ${ringShape}`,
    );
  }
  // widened, since the entrances may be added to
  const hallEntrances: string = options.hallEntrances ?? 'facing';
  if (hallEntrances !== 'facing' && hallEntrances !== 'edge') {
    throw new RangeError(
      `hallEntrances must be 'facing' or 'edge', got ${hallEntrances}`,
    );
  }
  if (angle !== 'random' && !Number.isFinite(angle)) {
    throw new RangeError(
      `angle must be a finite number or 'random', got ${String(angle)}`,
    );
  }
  for (const [name, value] of [
    ['density', options.density],
    ['shaftWindiness', options.shaftWindiness],
    ['aditWindiness', options.aditWindiness],
    ['veinWindiness', options.veinWindiness],
    ['hallRagged', options.hallRagged],
    ['ringWobble', options.ringWobble],
    ['cavernFill', options.cavernFill],
    ['doorChance', options.doorChance],
    ['pillarRagged', options.pillarRagged],
    ['pillarJitter', options.pillarJitter],
    ['loops', options.loops],
  ] as const) {
    if (value !== undefined) {
      assertFraction(name, value);
    }
  }
  for (const [name, range] of [
    ['shaftWidth', options.shaftWidth],
    ['aditWidth', options.aditWidth],
    ['veinWidth', options.veinWidth],
    ['halls', options.halls],
    ['rings', options.rings],
    ['ringWidth', options.ringWidth],
    ['hallVeins', options.hallVeins],
    ['hallSize', options.hallSize],
    ['pillarSize', options.pillarSize],
    ['pillarSpacing', options.pillarSpacing],
    ['aditLength', options.aditLength],
    ['branchAngle', options.branchAngle],
  ] as const) {
    if (range) {
      assertRange(name, range, 1);
    }
  }
  if (options.exitsPerRoom) {
    assertRange('exitsPerRoom', options.exitsPerRoom, 1);
  }
  if (options.rooms) {
    const { count, width: roomWidth, height: roomHeight } = options.rooms;
    if (count) {
      assertRange('rooms.count', count, 0);
    }
    if (roomWidth) {
      assertRange('rooms.width', roomWidth, 1);
    }
    if (roomHeight) {
      assertRange('rooms.height', roomHeight, 1);
    }
    if (options.rooms.sizeUniformity !== undefined) {
      assertFraction('rooms.sizeUniformity', options.rooms.sizeUniformity);
    }
  }
  if (options.caverns) {
    assertRange('caverns', options.caverns, 0);
  }
  if (options.cavernSize) {
    assertRange('cavernSize', options.cavernSize, 3);
  }
  if (options.spokes) {
    assertRange('spokes', options.spokes, 0);
  }
  if (options.branchAngle && options.branchAngle.max > 179) {
    throw new RangeError(
      `branchAngle.max must be at most 179 degrees, got ${String(options.branchAngle.max)}`,
    );
  }
  if (options.veinSpacing !== undefined) {
    assertWholeNumber('veinSpacing', options.veinSpacing, 3);
  }
  if (options.minExits !== undefined) {
    assertWholeNumber('minExits', options.minExits, 0);
  }
  if (options.maxExits !== undefined) {
    assertWholeNumber('maxExits', options.maxExits, 0);
  }
}
