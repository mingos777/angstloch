import type { Area } from '../core/area';
import type { Point } from '../core/point';
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

/** A hall that a layout dug: the box it was dug in and its floor tiles. */
export interface DugHall {
  box: Area;
  tiles: Point[];
}

/**
 * Digs a mine layout once in every area that `placeAreas` picks, and returns
 * the passages of the state, if any, followed by the new ones, and the box of
 * every area with the halls dug there, each its box and its floor tiles. `lay` gets the
 * scratch state of the box (see `buildInArea`), the noise that all copies
 * share, and the lane of the first passage, which follows on from the
 * passages so far, so that no two passages bend alike. The passages and halls
 * it returns are shifted to the coordinates of the map.
 */
export function digInAreas(
  state: MapState & { passages?: MinePassage[] },
  random: Random,
  area: AreaSize,
  count: Range,
  lay: (
    scratch: MapState,
    noise: NoiseFunction,
    lane: number,
  ) => { passages: MinePassage[]; halls?: DugHall[] },
): { passages: MinePassage[]; areas: { box: Area; halls: DugHall[] }[] } {
  const passages = [...(state.passages ?? [])];
  const areas: { box: Area; halls: DugHall[] }[] = [];
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
    areas.push({
      box,
      halls: (laid.halls ?? []).map((hall) => ({
        box: { ...hall.box, x: hall.box.x + box.x, y: hall.box.y + box.y },
        tiles: hall.tiles.map(({ x, y }) => ({ x: x + box.x, y: y + box.y })),
      })),
    });
  }
  return { passages, areas };
}
