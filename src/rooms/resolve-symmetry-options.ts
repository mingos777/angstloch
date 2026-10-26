import { assertFraction } from '../core/assert-fraction';
import { assertLayoutSymmetry } from '../core/assert-layout-symmetry';
import type { CorridorSymmetry } from './corridor-symmetry';
import type { LayoutSymmetry } from '../core/layout-symmetry';
import type { SymmetryOptions } from './symmetry-options';

const CORRIDORS: readonly CorridorSymmetry[] = [
  'none',
  'whirlpool',
  'snowflake',
];

/** `SymmetryOptions` with every default filled in and every value checked. */
export interface ResolvedSymmetryOptions {
  layoutSymmetry: LayoutSymmetry;
  layoutSymmetryChance: number;
  corridorSymmetry: CorridorSymmetry;
  corridorSymmetryChance: number;
}

/** Applies the defaults of the symmetry options, and throws a `RangeError` for values that are out of range. */
export function resolveSymmetryOptions(
  options: SymmetryOptions,
): ResolvedSymmetryOptions {
  const resolved = {
    layoutSymmetry: options.layoutSymmetry ?? 'none',
    layoutSymmetryChance: options.layoutSymmetryChance ?? 1,
    corridorSymmetry: options.corridorSymmetry ?? 'none',
    corridorSymmetryChance: options.corridorSymmetryChance ?? 1,
  };
  assertLayoutSymmetry('layoutSymmetry', resolved.layoutSymmetry);
  if (!CORRIDORS.includes(resolved.corridorSymmetry)) {
    throw new RangeError(
      `corridorSymmetry must be one of ${CORRIDORS.join(', ')}, got ${resolved.corridorSymmetry}`,
    );
  }
  assertFraction('layoutSymmetryChance', resolved.layoutSymmetryChance);
  assertFraction('corridorSymmetryChance', resolved.corridorSymmetryChance);
  return resolved;
}
