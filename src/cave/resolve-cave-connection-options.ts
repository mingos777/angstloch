import { assertFraction } from '../core/assert-fraction';
import { assertLayoutSymmetry } from '../core/assert-layout-symmetry';
import { assertWholeNumber } from '../core/assert-whole-number';
import type { CaveConnectionOptions } from './cave-connection-options';

/** Connection options with every default filled in. */
export type ResolvedCaveConnectionOptions = Required<CaveConnectionOptions>;

/** Fills in the defaults of the connection options and throws a `RangeError` for values out of range. */
export function resolveCaveConnectionOptions(
  options: CaveConnectionOptions,
): ResolvedCaveConnectionOptions {
  const {
    borderWalls = true,
    minRegionSize = 0,
    connect = 'tunnel',
    tunnelStyle = 'winding',
    tunnelWidth = 1,
    tunnelWindiness = 0.5,
    tunnelLoops = 0,
    tunnelSymmetryChance = 1,
    layoutSymmetry = 'none',
    layoutSymmetryChance = 1,
    minExits = 0,
  } = options;

  assertWholeNumber('minRegionSize', minRegionSize, 0);
  assertWholeNumber('tunnelWidth', tunnelWidth, 1);
  assertFraction('tunnelWindiness', tunnelWindiness);
  assertFraction('tunnelLoops', tunnelLoops);
  assertFraction('tunnelSymmetryChance', tunnelSymmetryChance);
  assertLayoutSymmetry('layoutSymmetry', layoutSymmetry);
  assertFraction('layoutSymmetryChance', layoutSymmetryChance);
  assertWholeNumber('minExits', minExits, 0);
  const maxExits = Math.max(minExits, options.maxExits ?? minExits);
  assertWholeNumber('maxExits', maxExits, 0);

  return {
    borderWalls,
    minRegionSize,
    connect,
    tunnelStyle,
    tunnelWidth,
    tunnelWindiness,
    tunnelLoops,
    tunnelSymmetryChance,
    layoutSymmetry,
    layoutSymmetryChance,
    minExits,
    maxExits,
  };
}
