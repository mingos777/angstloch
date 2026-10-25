import type { Point } from '../core/point';
import type { Random } from '../core/random';
import { randomInt } from '../core/random-int';
import { createSimplexNoise } from '../noise/create-simplex-noise';
import { addRoad } from './add-road';
import { assertRoadOptions } from './assert-road-options';
import { findAttachPoint } from './find-attach-point';
import type { LaidRoads } from './laid-roads';
import type { RoadMap } from './road-map';
import type { RoadOptions } from './road-options';

const radians = (degrees: number) => (degrees * Math.PI) / 180;

/**
 * Lays the roads of a map of the given size. The main road runs from one
 * border to the opposite one through a point near the middle of the map.
 * Crossings and then branches are attached to the roads that are there.
 */
export function layRoads(
  mapWidth: number,
  mapHeight: number,
  random: Random,
  options: RoadOptions,
): LaidRoads {
  assertRoadOptions(options);
  const {
    angle = 'random',
    width = { min: 3, max: 3 },
    windiness = 0.3,
    crossings = { min: 0, max: 0 },
    crossingAngle = { min: 45, max: 90 },
    branches = { min: 0, max: 0 },
    branchWidth = { min: 1, max: 1 },
    branchAngle = { min: 20, max: 70 },
    branchLength,
  } = options;

  const map: RoadMap = {
    mapWidth,
    mapHeight,
    windiness,
    noise: createSimplexNoise(random),
    covered: new Uint8Array(mapWidth * mapHeight),
    owner: new Int32Array(mapWidth * mapHeight).fill(-1),
    roads: [],
    junctions: [],
  };

  const degrees = angle === 'random' ? random() * 180 : angle;
  addRoad(map, {
    kind: 'road',
    width: randomInt(random, width.min, width.max),
    origin: {
      x: mapWidth * (0.25 + 0.5 * random()),
      y: mapHeight * (0.25 + 0.5 * random()),
    },
    angle: radians(degrees),
    directions: [-1, 1],
  });

  const side = () => (random() < 0.5 ? 1 : -1);

  for (let n = randomInt(random, crossings.min, crossings.max); n > 0; --n) {
    const attach = findAttachPoint(map, random);
    if (!attach) {
      break;
    }
    addRoad(map, {
      kind: 'road',
      width: randomInt(random, width.min, width.max),
      origin: { x: attach.tile.x + 0.5, y: attach.tile.y + 0.5 },
      angle:
        attach.heading +
        side() *
          radians(randomInt(random, crossingAngle.min, crossingAngle.max)),
      directions: [-1, 1],
    });
  }

  for (let n = randomInt(random, branches.min, branches.max); n > 0; --n) {
    const attach = findAttachPoint(map, random);
    if (!attach) {
      break;
    }
    // the branch leaves along the road or against it, to either side
    const heading = attach.heading + (random() < 0.5 ? 0 : Math.PI);
    addRoad(map, {
      kind: 'branch',
      width: randomInt(random, branchWidth.min, branchWidth.max),
      origin: { x: attach.tile.x + 0.5, y: attach.tile.y + 0.5 },
      angle:
        heading +
        side() * radians(randomInt(random, branchAngle.min, branchAngle.max)),
      directions: [1],
      maxLength: branchLength
        ? randomInt(random, branchLength.min, branchLength.max)
        : undefined,
    });
  }

  const exits: Point[] = [];
  const onBorder = ({ x, y }: Point) =>
    x === 0 || y === 0 || x === mapWidth - 1 || y === mapHeight - 1;
  for (const { points } of map.roads) {
    for (const end of [points[0], points[points.length - 1]]) {
      if (
        end &&
        onBorder(end) &&
        !exits.some(({ x, y }) => x === end.x && y === end.y)
      ) {
        exits.push({ x: end.x, y: end.y });
      }
    }
  }

  return {
    roads: map.roads,
    junctions: map.junctions,
    exits,
    covered: map.covered,
  };
}
