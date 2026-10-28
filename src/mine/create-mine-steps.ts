import { carveNoiseCave } from '../cave/carve-noise-cave';
import { digCaveTunnels } from '../cave/dig-cave-tunnels';
import { addExits } from '../exits/add-exits';
import type { AnyStep } from '../pipeline/pipeline-chain';
import { digFishbone } from './dig-fishbone';
import { digPillarHalls } from './dig-pillar-halls';
import { digRings } from './dig-rings';
import { digVeins } from './dig-veins';
import type { MineStepOptions } from './mine-options';
import { placeMineRooms } from './place-mine-rooms';

/** The size of a cavern's area in the mine preset, when `caverns` gives none, before it is cut down to the map. */
const CAVERN_SIZE = { min: 12, max: 24 };

/** The default size of a cavern's area along a side of the map: `CAVERN_SIZE`, cut down to the map less its border ring. */
function cavernSize(side: number | undefined) {
  const limit = Math.max(1, (side ?? Infinity) - 2);
  return {
    min: Math.min(CAVERN_SIZE.min, limit),
    max: Math.min(CAVERN_SIZE.max, limit),
  };
}

/** The scale of a cavern's noise in the mine preset, when `caverns` gives none. */
const CAVERN_SCALE = 7;

/** The layout steps, by the key of their options. */
const LAYOUTS = ['fishbone', 'veins', 'pillars', 'rings'] as const;

/** The layout step that the options ask for, `digFishbone` when they name none. */
function createLayoutStep(options: MineStepOptions): AnyStep {
  const given = LAYOUTS.filter((key) => options[key] !== undefined);
  if (given.length > 1) {
    throw new RangeError(
      `give at most one of fishbone, veins, pillars and rings, got ${given.join(' and ')}; for two layouts in one map, run their steps with pipeline`,
    );
  }
  if (options.veins) {
    return digVeins(options.veins);
  }
  if (options.pillars) {
    return digPillarHalls(options.pillars);
  }
  if (options.rings) {
    return digRings(options.rings);
  }
  return digFishbone(options.fishbone);
}

/**
 * The steps of a mine, in order: the layout step (`digFishbone` unless
 * `veins`, `pillars` or `rings` is given), then `carveNoiseCave` and
 * `digCaveTunnels` when `caverns` is given, then `placeMineRooms` when `rooms`
 * is, and `addExits` when `exits` is. The default area of a cavern is cut
 * down to the `width` and `height` of the map, when they are given. Every
 * option is checked here, and a bad one, or more than one layout, throws a
 * `RangeError`.
 */
export function createMineSteps(
  options: MineStepOptions & { width?: number; height?: number },
): AnyStep[] {
  const { caverns, tunnels, rooms, exits } = options;
  const steps = [createLayoutStep(options)];
  if (caverns) {
    steps.push(
      carveNoiseCave({
        placement: 'beside',
        largestOnly: true,
        scaleX: CAVERN_SCALE,
        scaleY: CAVERN_SCALE,
        ...caverns,
        area: {
          width: cavernSize(options.width),
          height: cavernSize(options.height),
          ...caverns.area,
        },
      }),
    );
    if (tunnels !== false) {
      steps.push(digCaveTunnels(tunnels));
    }
  }
  if (rooms) {
    steps.push(placeMineRooms(rooms));
  }
  if (exits) {
    steps.push(addExits(exits));
  }
  return steps;
}
