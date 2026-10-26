import type { Point } from '../core/point';
import type { Random } from '../core/random';
import { randomInt } from '../core/random-int';
import { addRoad } from './add-road';
import { findAttachPoint } from './find-attach-point';
import { layRoadEntries } from './lay-road-entries';
import type { RoadMap } from './road-map';
import type { RoadOptions } from './road-options';

const radians = (degrees: number) => (degrees * Math.PI) / 180;

/**
 * Lays the roads of the options on the road map. The main road runs from one
 * border to the opposite one through a point near the middle of the map.
 * Crossings and then branches are attached to the roads that are there. The
 * options must be valid, and `windiness` is the one of the map. When the
 * options have `specs`, those roads are laid instead. `reshape` changes the
 * centerline of every generated road before it is laid, and does not apply to
 * the roads of `specs`.
 */
export function layRoadNetwork(
  map: RoadMap,
  random: Random,
  options: RoadOptions,
  reshape?: (points: Point[]) => Point[],
): void {
  if (options.specs) {
    layRoadEntries(map, random, options.specs);
    return;
  }
  const { mapWidth, mapHeight } = map;
  const {
    angle = 'random',
    width = { min: 3, max: 3 },
    crossings = { min: 0, max: 0 },
    crossingAngle = { min: 45, max: 90 },
    branches = { min: 0, max: 0 },
    branchWidth = { min: 1, max: 1 },
    branchAngle = { min: 20, max: 70 },
    branchLength,
  } = options;

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
    reshape,
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
      reshape,
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
      reshape,
    });
  }
}
