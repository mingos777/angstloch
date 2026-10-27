import type { LaidStreams } from './laid-streams';
import type { StreamTerrain } from './stream-terrain';

/** How many tiles of a centerline before and after a tile tell which way the stream runs there. */
const LEAD = 3;

/** Works out the terrain of the streams that the roads are planned on. */
export function createStreamTerrain(streams: LaidStreams): StreamTerrain {
  const { mapWidth, mapHeight } = streams.map;
  const { water } = streams;
  const key = (x: number, y: number) => y * mapWidth + x;

  const centers: StreamTerrain['centers'] = [];
  const seen = new Set<number>();
  for (const [stream, { points, width }] of streams.map.roads.entries()) {
    points.forEach((tile, index) => {
      if (!seen.has(key(tile.x, tile.y))) {
        seen.add(key(tile.x, tile.y));
        const before = points[Math.max(0, index - LEAD)] ?? tile;
        const after = points[Math.min(points.length - 1, index + LEAD)] ?? tile;
        centers.push({
          x: tile.x,
          y: tile.y,
          heading: Math.atan2(after.y - before.y, after.x - before.x),
          stream,
          width,
        });
      }
    });
  }

  // the pieces of land the water cuts the map into
  const pieces = new Int32Array(water.length).fill(-1);
  const sizes: number[] = [];
  for (let start = 0; start < water.length; ++start) {
    if (pieces[start] !== -1 || water[start] === 1) {
      continue;
    }
    const piece = sizes.length;
    pieces[start] = piece;
    let size = 0;
    const pending = [start];
    for (let at = pending.pop(); at !== undefined; at = pending.pop()) {
      ++size;
      const x = at % mapWidth;
      const y = Math.floor(at / mapWidth);
      for (const [nx, ny] of [
        [x - 1, y],
        [x + 1, y],
        [x, y - 1],
        [x, y + 1],
      ] as const) {
        const next = key(nx, ny);
        if (
          nx >= 0 &&
          ny >= 0 &&
          nx < mapWidth &&
          ny < mapHeight &&
          pieces[next] === -1 &&
          water[next] !== 1
        ) {
          pieces[next] = piece;
          pending.push(next);
        }
      }
    }
    sizes.push(size);
  }

  // which pieces lie across a band of water from which, along a row or a
  // column no longer than the widest stream allows
  const widest = Math.max(0, ...streams.map.roads.map(({ width }) => width));
  const neighbors = new Map<number, Set<number>>();
  const link = (one: number, other: number) => {
    neighbors.set(one, (neighbors.get(one) ?? new Set()).add(other));
    neighbors.set(other, (neighbors.get(other) ?? new Set()).add(one));
  };
  for (let at = 0; at < water.length; ++at) {
    const here = pieces[at] ?? -1;
    if (here === -1) {
      continue;
    }
    const x = at % mapWidth;
    const y = Math.floor(at / mapWidth);
    for (const [dx, dy] of [
      [1, 0],
      [0, 1],
    ] as const) {
      for (let step = 1; step <= widest + 2; ++step) {
        const nx = x + dx * step;
        const ny = y + dy * step;
        if (nx >= mapWidth || ny >= mapHeight) {
          break;
        }
        const there = pieces[key(nx, ny)] ?? -1;
        if (there === -1) {
          continue;
        }
        if (step > 1 && there !== here) {
          link(here, there);
        }
        break;
      }
    }
  }

  const verges = new Map<number, Uint8Array>();
  return {
    mapWidth,
    mapHeight,
    water,
    pieces,
    sizes,
    neighbors,
    centers,
    verge: (radius) => {
      const known = verges.get(radius);
      if (known) {
        return known;
      }
      // every tile a brush of the road could reach the water from, a square
      // a tile smaller than the radius, and round beyond that, so that a
      // road that goes round the verge bends smoothly
      const offsets: [number, number][] = [];
      for (let dy = -radius; dy <= radius; ++dy) {
        for (let dx = -radius; dx <= radius; ++dx) {
          if (
            Math.max(Math.abs(dx), Math.abs(dy)) <= radius - 1 ||
            Math.hypot(dx, dy) <= radius + 0.5
          ) {
            offsets.push([dx, dy]);
          }
        }
      }
      const grown = new Uint8Array(water.length);
      for (let at = 0; at < water.length; ++at) {
        if (water[at] !== 1) {
          continue;
        }
        const x = at % mapWidth;
        const y = Math.floor(at / mapWidth);
        for (const [dx, dy] of offsets) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx >= 0 && ny >= 0 && nx < mapWidth && ny < mapHeight) {
            grown[key(nx, ny)] = 1;
          }
        }
      }
      verges.set(radius, grown);
      return grown;
    },
  };
}
