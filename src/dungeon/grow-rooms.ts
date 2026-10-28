import { assertRange } from '../core/assert-range';
import { assertWeight } from '../core/assert-weight';
import { assertWholeNumber } from '../core/assert-whole-number';
import type { MapStep } from '../pipeline/map-step';
import { effectiveSpacing } from '../rooms/effective-spacing';
import { fitGaps } from '../rooms/fit-gaps';
import { growRoomPlan } from '../rooms/grow-room-plan';
import { horizontalShare } from '../rooms/pick-direction';
import type { GrowRoomsOptions } from './grow-rooms-options';
import type { PlacedRooms } from './placed-rooms';
import { roomPlacementStep } from './room-placement-step';

/**
 * A step that grows the rooms of a dungeon from a seed, for corridors to join
 * them later: each new room goes beyond a wall of a room
 * there is, at a `gap` from it, so the rooms cluster and "nearest" linking
 * joins most of them to the room they were built off with a short corridor.
 * The seed is the rooms there are when the area is the whole map, or else the
 * first template, which goes in the middle unless it has positions of its own,
 * or a room in the middle. The walls are picked by `horizontalBias` and
 * `verticalBias`, and a room that 20 tries in a row from it failed is left
 * alone while there are others. Growing stops at `roomCount.max`, at the `fill` once `roomCount.min`
 * is reached, or when 300 tries in a row fail. The other templates are placed
 * first, wherever they fit, and a template that cannot be placed fails the
 * attempt, which `pipeline` retries.
 *
 * The rooms are carved but not opened. Each gets a shape in `roomShapes` and
 * reserves its footprint from it (see `reserveRoomShape`). It uses `rooms` and
 * `roomShapes` from the steps before it, and adds them again with its own
 * appended, the ids following on. The map has to start as wall, which
 * `pipeline` checks before the first attempt. Throws a `RangeError` at once
 * for a bad option or template, and for a `gap` that leaves no room for a
 * corridor at the `roomSpacing`.
 */
export function growRooms(
  options: GrowRoomsOptions = {},
): MapStep<Partial<PlacedRooms>, PlacedRooms> {
  const {
    gap = { min: 1, max: 4 },
    horizontalBias = 0,
    verticalBias = 0,
    roomSpacing = 1,
  } = options;
  assertRange('gap', gap, 0);
  // checked before it decides the gaps; the core checks the rest
  assertWholeNumber('roomSpacing', roomSpacing, 1);
  assertWeight('horizontalBias', horizontalBias);
  assertWeight('verticalBias', verticalBias);
  const lattice = options.placement === 'lattice';
  const spacing = effectiveSpacing(roomSpacing, lattice);
  const gaps = fitGaps(gap, spacing, lattice);
  if (gaps.length === 0) {
    throw new RangeError(
      `gap ${String(gap.min)} to ${String(gap.max)} puts rooms closer than a roomSpacing of ${String(spacing)} allows`,
    );
  }
  return roomPlacementStep(
    'growRooms',
    options,
    growRoomPlan(gaps, horizontalShare(horizontalBias, verticalBias)),
    true,
  );
}
