import type { Area } from '../../core/area';
import { anchorOrigin } from '../../core/anchor-origin';
import { checkTemplateSpot } from './check-template-spot';
import { crowded } from '../placements-conflict';
import type { SpotProblem } from './check-template-spot';
import { createTemplateVariants } from './create-template-variants';
import { templateVariantFitsLattice } from './template-variant-fits-lattice';
import { findTemplateExits } from './find-template-exits';
import type { PlacementArea } from '../placement-area';
import type { Position } from '../../core/position';
import type { Random } from '../../core/random';
import { randomInt } from '../../core/random-int';
import type { RoomTemplate } from './room-template';
import type { TemplatePlacement } from './template-placement';
import { TemplatePlacementError } from './template-placement-error';

interface Candidate {
  placement: TemplatePlacement;
  distance: number;
}

/**
 * Places one copy of a template. Without a position, or with a
 * `positionAccuracy` of 0, the spot is random. Otherwise the target is the
 * position, moved by up to `(1 - positionAccuracy)` times half the shorter map
 * side, and the nearest valid spot to it is used. Throws a
 * `TemplatePlacementError` when no variant has a valid spot anywhere (a
 * permanent one when the template cannot fit the map at all). Spots
 * that `accepts` turns down count as colliding. With a `region`, the whole
 * room must lie inside it.
 */
export function placeTemplate(
  random: Random,
  template: RoomTemplate,
  index: number,
  area: PlacementArea,
  obstacles: readonly TemplatePlacement[],
  position?: Position,
  accepts: (placement: TemplatePlacement) => boolean = () => true,
  region?: Area,
): TemplatePlacement {
  const fail = (cause: string, permanent = false): never => {
    throw new TemplatePlacementError(index, template.name, cause, permanent);
  };
  const allowed = template.rotate ?? [0];
  const rotations =
    position?.rotations === undefined
      ? allowed
      : allowed.filter((rotation) => position.rotations?.includes(rotation));
  const variants = shuffle(
    random,
    createTemplateVariants(template, rotations).filter(
      (variant) => !area.lattice || templateVariantFitsLattice(variant),
    ),
  );
  if (variants.length === 0) {
    return fail(
      area.lattice ? 'no variant fits the lattice' : 'no variant is allowed',
      true,
    );
  }

  const accuracy = template.positionAccuracy ?? 1;
  const aimed = position !== undefined && accuracy > 0;
  const step = area.lattice ? 2 : 1;
  let best: Candidate | undefined;
  const problems: Record<SpotProblem | 'size', number> = {
    conflict: 0,
    exit: 0,
    size: 0,
  };

  for (const variant of variants) {
    const bounds = region ?? {
      x: 0,
      y: 0,
      width: area.width,
      height: area.height,
    };
    if (variant.width > bounds.width || variant.height > bounds.height) {
      problems.size++;
      continue;
    }
    const exits = findTemplateExits(variant.cells);
    const target = aimed
      ? aim(random, position, accuracy, area, variant.width, variant.height)
      : undefined;
    const spots: Candidate[] = [];
    let nearest: Candidate | undefined;
    // lattice rooms start on even coordinates
    const first = (from: number): number =>
      area.lattice ? from + (from % 2) : from;
    const right = Math.min(bounds.x + bounds.width, area.width) - variant.width;
    const bottom =
      Math.min(bounds.y + bounds.height, area.height) - variant.height;
    for (let y = first(bounds.y); y <= bottom; y += step) {
      for (let x = first(bounds.x); x <= right; x += step) {
        const distance =
          target === undefined ? 0 : (x - target.x) ** 2 + (y - target.y) ** 2;
        if (nearest !== undefined && distance >= nearest.distance) {
          continue;
        }
        const placement: TemplatePlacement = { ...variant, x, y, exits };
        const problem =
          checkTemplateSpot(placement, area, obstacles) ??
          (accepts(placement) ? undefined : 'conflict');
        if (problem !== undefined) {
          problems[problem]++;
        } else if (target === undefined) {
          spots.push({ placement, distance });
        } else {
          nearest = { placement, distance };
        }
      }
    }
    if (target === undefined) {
      // spots that touch no other room come first, and others are a last resort
      let touching: Candidate | undefined;
      while (spots.length > 0) {
        const [spot] = spots.splice(randomInt(random, 0, spots.length - 1), 1);
        if (
          spot &&
          !obstacles.some((other) =>
            crowded(spot.placement, other, area.spacing),
          )
        ) {
          return spot.placement;
        }
        touching ??= spot;
      }
      if (touching) {
        return touching.placement;
      }
    } else if (
      nearest !== undefined &&
      (best === undefined || nearest.distance < best.distance)
    ) {
      best = nearest;
    }
  }
  if (best !== undefined) {
    return best.placement;
  }
  if (problems.conflict + problems.exit === 0) {
    return fail(
      region
        ? `is bigger than the ${String(region.width)}x${String(region.height)} area`
        : `is bigger than the ${String(area.width)}x${String(area.height)} map`,
      true,
    );
  }
  return fail(
    `no free spot: ${String(problems.conflict)} spots collide with other rooms, ` +
      `${String(problems.exit)} leave an exit without room for a corridor` +
      (area.lattice
        ? ' (on the lattice, a corridor starts on a tile with odd coordinates)'
        : ''),
  );
}

/** Returns the desired top-left corner for a position, moved by the accuracy's variance and snapped to the lattice. */
function aim(
  random: Random,
  position: Position,
  accuracy: number,
  area: PlacementArea,
  width: number,
  height: number,
) {
  const origin = anchorOrigin(position, width, height);
  const radius = Math.round(
    (1 - accuracy) * Math.floor(Math.min(area.width, area.height) / 2),
  );
  const jitter = (): number =>
    radius === 0 ? 0 : randomInt(random, -radius, radius);
  const x = origin.x + jitter();
  const y = origin.y + jitter();
  return area.lattice
    ? { x: x - (x % 2 === 0 ? 0 : 1), y: y - (y % 2 === 0 ? 0 : 1) }
    : { x, y };
}

function shuffle<T>(random: Random, items: T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = randomInt(random, 0, i);
    [result[i], result[j]] = [result[j] as T, result[i] as T];
  }
  return result;
}
