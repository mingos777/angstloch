import type { Point } from '../core/point';
import type { Random } from '../core/random';
import { randomInt } from '../core/random-int';
import { extendPastBorder } from '../roads/extend-past-border';
import { stampRoadBrush } from '../roads/stamp-road-brush';
import { traceTiles } from '../roads/trace-tiles';
import { findBridges } from './find-bridges';
import type { StreamLayout } from './stream-layout';

/** Tiles that a footbridge is kept from the bridges that are there already, along a row or a column. */
const BRIDGE_GAP = 8;
const ATTEMPTS = 50;
/** How many tiles longer than the stream is wide a footbridge may be, which lets it cross at a slant. */
const MARGIN = 2;
/** The smallest piece of land, in tiles, that is joined to the rest: smaller ones, cut off where streams meet or leave the map, stay islands. */
const MIN_PIECE = 20;
/** The slants from square to the stream, in degrees, that a footbridge tries in turn. */
const SKEWS = [0, 10, -10, 20, -20];
/** How far a footbridge walks out of the water at a time, in tiles. */
const STEP = 0.5;
/** How many tiles of a stream's centerline before and after a tile tell which way it flows there. */
const LEAD = 3;

const DIRECTIONS = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
] as const;

/** A footbridge: the bank tiles at its two ends and the tiles over water between. */
interface Crossing {
  from: Point;
  to: Point;
  tiles: Point[];
  length: number;
}

/**
 * Lays footbridges across the water, one tile wide, square to the stream,
 * as a staircase of tiles that touch along edges where the stream runs
 * at a slant. First it joins the pieces of land that the water cuts apart,
 * the nearest first and by the shortest crossing, so that the land is one
 * piece. Only a stream at least 2 tiles wide cuts the land, since one 1
 * tile wide can be stepped through, and a piece of land smaller than
 * `MIN_PIECE` tiles stays an island. The tiles of a road count as land, as
 * do the bridges of roads. Then it adds footbridges until the map has
 * `minimum` bridges altogether, each across a stream away from the bridges
 * there. None lies on the edge of the map, and none is longer than its
 * stream is wide by more than `MARGIN` tiles; pieces of land that no such
 * footbridge can join stay apart. `crossed` marks the tiles of the roads.
 * Returns one byte per tile, row by row, 1 where a footbridge lies.
 */
export function layFootbridges(
  streams: StreamLayout,
  crossed: Uint8Array | undefined,
  random: Random,
  minimum: number,
): Uint8Array {
  const { mapWidth, mapHeight } = streams.map;
  const { water } = streams;
  const roads = crossed ?? new Uint8Array(water.length);
  const foot = new Uint8Array(water.length);
  const key = ({ x, y }: Point) => y * mapWidth + x;
  const inside = ({ x, y }: Point) =>
    x >= 0 && y >= 0 && x < mapWidth && y < mapHeight;
  // a footbridge never lies on the edge of the map, where the water leaves it
  const onEdge = ({ x, y }: Point) =>
    x === 0 || y === 0 || x === mapWidth - 1 || y === mapHeight - 1;
  const wet = (at: number) =>
    water[at] === 1 && roads[at] !== 1 && foot[at] !== 1;

  // the water of the streams wide enough to cut the land
  const cutting = new Uint8Array(water.length);
  for (const { width, points } of streams.map.roads) {
    if (width < 2) {
      continue;
    }
    for (const { x, y } of [
      ...points,
      ...extendPastBorder(points, mapWidth, mapHeight),
    ]) {
      stampRoadBrush(cutting, mapWidth, mapHeight, x, y, width);
    }
  }

  // every tile of a stream's centerline, with the way across it there
  const centers = streams.map.roads.flatMap(({ points, width }) =>
    points.map((tile, index) => {
      const before = points[Math.max(0, index - LEAD)] ?? tile;
      const after = points[Math.min(points.length - 1, index + LEAD)] ?? tile;
      return {
        tile,
        width,
        across:
          Math.atan2(after.y - before.y, after.x - before.x) + Math.PI / 2,
      };
    }),
  );

  /**
   * The footbridge through a tile of water in a direction, walking out of
   * the water both ways, or `undefined` when it leaves the map, runs onto
   * its edge or is longer than `longest`.
   */
  const crossing = (
    center: Point,
    direction: number,
    longest: number,
  ): Crossing | undefined => {
    if (!wet(key(center))) {
      return undefined;
    }
    const [from, to] = [-1, 1].map((sign) => {
      for (let away = STEP; away <= longest + 1; away += STEP) {
        const tile = {
          x: Math.round(center.x + sign * away * Math.cos(direction)),
          y: Math.round(center.y + sign * away * Math.sin(direction)),
        };
        if (!inside(tile)) {
          return undefined;
        }
        if (!wet(key(tile))) {
          return tile;
        }
      }
      return undefined;
    });
    if (!from || !to) {
      return undefined;
    }
    const length = Math.hypot(to.x - from.x, to.y - from.y) - 1;
    const tiles = traceTiles(from, to)
      .slice(1, -1)
      .filter((tile) => wet(key(tile)));
    return length > longest || tiles.length === 0 || tiles.some(onEdge)
      ? undefined
      : { from, to, tiles, length };
  };

  /** Numbers the pieces of land, which touch along edges, and measures them. */
  const label = () => {
    const labels = new Int32Array(water.length).fill(-1);
    const sizes: number[] = [];
    const land = (at: number) => cutting[at] !== 1 || !wet(at);
    for (let start = 0; start < water.length; ++start) {
      if (labels[start] !== -1 || !land(start)) {
        continue;
      }
      const piece = sizes.length;
      labels[start] = piece;
      let size = 0;
      const pending = [start];
      for (let at = pending.pop(); at !== undefined; at = pending.pop()) {
        ++size;
        const x = at % mapWidth;
        const y = Math.floor(at / mapWidth);
        for (const [dx, dy] of DIRECTIONS) {
          const next = (y + dy) * mapWidth + x + dx;
          if (
            inside({ x: x + dx, y: y + dy }) &&
            labels[next] === -1 &&
            land(next)
          ) {
            labels[next] = piece;
            pending.push(next);
          }
        }
      }
      sizes.push(size);
    }
    return { labels, sizes };
  };

  // join the large pieces of land, always by the shortest crossing there is
  for (;;) {
    const { labels, sizes } = label();
    const large = (tile: Point) =>
      (sizes[labels[key(tile)] ?? -1] ?? 0) >= MIN_PIECE;
    if (sizes.filter((size) => size >= MIN_PIECE).length <= 1) {
      break;
    }
    const joins = (found: Crossing | undefined): found is Crossing =>
      !!found &&
      labels[key(found.from)] !== labels[key(found.to)] &&
      large(found.from) &&
      large(found.to);
    // square across a stream that cuts the land, or nearly
    const options = centers
      .filter(({ width }) => width >= 2)
      .flatMap(({ tile, width, across }) =>
        SKEWS.map((skew) =>
          crossing(tile, across + (skew * Math.PI) / 180, width + MARGIN),
        ),
      )
      .filter(joins);
    const shortest = Math.min(...options.map(({ length }) => length));
    const best = options.filter(({ length }) => length <= shortest + 1e-9);
    const pick = best[randomInt(random, 0, best.length - 1)];
    if (!pick) {
      break;
    }
    for (const tile of pick.tiles) {
      foot[key(tile)] = 1;
    }
  }

  // more footbridges, up to the minimum, each across a stream at a place
  // away from the bridges that are there
  const bridged = () => {
    const both = Uint8Array.from(roads, (tile, at) => tile | (foot[at] ?? 0));
    return findBridges(water, both, mapWidth, mapHeight);
  };
  let bridges = bridged();
  for (
    let attempt = 0;
    attempt < ATTEMPTS && bridges.length < minimum && centers.length > 0;
    ++attempt
  ) {
    const pick = centers[randomInt(random, 0, centers.length - 1)];
    if (
      !pick ||
      bridges.some(
        ({ x, y }) =>
          Math.max(Math.abs(x - pick.tile.x), Math.abs(y - pick.tile.y)) <
          BRIDGE_GAP,
      )
    ) {
      continue;
    }
    const found = crossing(pick.tile, pick.across, pick.width + MARGIN);
    if (!found) {
      continue;
    }
    for (const tile of found.tiles) {
      foot[key(tile)] = 1;
    }
    bridges = bridged();
  }
  return foot;
}
