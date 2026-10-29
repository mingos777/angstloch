import type { DigCorridorsOptions } from './dig-corridors-options';
import type { CorridorSettings } from './join-rooms';

/** Fills in the defaults of the options of `digCorridors`. */
export function resolveCorridorSettings(
  options: DigCorridorsOptions,
): CorridorSettings {
  return {
    connection: options.connection ?? 'nearest',
    exitsPerRoom: options.exitsPerRoom ?? { min: 1, max: 3 },
    loopChance: options.loopChance ?? 0.1,
    deadEndChance: options.deadEndChance ?? 0,
    doorChance: options.doorChance ?? 1,
    straight: options.straight ?? 0.5,
    horizontalBias: options.horizontalBias ?? 0,
    verticalBias: options.verticalBias ?? 0,
    placement: options.placement ?? 'free',
    symmetry: options.symmetry ?? 'none',
    symmetryChance: options.symmetryChance ?? 1,
    corridorSymmetry: options.corridorSymmetry ?? 'none',
    corridorSymmetryChance: options.corridorSymmetryChance ?? 1,
  };
}
