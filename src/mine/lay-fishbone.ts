import { DIRECTIONS } from '../core/directions';
import type { Grid } from '../core/grid';
import type { Point } from '../core/point';
import type { Random } from '../core/random';
import { randomInt } from '../core/random-int';
import type { Range } from '../core/range';
import { Tile } from '../core/tile';
import type { NoiseFunction } from '../noise/noise-function';
import { brushOffsets } from '../roads/brush-offsets';
import { carvePassageTiles } from '../veins/carve-passage-tiles';
import type { MinePassage } from '../veins/mine-passage';
import { tracePassage } from '../veins/trace-passage';
import { carveCornerGaps } from './carve-corner-gaps';
import { planCrosscut } from './plan-crosscut';

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
  /** The angle in whole degrees between the ribs and the forward direction of the shaft, picked once per mine. */
  branchAngle: Range;
  /** The most, in whole degrees, that an adit's starting heading turns away from the line of its side, either way. */
  aditSpread: number;
  /** The chance, from 0 to 1, that two neighboring adits on the same side of the shaft are joined by a crosscut. */
  crosscuts: number;
  /** The lane of the noise for the main shaft, and the first of the lanes of the adits after it. Defaults to 0.5. */
  lane?: number;
  /** Tiles that are never dug, a byte for each tile of the grid, row by row: anything but 0 protects it. Defaults to none. */
  protect?: Uint8Array;
}

/** The index of the main shaft among the passages, the tunnel that every adit leaves. */
const SHAFT = 0;

const radians = (degrees: number) => (degrees * Math.PI) / 180;

/** Lists the offsets within `by` tiles of any of the given ones, diagonals included, each once. */
function growOffsets(offsets: readonly Point[], by: number): Point[] {
  const grown = new Map<string, Point>();
  for (const { x, y } of offsets) {
    for (let dy = -by; dy <= by; ++dy) {
      for (let dx = -by; dx <= by; ++dx) {
        grown.set(`${String(x + dx)},${String(y + dy)}`, {
          x: x + dx,
          y: y + dy,
        });
      }
    }
  }
  return [...grown.values()];
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
 * Plans an adit that leaves the shaft at the tile `from`, heading in the given
 * direction (in radians), without carving it. It stops short of another
 * tunnel, with a wall between them, and at the outer rings of the map. An
 * adit that ends up shorter than the minimum length is dropped.
 */
function planAdit(
  grid: Grid,
  random: Random,
  noise: NoiseFunction,
  owner: Int32Array,
  from: Point,
  heading: number,
  lane: number,
  settings: FishboneSettings,
): { tiles: Point[]; width: number } | undefined {
  const { aditWidth, aditWindiness, aditLength } = settings;
  const width = randomInt(random, aditWidth.min, aditWidth.max);
  const traced = tracePassage(grid.width, grid.height, noise, {
    from,
    angle: heading,
    length: randomInt(random, aditLength.min, aditLength.max),
    width,
    windiness: aditWindiness,
    lane,
  });

  const body = brushOffsets(width);
  // every tile within MARGIN of the body, corners included, so that no other
  // tunnel touches the adit even at a corner
  const clearance = growOffsets(body, MARGIN);
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
  // At its start the adit is bound to touch the tunnel that it leaves, and
  // that tunnel only counts as an obstacle once the adit has pulled clear of it.
  let separated = false;
  let keep = traced.length;
  for (let i = 1; i < traced.length; ++i) {
    const tile = traced[i];
    if (!tile || !fits(tile)) {
      keep = i;
      break;
    }
    separated ||= !touches(tile, clearance);
    const ignored = separated ? undefined : SHAFT;
    if (touches(tile, clearance, ignored)) {
      keep = i;
      break;
    }
  }
  if (!separated || keep < aditLength.min) {
    return undefined;
  }
  const tiles = traced.slice(0, keep);
  // a dead end touches the mine in one place only, or it would close a loop
  const contact = findContact(grid, tiles, clearance);
  return isOneBlob(contact) ? { tiles, width } : undefined;
}

/**
 * Digs a fishbone mine into the grid and returns its tunnels, the main shaft
 * first. The main shaft runs through a point near the middle of the map, in
 * both directions, and then adits are dug off random tiles of the shaft, one
 * after the other, until the density is reached or no more fit. The ribs are
 * a herringbone: one rib angle and one forward direction of the shaft are
 * picked for the mine, the adits on one side follow the forward direction
 * turned by the rib angle one way and those on the other side turned the
 * other way, each turned further by up to `aditSpread`. Every adit starts on
 * the shaft, so the mine is one piece. Last, each pair of neighboring adits on
 * one side, in their order along the shaft, is joined by a crosscut with the
 * chance `crosscuts`, listed after the adits. Where two tunnels meet at a
 * corner gap, the tip of the rock between them is dug out.
 */
export function layFishbone(
  grid: Grid,
  random: Random,
  noise: NoiseFunction,
  settings: FishboneSettings,
): MinePassage[] {
  const { width: mapWidth, height: mapHeight } = grid;
  const firstLane = settings.lane ?? 0.5;
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
    lane: firstLane,
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
  let floor = carvePassageTiles(
    grid,
    shaft,
    shaftWidth,
    MARGIN,
    claim(SHAFT),
    settings.protect,
  );
  const passages: MinePassage[] = [
    { kind: 'shaft', tiles: shaft, width: shaftWidth },
  ];
  // the tiles of the shaft that an adit can leave from, clear of the outer rings
  const anchors = shaft.filter(inside);
  // the ribs lean towards one end of the shaft, mirrored on its two sides
  const forward = radians(settings.angle) + (random() < 0.5 ? 0 : Math.PI);
  const rib = radians(
    randomInt(random, settings.branchAngle.min, settings.branchAngle.max),
  );
  const spread = settings.aditSpread;
  /** The adits dug: the side of the shaft each was meant for, where on the shaft it starts and its passage. */
  const ribs: { side: number; anchor: number; passage: number }[] = [];

  const target = settings.density * mapWidth * mapHeight;
  for (
    let failures = 0;
    floor < target && failures < MAX_FAILURES && anchors.length > 0;
  ) {
    const side = random() < 0.5 ? 1 : -1;
    const heading =
      forward + side * rib + radians(randomInt(random, -spread, spread));
    const anchor = randomInt(random, 0, anchors.length - 1);
    const adit = planAdit(
      grid,
      random,
      noise,
      owner,
      anchors[anchor] ?? origin,
      heading,
      firstLane + passages.length * LANE_SPACING,
      settings,
    );
    const carved = adit
      ? carvePassageTiles(
          grid,
          adit.tiles,
          adit.width,
          MARGIN,
          claim(passages.length),
          settings.protect,
        )
      : 0;
    if (!adit || carved === 0) {
      ++failures;
      continue;
    }
    failures = 0;
    floor += carved;
    ribs.push({ side, anchor, passage: passages.length });
    passages.push({ kind: 'adit', ...adit });
  }

  for (const side of [1, -1]) {
    const row = ribs
      .filter((rib) => rib.side === side)
      .sort((a, b) => a.anchor - b.anchor);
    for (let i = 1; i < row.length; ++i) {
      const [one, other] = [row[i - 1], row[i]];
      if (!one || !other || random() >= settings.crosscuts) {
        continue;
      }
      const end = ({ passage }: { passage: number }) => ({
        tiles: passages[passage]?.tiles ?? [],
        passage,
      });
      const tiles = planCrosscut(
        grid,
        random,
        owner,
        end(one),
        end(other),
        MARGIN,
        settings.protect,
      );
      if (tiles) {
        carvePassageTiles(
          grid,
          tiles,
          1,
          MARGIN,
          claim(passages.length),
          settings.protect,
        );
        passages.push({ kind: 'crosscut', tiles, width: 1 });
      }
    }
  }

  carveCornerGaps(
    grid,
    (x, y) => (owner[y * mapWidth + x] ?? -1) >= 0,
    (x, y) =>
      inside({ x, y }) && (settings.protect?.[y * mapWidth + x] ?? 0) === 0,
  );
  return passages;
}
