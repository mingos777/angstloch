import { generateNoiseCave } from '../cave/generate-noise-cave';
import { DIRECTIONS } from '../core/directions';
import type { Area } from '../core/area';
import type { Grid } from '../core/grid';
import type { Point } from '../core/point';
import type { Random } from '../core/random';
import { randomInt } from '../core/random-int';
import type { Range } from '../core/range';
import { Tile } from '../core/tile';
import type { NoiseFunction } from '../noise/noise-function';
import { carvePassageTiles } from './carve-passage-tiles';
import { keepInside, LANE_SPACING, MARGIN } from './dig-vein';
import type { MinePassage } from './mine-passage';
import { tracePassage } from './trace-passage';

/** How many places to try for a cavern, of which the one nearest the mine is used. */
const ATTEMPTS = 20;

/** The settings of the caverns, with every default filled in. */
export interface CavernSettings {
  caverns: Range;
  cavernSize: Range;
  cavernFill: number;
  veinWidth: Range;
  veinWindiness: number;
}

/**
 * For every tile, how far it is from the nearest floor tile, going by steps
 * along edges, and which floor tile that is. Floor is at a distance of 0.
 */
function measureFloorDistance(grid: Grid): {
  distance: Int32Array;
  nearest: Int32Array;
} {
  const { width, height } = grid;
  const distance = new Int32Array(width * height).fill(-1);
  const nearest = new Int32Array(width * height).fill(-1);
  const queue: number[] = [];
  for (let y = 0; y < height; ++y) {
    for (let x = 0; x < width; ++x) {
      if (grid.get(x, y) === Tile.Floor) {
        distance[y * width + x] = 0;
        nearest[y * width + x] = y * width + x;
        queue.push(y * width + x);
      }
    }
  }
  for (let head = 0; head < queue.length; ++head) {
    const at = queue[head] ?? 0;
    const x = at % width;
    const y = Math.floor(at / width);
    for (const step of DIRECTIONS) {
      const nx = x + step.x;
      const ny = y + step.y;
      const next = ny * width + nx;
      if (grid.inBounds(nx, ny) && distance[next] === -1) {
        distance[next] = (distance[at] ?? 0) + 1;
        nearest[next] = nearest[at] ?? -1;
        queue.push(next);
      }
    }
  }
  return { distance, nearest };
}

/** The floor tiles of a cavern, in its own coordinates. */
function cavernTiles(
  random: Random,
  width: number,
  height: number,
  fill: number,
): Point[] {
  const { grid } = generateNoiseCave({
    width,
    height,
    random,
    fill,
    connect: 'largest',
    scaleX: Math.max(4, Math.round(width / 2.5)),
    scaleY: Math.max(4, Math.round(height / 2.5)),
  });
  const tiles: Point[] = [];
  for (let y = 0; y < height; ++y) {
    for (let x = 0; x < width; ++x) {
      if (grid.get(x, y) === Tile.Floor) {
        tiles.push({ x, y });
      }
    }
  }
  return tiles;
}

/**
 * Digs caverns into the rock of a finished mine: blobs of floor made by the
 * noise cave generator, each placed where it touches none of the mine, as
 * near it as it can find. A cavern that does not touch the mine is joined to
 * it by a short winding tunnel. A cavern that finds no room is left out.
 * Returns the bounds of the caverns and the tunnels that join them.
 */
export function layCaverns(
  grid: Grid,
  random: Random,
  noise: NoiseFunction,
  settings: CavernSettings,
  lane: number,
): { areas: Area[]; passages: MinePassage[] } {
  const { caverns, cavernSize, cavernFill, veinWidth, veinWindiness } =
    settings;
  const areas: Area[] = [];
  const passages: MinePassage[] = [];
  const count = randomInt(random, caverns.min, caverns.max);
  const interiorWidth = grid.width - 2 * MARGIN;
  const interiorHeight = grid.height - 2 * MARGIN;
  for (let n = 0; n < count; ++n) {
    const width = Math.min(
      interiorWidth,
      randomInt(random, cavernSize.min, cavernSize.max),
    );
    const height = Math.min(
      interiorHeight,
      randomInt(random, cavernSize.min, cavernSize.max),
    );
    if (width < 1 || height < 1) {
      break;
    }
    const tiles = cavernTiles(random, width, height, cavernFill);
    const { distance, nearest } = measureFloorDistance(grid);
    if (tiles.length === 0 || !distance.some((value) => value === 0)) {
      continue;
    }

    // of the places tried, the one nearest the mine that touches none of it
    let best: { area: Area; link: number; from: Point } | undefined;
    for (let attempt = 0; attempt < ATTEMPTS; ++attempt) {
      const area = {
        x: MARGIN + randomInt(random, 0, interiorWidth - width),
        y: MARGIN + randomInt(random, 0, interiorHeight - height),
        width,
        height,
      };
      let link = Infinity;
      let from: Point | undefined;
      let overlaps = false;
      for (const tile of tiles) {
        const x = area.x + tile.x;
        const y = area.y + tile.y;
        const gap = distance[y * grid.width + x] ?? Infinity;
        if (gap === 0) {
          overlaps = true;
          break;
        }
        if (gap < link) {
          link = gap;
          from = { x, y };
        }
      }
      if (!overlaps && from && (!best || link < best.link)) {
        best = { area, link, from };
      }
    }
    if (!best) {
      continue;
    }

    for (const tile of tiles) {
      grid.set(best.area.x + tile.x, best.area.y + tile.y, Tile.Floor);
    }
    areas.push(best.area);
    const target = nearest[best.from.y * grid.width + best.from.x] ?? -1;
    if (best.link > 1 && target !== -1) {
      const width = randomInt(random, veinWidth.min, veinWidth.max);
      const path = keepInside(
        grid,
        tracePassage(grid.width, grid.height, noise, {
          from: best.from,
          to: { x: target % grid.width, y: Math.floor(target / grid.width) },
          width,
          windiness: veinWindiness,
          lane: lane + passages.length * LANE_SPACING,
        }),
      );
      carvePassageTiles(grid, path, width, MARGIN);
      passages.push({ kind: 'tunnel', tiles: path, width });
    }
  }
  return { areas, passages };
}
