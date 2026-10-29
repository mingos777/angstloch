import type { Area } from '../core/area';
import type { Random } from '../core/random';
import type { Range } from '../core/range';
import type { NoiseFunction } from '../noise/noise-function';
import { createSimplexNoise } from '../noise/create-simplex-noise';
import type { AreaSize } from '../pipeline/area-size';
import { buildInArea } from '../pipeline/build-in-area';
import type { MapState } from '../pipeline/map-state';
import { placeAreas } from '../pipeline/place-areas';
import { LANE_SPACING } from '../veins/dig-vein';
import type { MinePassage } from '../veins/mine-passage';

/**
 * Digs a mine layout once in every area that `placeAreas` picks, and returns
 * the passages and halls of the state, if any, followed by the new ones. `lay`
 * gets the scratch state of the box (see `buildInArea`), the noise that all
 * copies share, and the lane of the first passage, which follows on from the
 * passages so far, so that no two passages bend alike. The passages and halls
 * it returns are shifted to the coordinates of the map.
 */
export function digInAreas(
  state: MapState & { passages?: MinePassage[]; halls?: Area[] },
  random: Random,
  area: AreaSize,
  count: Range,
  lay: (
    scratch: MapState,
    noise: NoiseFunction,
    lane: number,
  ) => { passages: MinePassage[]; halls?: Area[] },
): { passages: MinePassage[]; halls: Area[] } {
  const passages = [...(state.passages ?? [])];
  const halls = [...(state.halls ?? [])];
  const noise = createSimplexNoise(random);
  for (const box of placeAreas(state, random, area, count)) {
    const laid = buildInArea(state, box, (scratch) =>
      lay(scratch, noise, 0.5 + passages.length * LANE_SPACING),
    );
    for (const passage of laid.passages) {
      passages.push({
        ...passage,
        tiles: passage.tiles.map(({ x, y }) => ({
          x: x + box.x,
          y: y + box.y,
        })),
      });
    }
    for (const hall of laid.halls ?? []) {
      halls.push({ ...hall, x: hall.x + box.x, y: hall.y + box.y });
    }
  }
  return { passages, halls };
}
