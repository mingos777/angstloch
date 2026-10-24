import { fitSizes } from './fit-sizes';
import type { Range } from './range';
import { EDGE_CLEARANCE } from './room-plan';
import type { RoomPlan } from './room-plan';

/** The options that decide where rooms can go and how big they are. */
export interface RoomPlanOptions {
  width: number;
  height: number;
  placement: 'free' | 'lattice';
  roomWidth: Range;
  roomHeight: Range;
  sizeUniformity: number;
  spacingUniformity: number;
  roomCount: Range;
  roomSpacing: number;
  fill: number;
}

/** Resolves the options into a plan, or returns `undefined` when not even the smallest room fits the map. */
export function createRoomPlan(options: RoomPlanOptions): RoomPlan | undefined {
  const { width, height } = options;
  const step = options.placement === 'lattice' ? 2 : 1;
  const widths = fitSizes(options.roomWidth, step, width - 2 * EDGE_CLEARANCE);
  const heights = fitSizes(
    options.roomHeight,
    step,
    height - 2 * EDGE_CLEARANCE,
  );
  if (!widths || !heights) {
    return undefined;
  }
  return {
    width,
    height,
    step,
    // lattice rooms sit on odd coordinates, which only odd spacings preserve
    spacing:
      step === 2
        ? options.roomSpacing + ((options.roomSpacing + 1) % 2)
        : options.roomSpacing,
    widths,
    heights,
    sizeUniformity: options.sizeUniformity,
    spacingUniformity: options.spacingUniformity,
    roomCount: options.roomCount,
    fill: options.fill,
  };
}
