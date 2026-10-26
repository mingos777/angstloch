import { DIRECTIONS } from '../core/directions';
import type { Grid } from '../core/grid';
import { pickRandom } from '../core/pick-random';
import type { Point } from '../core/point';
import type { Random } from '../core/random';
import { randomInt } from '../core/random-int';
import type { Range } from '../core/range';
import { Tile } from '../core/tile';
import type { NoiseFunction } from '../noise/noise-function';
import { brushOffsets } from '../roads/brush-offsets';
import { carvePassageTiles } from './carve-passage-tiles';
import type { MinePassage } from './mine-passage';
import { tracePassage } from './trace-passage';

/** The rings of the map that stay wall, so that the mine is closed in by rock. */
const MARGIN = 1;
/** How many adits in a row may fail before the generator decides that the map has no more room. */
const MAX_FAILURES = 100;
/** The distance between lanes of the noise, as for roads, so that passages bend differently. */
const LANE_SPACING = 7.31;

/** The settings of the fishbone layout, with every default filled in. */
export interface FishboneSettings {
  density: number;
  shaftWidth: Range;
  shaftWindiness: number;
  /** Direction of the main shaft in degrees. */
  angle: number;
  aditWidth: Range;
  aditWindiness: number;
  aditLength: Range;
  branchAngle: Range;
  loops: number;
}

/** A tile of a tunnel that an adit can leave from. */
interface Anchor {
  tile: Point;
  /** Direction of the tunnel there, in radians. */
  heading: number;
  /** The index of the tunnel that the tile belongs to. */
  passage: number;
}

const radians = (degrees: number) => (degrees * Math.PI) / 180;

/** The tiles of the tunnels that an adit can branch off, which are the ones clear of the outer rings. */
function findAnchors(
  grid: Grid,
  tiles: readonly Point[],
  passage: number,
): Anchor[] {
  const anchors: Anchor[] = [];
  tiles.forEach((tile, i) => {
    const before = tiles[Math.max(0, i - 2)] ?? tile;
    const after = tiles[Math.min(tiles.length - 1, i + 2)] ?? tile;
    const inside =
      tile.x >= MARGIN &&
      tile.y >= MARGIN &&
      tile.x < grid.width - MARGIN &&
      tile.y < grid.height - MARGIN;
    if (inside) {
      anchors.push({
        tile,
        heading: Math.atan2(after.y - before.y, after.x - before.x),
        passage,
      });
    }
  });
  return anchors;
}

/** Lists the floor tiles that are within reach of the tiles, at the offsets. */
function findContact(
  grid: Grid,
  tiles: readonly Point[],
  offsets: readonly Point[],
): Point[] {
  const found = new Map<number, Point>();
  for (const tile of tiles) {
    for (const offset of offsets) {
      const x = tile.x + offset.x;
      const y = tile.y + offset.y;
      if (grid.get(x, y) === Tile.Floor) {
        found.set(y * grid.width + x, { x, y });
      }
    }
  }
  return [...found.values()];
}

/** Whether the tiles form one group, where every tile touches another along an edge. */
function isOneBlob(tiles: readonly Point[]): boolean {
  const [first, ...rest] = tiles;
  if (!first) {
    return true;
  }
  const unvisited = new Set(
    rest.map(({ x, y }) => `${String(x)},${String(y)}`),
  );
  const queue = [first];
  for (let tile = queue.pop(); tile; tile = queue.pop()) {
    for (const { x, y } of DIRECTIONS) {
      const next = { x: tile.x + x, y: tile.y + y };
      if (unvisited.delete(`${String(next.x)},${String(next.y)}`)) {
        queue.push(next);
      }
    }
  }
  return unvisited.size === 0;
}

/**
 * Plans an adit that leaves a tunnel at the anchor, without carving it. It
 * stops short of another tunnel, with a wall between them, and breaks through
 * into it with the chance `loops`. It also stops at the outer rings of the map.
 * An adit that ends up shorter than the minimum length is dropped.
 */
function planAdit(
  grid: Grid,
  random: Random,
  noise: NoiseFunction,
  owner: Int32Array,
  anchor: Anchor,
  lane: number,
  settings: FishboneSettings,
): { tiles: Point[]; width: number } | undefined {
  const { aditWidth, aditWindiness, aditLength, branchAngle, loops } = settings;
  const width = randomInt(random, aditWidth.min, aditWidth.max);
  // along the tunnel or against it, to either side
  const heading =
    anchor.heading +
    (random() < 0.5 ? 0 : Math.PI) +
    (random() < 0.5 ? 1 : -1) *
      radians(randomInt(random, branchAngle.min, branchAngle.max));
  const traced = tracePassage(grid.width, grid.height, noise, {
    from: anchor.tile,
    angle: heading,
    length: randomInt(random, aditLength.min, aditLength.max),
    width,
    windiness: aditWindiness,
    lane,
  });

  const body = brushOffsets(width);
  const clearance = brushOffsets(width + 2 * MARGIN);
  /** Whether any tile around the given one, at the offsets, is floor, apart from the floor of the tunnel `ignored`. */
  const touches = (
    tile: Point,
    offsets: readonly Point[],
    ignored?: number,
  ): boolean =>
    offsets.some((offset) => {
      const x = tile.x + offset.x;
      const y = tile.y + offset.y;
      return (
        grid.get(x, y) === Tile.Floor && owner[y * grid.width + x] !== ignored
      );
    });
  const fits = ({ x, y }: Point) =>
    body.every(
      (offset) =>
        x + offset.x >= MARGIN &&
        y + offset.y >= MARGIN &&
        x + offset.x < grid.width - MARGIN &&
        y + offset.y < grid.height - MARGIN,
    );
  const breakThrough = (from: number, ignored?: number): number => {
    for (let j = from; j < traced.length; ++j) {
      const tile = traced[j];
      if (!tile || !fits(tile)) {
        break;
      }
      if (touches(tile, body, ignored)) {
        return j + 1;
      }
    }
    return from;
  };

  // At its start the adit is bound to touch the tunnel that it leaves, and
  // that tunnel only counts as an obstacle once the adit has pulled clear of it.
  let separated = false;
  let joined = false;
  let keep = traced.length;
  for (let i = 1; i < traced.length; ++i) {
    const tile = traced[i];
    if (!tile || !fits(tile)) {
      keep = i;
      break;
    }
    separated ||= !touches(tile, clearance);
    const ignored = separated ? undefined : anchor.passage;
    if (touches(tile, clearance, ignored)) {
      keep = loops > 0 && random() < loops ? breakThrough(i, ignored) : i;
      joined = keep > i;
      break;
    }
  }
  if (!separated || keep < aditLength.min) {
    return undefined;
  }
  const tiles = traced.slice(0, keep);
  // a dead end touches the mine in one place only, or it would close a loop
  const contact = findContact(grid, tiles, clearance);
  return joined || isOneBlob(contact) ? { tiles, width } : undefined;
}

/**
 * Digs a fishbone mine into the grid and returns its tunnels, the main shaft
 * first. The main shaft runs through a point near the middle of the map, in
 * both directions, and then adits are dug off random tiles of the tunnels
 * that exist, one after the other, until the density is reached or no more
 * fit. Every tunnel starts at an existing one, so the mine is one piece.
 */
export function layFishbone(
  grid: Grid,
  random: Random,
  noise: NoiseFunction,
  settings: FishboneSettings,
): MinePassage[] {
  const { width: mapWidth, height: mapHeight } = grid;
  const shaftWidth = randomInt(
    random,
    settings.shaftWidth.min,
    settings.shaftWidth.max,
  );
  const inside = ({ x, y }: Point) =>
    x >= MARGIN &&
    y >= MARGIN &&
    x < mapWidth - MARGIN &&
    y < mapHeight - MARGIN;
  const nearMiddle = (size: number) =>
    Math.max(
      MARGIN,
      Math.min(size - 1 - MARGIN, Math.floor(size * (0.25 + 0.5 * random()))),
    );
  const origin = { x: nearMiddle(mapWidth), y: nearMiddle(mapHeight) };
  const traced = tracePassage(mapWidth, mapHeight, noise, {
    from: origin,
    angle: radians(settings.angle),
    directions: [-1, 1],
    width: shaftWidth,
    windiness: settings.shaftWindiness,
    lane: 0.5,
  });
  // A winding shaft may leave the map and return. Only the stretch around
  // the origin is dug, which keeps the shaft in one piece.
  const at = traced.findIndex(
    (tile) => tile.x === origin.x && tile.y === origin.y,
  );
  let first = at;
  let last = at;
  if (at !== -1 && inside(origin)) {
    while (first > 0 && inside(traced[first - 1] ?? origin)) {
      --first;
    }
    while (last < traced.length - 1 && inside(traced[last + 1] ?? origin)) {
      ++last;
    }
  }
  const shaft = inside(origin) ? traced.slice(first, last + 1) : [];
  const owner = new Int32Array(mapWidth * mapHeight).fill(-1);
  const claim = (passage: number) => (x: number, y: number) => {
    owner[y * mapWidth + x] = passage;
  };
  let floor = carvePassageTiles(grid, shaft, shaftWidth, MARGIN, claim(0));
  const passages: MinePassage[] = [
    { kind: 'shaft', tiles: shaft, width: shaftWidth },
  ];
  const anchors = findAnchors(grid, shaft, 0);

  const target = settings.density * mapWidth * mapHeight;
  for (
    let failures = 0;
    floor < target && failures < MAX_FAILURES && anchors.length > 0;
  ) {
    const adit = planAdit(
      grid,
      random,
      noise,
      owner,
      pickRandom(random, anchors),
      0.5 + passages.length * LANE_SPACING,
      settings,
    );
    const carved = adit
      ? carvePassageTiles(
          grid,
          adit.tiles,
          adit.width,
          MARGIN,
          claim(passages.length),
        )
      : 0;
    if (!adit || carved === 0) {
      ++failures;
      continue;
    }
    failures = 0;
    floor += carved;
    anchors.push(...findAnchors(grid, adit.tiles, passages.length));
    passages.push({ kind: 'adit', ...adit });
  }
  return passages;
}
