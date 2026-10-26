import type { Point } from '../core/point';
import type { Random } from '../core/random';
import type { Range } from '../core/range';
import { randomInt } from '../core/random-int';
import { createSimplexNoise } from '../noise/create-simplex-noise';
import { roadDistance } from '../roads/road-distance';
import { assertClearing } from './assert-clearing';
import type { Clearing } from './clearing';
import type { ClearingLayout } from './clearing-layout';
import type { ClearingPath } from './clearing-path';
import type { ClearingSpec } from './clearing-spec';
import { stampClearing } from './stamp-clearing';

/** How ragged a clearing is when it does not say. */
const DEFAULT_IRREGULARITY = 0.5;

/** Picks a radius from the range, without touching `random` when the range is a single value. */
function rollRadius(range: Range, random: Random): number {
  return range.min === range.max
    ? range.min
    : randomInt(random, range.min, range.max);
}

/** How far from a road a clearing at random lies when it does not say. */
const DEFAULT_ROAD_DISTANCE = { min: 8, max: 25 };

/** The width of the path to a clearing when it does not say. */
const DEFAULT_PATH_WIDTH = 1;

/** How much the path to a clearing winds when it does not say. */
const DEFAULT_PATH_WINDINESS = 0.3;

/** Where in the noise each clearing looks, so that no two have the same outline. */
const NOISE_SPAN = 1000;

/** How many random centers are tried for a clearing before it is given up. */
const ATTEMPTS = 200;

/** How far from a road the center of a random clearing may lie at most. */
function reachOf(spec: ClearingSpec): number {
  return (spec.roadDistance ?? DEFAULT_ROAD_DISTANCE).max;
}

/** The largest radius of a clearing, which is how much room it asks for. */
function reach(clearing: Clearing): number {
  return Math.max(clearing.radiusX, clearing.radiusY);
}

/**
 * Picks a random center for a clearing that lies inside the map with its
 * whole plain oval, within the `roadDistance` range of a road when there are
 * `distances` to roads, and keeps `spacing` tiles beyond the radii from every
 * clearing in `placed`. Returns nothing when no such place turns up.
 */
function findCenter(
  shape: Omit<Clearing, 'x' | 'y'>,
  roadDistance: { min: number; max: number },
  placed: readonly Clearing[],
  spacing: number,
  width: number,
  height: number,
  distances: Float32Array | undefined,
  random: Random,
  streamTiles?: readonly Point[],
): Point | undefined {
  const margin = Math.ceil(reach({ x: 0, y: 0, ...shape }));
  if (width <= 2 * margin || height <= 2 * margin) {
    return undefined;
  }
  // on a stream, only its tiles are candidates, with roads only the tiles in
  // the distance range
  let candidates: Point[] | undefined;
  if (streamTiles) {
    candidates = streamTiles.filter(
      ({ x, y }) =>
        x >= margin && y >= margin && x < width - margin && y < height - margin,
    );
    if (candidates.length === 0) {
      return undefined;
    }
  } else if (distances) {
    candidates = [];
    for (let y = margin; y < height - margin; ++y) {
      for (let x = margin; x < width - margin; ++x) {
        const away = distances[y * width + x] ?? Infinity;
        if (away >= roadDistance.min && away <= roadDistance.max) {
          candidates.push({ x, y });
        }
      }
    }
    if (candidates.length === 0) {
      return undefined;
    }
  }
  for (let attempt = 0; attempt < ATTEMPTS; ++attempt) {
    const { x, y } = candidates
      ? (candidates[randomInt(random, 0, candidates.length - 1)] as Point)
      : {
          x: randomInt(random, margin, width - 1 - margin),
          y: randomInt(random, margin, height - 1 - margin),
        };
    const free = placed.every(
      (other) =>
        Math.hypot(other.x - x, other.y - y) >=
        reach(other) + reach({ x, y, ...shape }) + spacing,
    );
    if (free) {
      return { x, y };
    }
  }
  return undefined;
}

/**
 * Makes the clearings. Clearings with a center are placed first, then the
 * others get random centers, each keeping `spacing` tiles beyond the radii
 * away from the clearings placed before it and inside the map. When there are
 * roads, a random center also lies within the `roadDistance` of its clearing
 * from a road tile. A clearing
 * that finds no room is left out. Returns the tiles the clearings cover, one
 * flag per tile row by row, the clearings that were made with their defaults
 * filled in, in the order they were asked for, and the paths that were asked
 * to lead to them. Uses `random` only when there are clearings.
 */
export function layClearings(
  specs: readonly ClearingSpec[],
  width: number,
  height: number,
  random: Random,
  layout: ClearingLayout = {},
): { covered: Uint8Array; clearings: Clearing[]; paths: ClearingPath[] } {
  specs.forEach((spec, i) => {
    assertClearing(`clearings[${String(i)}]`, spec, width, height);
  });
  const { spacing = 0, roads, branchEnds = [], streamTiles = [] } = layout;
  const covered = new Uint8Array(width * height);
  if (specs.length === 0) {
    return { covered, clearings: [], paths: [] };
  }
  const shapes = specs.map((spec) => {
    const radiusX = rollRadius(spec.radiusX, random);
    return {
      radiusX,
      radiusY: spec.radiusY ? rollRadius(spec.radiusY, random) : radiusX,
      angle: spec.angle ?? 0,
    };
  });
  const centers: (Point | undefined)[] = specs.map((spec) =>
    spec.x !== undefined && spec.y !== undefined
      ? { x: spec.x, y: spec.y }
      : undefined,
  );
  const atBranchEnd = specs.map((spec) => spec.at === 'branch-end');
  const distances =
    roads &&
    roadDistance(
      roads.covered,
      width,
      height,
      roads.metric,
      Math.max(...specs.map((spec) => reachOf(spec))),
    );
  const placed = (): Clearing[] =>
    shapes.flatMap((shape, i) => {
      const center = centers[i];
      return center ? [{ ...center, ...shape }] : [];
    });
  shapes.forEach((shape, i) => {
    if (!centers[i] && !atBranchEnd[i]) {
      centers[i] = findCenter(
        shape,
        specs[i]?.roadDistance ?? DEFAULT_ROAD_DISTANCE,
        placed(),
        spacing,
        width,
        height,
        distances,
        random,
        specs[i]?.at === 'stream' ? streamTiles : undefined,
      );
    }
  });

  // clearings at a branch end come last, one for each end in turn, and they
  // do not keep away from the others, so overlapping ones merge into one
  let ends = 0;
  atBranchEnd.forEach((isAtEnd, i) => {
    if (isAtEnd) {
      centers[i] = branchEnds[ends++];
    }
  });
  const indexes = specs.map((_, i) => i);
  const order = [
    ...indexes.filter((i) => !atBranchEnd[i]),
    ...indexes.filter((i) => atBranchEnd[i]),
  ];

  const noise = createSimplexNoise(random);
  const clearings: Clearing[] = [];
  const paths: ClearingPath[] = [];
  order.forEach((i) => {
    const spec = specs[i] as ClearingSpec;
    const center = centers[i];
    if (!center) {
      return;
    }
    const clearing = {
      ...center,
      ...(shapes[i] as Omit<Clearing, 'x' | 'y'>),
    };
    const left = random() * NOISE_SPAN;
    const top = random() * NOISE_SPAN;
    stampClearing(
      covered,
      width,
      height,
      clearing,
      spec.irregularity ?? DEFAULT_IRREGULARITY,
      (x, y) => noise(x + left, y + top),
    );
    clearings.push(clearing);
    // a clearing on a stream has its center in the water, where no path leads
    if (spec.path && spec.at !== 'stream') {
      const options = typeof spec.path === 'object' ? spec.path : {};
      paths.push({
        to: center,
        width: options.width ?? DEFAULT_PATH_WIDTH,
        windiness: options.windiness ?? DEFAULT_PATH_WINDINESS,
      });
    }
  });
  return { covered, clearings, paths };
}
