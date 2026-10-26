import type { Point } from '../core/point';
import type { Random } from '../core/random';
import { randomInt } from '../core/random-int';
import { findBridges } from './find-bridges';
import type { LaidStreams } from './laid-streams';

/** Tiles that a footbridge is kept from the bridges that are there already, along a row or a column. */
const BRIDGE_GAP = 8;
const ATTEMPTS = 50;
/** How many tiles longer than the stream a footbridge may be, which lets it start and end on the bank. */
const MARGIN = 2;

const DIRECTIONS = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
] as const;

/**
 * Lays footbridges across the water, straight and one tile wide, along a row
 * or a column. First it joins the pieces of land that the water cuts apart,
 * the nearest pieces first and by the shortest crossing, so that the land is
 * one piece, which counts the tiles of a road as land as well as the bridges
 * of roads. Then it adds footbridges until the map has `minimum` bridges
 * altogether, each across a stream away from the bridges there. None lies
 * on the edge of the map. `crossed`
 * marks the tiles of the roads. Returns one byte per tile, row by row, 1
 * where a footbridge lies. A stream that never cuts the land and has no room
 * for another bridge gets none.
 */
export function layFootbridges(
  streams: LaidStreams,
  crossed: Uint8Array | undefined,
  random: Random,
  minimum: number,
): Uint8Array {
  const { mapWidth, mapHeight } = streams.map;
  const { water } = streams;
  const roads = crossed ?? new Uint8Array(water.length);
  const foot = new Uint8Array(water.length);
  const inside = (x: number, y: number) =>
    x >= 0 && y >= 0 && x < mapWidth && y < mapHeight;
  // a footbridge never lies on the edge of the map, where the water leaves it
  const onEdge = ({ x, y }: Point) =>
    x === 0 || y === 0 || x === mapWidth - 1 || y === mapHeight - 1;
  const isWater = (at: number) =>
    water[at] === 1 && roads[at] !== 1 && foot[at] !== 1;

  /** Numbers the pieces of land, which touch along edges, and counts them. */
  const label = () => {
    const labels = new Int32Array(water.length).fill(-1);
    let count = 0;
    for (let start = 0; start < water.length; ++start) {
      if (labels[start] !== -1 || isWater(start)) {
        continue;
      }
      labels[start] = count;
      const pending = [start];
      for (let at = pending.pop(); at !== undefined; at = pending.pop()) {
        const x = at % mapWidth;
        const y = Math.floor(at / mapWidth);
        for (const [dx, dy] of DIRECTIONS) {
          const next = (y + dy) * mapWidth + x + dx;
          if (inside(x + dx, y + dy) && labels[next] === -1 && !isWater(next)) {
            labels[next] = count;
            pending.push(next);
          }
        }
      }
      ++count;
    }
    return { labels, count };
  };

  // join the pieces of land, always by the shortest crossing there is
  for (;;) {
    const { labels, count } = label();
    if (count <= 1) {
      break;
    }
    let best: Point[][] = [];
    let shortest = Infinity;
    for (let at = 0; at < water.length; ++at) {
      const piece = labels[at] ?? -1;
      if (piece === -1) {
        continue;
      }
      const x = at % mapWidth;
      const y = Math.floor(at / mapWidth);
      for (const [dx, dy] of DIRECTIONS) {
        const span: Point[] = [];
        let nx = x + dx;
        let ny = y + dy;
        while (inside(nx, ny) && isWater(ny * mapWidth + nx)) {
          span.push({ x: nx, y: ny });
          nx += dx;
          ny += dy;
        }
        const other = inside(nx, ny) ? (labels[ny * mapWidth + nx] ?? -1) : -1;
        if (
          span.length === 0 ||
          other === -1 ||
          other === piece ||
          span.some(onEdge)
        ) {
          continue;
        }
        if (span.length < shortest) {
          shortest = span.length;
          best = [];
        }
        if (span.length === shortest) {
          best.push(span);
        }
      }
    }
    const span = best[randomInt(random, 0, best.length - 1)];
    if (!span) {
      break;
    }
    for (const { x, y } of span) {
      foot[y * mapWidth + x] = 1;
    }
  }

  // more footbridges, up to the minimum, each across a stream at a place
  // away from the bridges that are there
  const centers = streams.map.roads.flatMap(({ points, width }) =>
    points.map((tile, index) => ({
      tile,
      width,
      before: points[Math.max(0, index - 3)] ?? tile,
      after: points[Math.min(points.length - 1, index + 3)] ?? tile,
    })),
  );
  const bridged = () => {
    const both = Uint8Array.from(roads, (tile, at) => tile | (foot[at] ?? 0));
    return findBridges(water, both, mapWidth, mapHeight);
  };
  let bridges = bridged();
  for (
    let attempt = 0;
    attempt < ATTEMPTS && bridges.length < minimum;
    ++attempt
  ) {
    const pick = centers[randomInt(random, 0, centers.length - 1)];
    if (!pick) {
      break;
    }
    const { tile, width, before, after } = pick;
    if (
      bridges.some(
        ({ x, y }) =>
          Math.max(Math.abs(x - tile.x), Math.abs(y - tile.y)) < BRIDGE_GAP,
      )
    ) {
      continue;
    }
    // across the stream, along the row or column that is nearer to square with it
    const along = Math.abs(after.x - before.x) >= Math.abs(after.y - before.y);
    const [dx, dy] = along ? [0, 1] : [1, 0];
    const span: Point[] = [tile];
    let spans = true;
    for (const sign of [-1, 1]) {
      let nx = tile.x + sign * dx;
      let ny = tile.y + sign * dy;
      while (inside(nx, ny) && water[ny * mapWidth + nx] === 1) {
        span.push({ x: nx, y: ny });
        nx += sign * dx;
        ny += sign * dy;
      }
      spans &&= inside(nx, ny);
    }
    // a bridge goes across a stream, not along it where two streams meet
    if (
      !spans ||
      span.some(onEdge) ||
      span.length > width + MARGIN ||
      span.some(({ x, y }) => !isWater(y * mapWidth + x))
    ) {
      continue;
    }
    for (const { x, y } of span) {
      foot[y * mapWidth + x] = 1;
    }
    bridges = bridged();
  }
  return foot;
}
