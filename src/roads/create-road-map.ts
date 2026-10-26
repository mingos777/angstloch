import type { Random } from '../core/random';
import { createSimplexNoise } from '../noise/create-simplex-noise';
import type { RoadMap } from './road-map';

/** Makes an empty road map, ready for roads and paths. Uses `random` to make the noise that bends them. */
export function createRoadMap(
  mapWidth: number,
  mapHeight: number,
  random: Random,
  windiness = 0.3,
): RoadMap {
  return {
    mapWidth,
    mapHeight,
    windiness,
    noise: createSimplexNoise(random),
    covered: new Uint8Array(mapWidth * mapHeight),
    owner: new Int32Array(mapWidth * mapHeight).fill(-1),
    roads: [],
    junctions: [],
  };
}
