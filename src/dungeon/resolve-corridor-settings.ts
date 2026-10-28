import type { CarveCorridorsOptions } from './carve-corridors-options';
import type { CorridorSettings } from './join-rooms';

/** Fills in the defaults of the options of `carveCorridors`. */
export function resolveCorridorSettings(
  options: CarveCorridorsOptions,
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
