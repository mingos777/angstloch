import type { Random } from './random';
import type { Room } from './room';
import { EDGE_CLEARANCE } from './room-plan';
import type { RoomPlan } from './room-plan';
import { pickRoomSize } from './pick-room-size';
import { symmetricExtent } from './symmetric-extent';

/**
 * Makes the room in the middle of the map. When the layout is symmetric it is
 * its own mirror image, which takes a size of the same parity as the map (and
 * on the lattice, the right position on it): a size that does not fit is made
 * one step more, or less if there is no room for more. Returns `undefined` if
 * no such room fits the map.
 */
export function createCentreRoom(
  random: Random,
  plan: RoomPlan,
): Room | undefined {
  const lattice = plan.step === 2;
  const mirrored = plan.transforms.length > 0;
  const mirrorsX =
    mirrored && ['horizontal', 'both', 'rotational'].includes(plan.layout);
  const mirrorsY =
    mirrored && ['vertical', 'both', 'rotational'].includes(plan.layout);

  const align = (size: number, mapSize: number, max: number): number => {
    const extent = symmetricExtent(mapSize, lattice);
    const sits = (s: number): boolean =>
      (extent - s) % 2 === 0 && (!lattice || ((extent - s) / 2) % 2 === 1);
    if (sits(size)) {
      return size;
    }
    const larger = size + plan.step;
    return larger <= max || size - plan.step < 1 ? larger : size - plan.step;
  };
  const centre = (size: number, mapSize: number, mirror: boolean): number => {
    if (mirror) {
      return (symmetricExtent(mapSize, lattice) - size) / 2;
    }
    const x = Math.max(EDGE_CLEARANCE, Math.floor((mapSize - size) / 2));
    return plan.step === 2 && x % 2 === 0 ? x - 1 : x;
  };

  let width = pickRoomSize(random, plan.widths, plan.step, plan.sizeUniformity);
  let height = pickRoomSize(
    random,
    plan.heights,
    plan.step,
    plan.sizeUniformity,
  );
  if (mirrorsX) {
    width = align(width, plan.width, plan.widths.max);
  }
  if (mirrorsY) {
    height = align(height, plan.height, plan.heights.max);
  }
  const room: Room = {
    id: 0,
    x: centre(width, plan.width, mirrorsX),
    y: centre(height, plan.height, mirrorsY),
    width,
    height,
    exits: [],
    exitCount: 0,
    doorCount: 0,
  };
  const fits =
    room.x >= EDGE_CLEARANCE &&
    room.y >= EDGE_CLEARANCE &&
    room.x + width <= plan.width - EDGE_CLEARANCE &&
    room.y + height <= plan.height - EDGE_CLEARANCE;
  return fits ? room : undefined;
}
