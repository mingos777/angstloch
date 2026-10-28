import type { Random } from '../core/random';
import { randomInt } from '../core/random-int';
import { addRoad } from '../roads/add-road';
import { createRoadMap } from '../roads/create-road-map';
import { findAttachPoint } from '../roads/find-attach-point';
import { findDeepWater } from './find-deep-water';
import type { LaidStreams } from './laid-streams';
import type { StreamOptions } from './stream-options';

/**
 * Lays the streams of a map of the given size: a main stream that runs from
 * one border to the opposite one through a point near the middle, flowing the
 * way of its `angle`. The options must be valid.
 */
export function buildStreams(
  mapWidth: number,
  mapHeight: number,
  random: Random,
  options: StreamOptions,
): LaidStreams {
  const {
    angle = 'random',
    spring = false,
    width = { min: 1, max: 2 },
    windiness = 0.5,
    shoreWidth = 1,
    tributaries = { min: 0, max: 0 },
    tributaryWidth = { min: 1, max: 1 },
    tributaryAngle = { min: 30, max: 60 },
    tributaryLength,
  } = options;
  const map = createRoadMap(mapWidth, mapHeight, random, windiness);

  const degrees = angle === 'random' ? random() * 360 : angle;
  addRoad(map, {
    kind: 'road',
    width: randomInt(random, width.min, width.max),
    origin: {
      x: mapWidth * (0.25 + 0.5 * random()),
      y: mapHeight * (0.25 + 0.5 * random()),
    },
    angle: (degrees * Math.PI) / 180,
    directions: spring ? [1] : [-1, 1],
  });

  // a tributary leaves the stream against its flow, to either side, so that
  // the water of the two joins at an acute angle
  for (
    let n = randomInt(random, tributaries.min, tributaries.max);
    n > 0;
    --n
  ) {
    const attach = findAttachPoint(map, random);
    if (!attach) {
      break;
    }
    addRoad(map, {
      kind: 'branch',
      width: randomInt(random, tributaryWidth.min, tributaryWidth.max),
      origin: { x: attach.tile.x + 0.5, y: attach.tile.y + 0.5 },
      angle:
        attach.heading +
        Math.PI +
        (random() < 0.5 ? 1 : -1) *
          ((randomInt(random, tributaryAngle.min, tributaryAngle.max) *
            Math.PI) /
            180),
      directions: [1],
      maxLength: tributaryLength
        ? randomInt(random, tributaryLength.min, tributaryLength.max)
        : undefined,
    });
  }

  return {
    map,
    // the branches grow away from the stream they join, and the water flows the other way
    streams: map.roads.map((stream) =>
      stream.kind === 'branch'
        ? { ...stream, points: [...stream.points].reverse() }
        : stream,
    ),
    water: map.covered,
    deep: findDeepWater(map.roads, mapWidth, mapHeight, shoreWidth),
  };
}
