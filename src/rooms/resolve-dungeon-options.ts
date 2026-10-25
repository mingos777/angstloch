import { assertDimensions } from '../core/assert-dimensions';
import { assertFraction } from '../core/assert-fraction';
import { assertRange } from '../core/assert-range';
import { assertWeight } from '../core/assert-weight';
import { assertWholeNumber } from '../core/assert-whole-number';
import type { DungeonOptions, Placement } from './dungeon-options';
import type { Random } from '../core/random';
import { resolveRandom } from '../core/resolve-random';
import type { Range } from '../core/range';

/** `DungeonOptions` with every default filled in and every value checked. */
export interface ResolvedDungeonOptions {
  width: number;
  height: number;
  random: Random;
  placement: Placement;
  roomWidth: Range;
  roomHeight: Range;
  sizeUniformity: number;
  roomCount: Range;
  roomSpacing: number;
  fill: number;
  exitsPerRoom: Range;
  loopChance: number;
  deadEndChance: number;
  doorChance: number;
  straight: number;
  horizontalBias: number;
  verticalBias: number;
}

/** Applies the defaults of the options that every dungeon generator takes, and throws a `RangeError` for values that are out of range. */
export function resolveDungeonOptions(
  options: DungeonOptions,
): ResolvedDungeonOptions {
  const resolved = {
    width: options.width,
    height: options.height,
    random: resolveRandom(options.random),
    placement: options.placement ?? 'free',
    roomWidth: options.roomWidth ?? { min: 3, max: 7 },
    roomHeight: options.roomHeight ?? { min: 3, max: 7 },
    sizeUniformity: options.sizeUniformity ?? 0,
    roomCount: options.roomCount ?? { min: 1, max: Number.MAX_SAFE_INTEGER },
    roomSpacing: options.roomSpacing ?? 1,
    fill: options.fill ?? 0.12,
    exitsPerRoom: options.exitsPerRoom ?? { min: 1, max: 3 },
    loopChance: options.loopChance ?? 0.1,
    deadEndChance: options.deadEndChance ?? 0,
    doorChance: options.doorChance ?? 1,
    straight: options.straight ?? 0.5,
    horizontalBias: options.horizontalBias ?? 0,
    verticalBias: options.verticalBias ?? 0,
  };

  assertDimensions(resolved.width, resolved.height);
  assertRange('roomWidth', resolved.roomWidth, 1);
  assertRange('roomHeight', resolved.roomHeight, 1);
  assertRange('roomCount', resolved.roomCount, 0);
  assertRange('exitsPerRoom', resolved.exitsPerRoom, 1);
  assertFraction('sizeUniformity', resolved.sizeUniformity);
  assertWholeNumber('roomSpacing', resolved.roomSpacing, 1);
  assertFraction('fill', resolved.fill);
  assertFraction('loopChance', resolved.loopChance);
  assertFraction('deadEndChance', resolved.deadEndChance);
  assertFraction('doorChance', resolved.doorChance);
  assertFraction('straight', resolved.straight);
  assertWeight('horizontalBias', resolved.horizontalBias);
  assertWeight('verticalBias', resolved.verticalBias);
  return resolved;
}
