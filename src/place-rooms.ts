import type { Placement } from './dungeon-options';
import { fitSizes } from './fit-sizes';
import { partitionRooms } from './partition-rooms';
import type { Random } from './random';
import type { Range } from './range';
import type { Room } from './room';
import { EDGE_CLEARANCE } from './room-plan';
import type { RoomPlan } from './room-plan';
import type { RoomPartition } from './room-dungeon-options';
import { scatterRooms } from './scatter-rooms';

export interface PlaceRoomsOptions {
  width: number;
  height: number;
  placement: Placement;
  partition: RoomPartition;
  roomWidth: Range;
  roomHeight: Range;
  sizeUniformity: number;
  spacingUniformity: number;
  roomCount: Range;
  roomSpacing: number;
  fill: number;
}

/** Places non-overlapping rooms on the map with the chosen partitioning method. */
export function placeRooms(random: Random, options: PlaceRoomsOptions): Room[] {
  const { width, height } = options;
  const step = options.placement === 'lattice' ? 2 : 1;
  const widths = fitSizes(options.roomWidth, step, width - 2 * EDGE_CLEARANCE);
  const heights = fitSizes(
    options.roomHeight,
    step,
    height - 2 * EDGE_CLEARANCE,
  );
  if (!widths || !heights) {
    return [];
  }

  const plan: RoomPlan = {
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
  return options.partition === 'bsp'
    ? partitionRooms(random, plan)
    : scatterRooms(random, plan);
}
