import type { Grid } from '../core/grid';
import type { Point } from '../core/point';
import type { Random } from '../core/random';
import { randomInt } from '../core/random-int';
import type { Range } from '../core/range';
import type { NoiseFunction } from '../noise/noise-function';
import { joinTiles } from '../roads/join-tiles';
import { carvePassageTiles } from './carve-passage-tiles';
import { digVein, keepInside, LANE_SPACING, MARGIN } from './dig-vein';
import type { MinePassage } from './mine-passage';
import type { MineRingShape } from './mine-ring-shape';

/** The smallest radius of a ring, in tiles. A ring any smaller is left out. */
const MIN_RADIUS = 3;
/** The most rings that a mine gets when their number comes from the density. */
const MAX_RINGS = 10;
/** The walls that stay between two rings at least, beside the width of the rings. */
const MIN_GAP = 2;
/** How far a ring can wobble, as a share of the distance between rings, at a wobble of 1. */
const MAX_WOBBLE = 0.25;
/** How fast the wobble changes round a ring. A larger value makes more bumps. */
const WOBBLE_FREQUENCY = 1.5;

/** The settings of the rings layout, with every default filled in. */
export interface RingsSettings {
  density: number;
  rings?: Range;
  ringShape: MineRingShape;
  ringWidth: Range;
  ringWobble: number;
  spokes: Range;
  veinWidth: Range;
  veinWindiness: number;
}

/** The ovals that the rings follow: the middle of the map, and the radii of the outermost ring. */
interface Frame {
  center: Point;
  radiusX: number;
  radiusY: number;
}

/** The length of an oval, by Ramanujan's approximation. */
function perimeter(radiusX: number, radiusY: number): number {
  return (
    Math.PI *
    (3 * (radiusX + radiusY) -
      Math.sqrt((3 * radiusX + radiusY) * (radiusX + 3 * radiusY)))
  );
}

/**
 * Picks how many rings to dig: the count from the range, or the count whose
 * rings come closest to filling the density when there is no range. At most
 * as many as have room for their width and a gap.
 */
function pickCount(
  random: Random,
  frame: Frame,
  settings: RingsSettings,
  widest: number,
): number {
  const room = Math.floor(
    Math.min(frame.radiusX, frame.radiusY) / (widest + MIN_GAP),
  );
  const fits = Math.max(
    0,
    Math.min(
      room,
      Math.floor(Math.min(frame.radiusX, frame.radiusY) / MIN_RADIUS),
    ),
  );
  if (settings.rings) {
    return Math.min(
      fits,
      randomInt(random, settings.rings.min, settings.rings.max),
    );
  }
  const target = settings.density * 4 * (frame.center.x * frame.center.y);
  const width = (settings.ringWidth.min + settings.ringWidth.max) / 2;
  let best = Math.min(1, fits);
  let bestMiss = Infinity;
  for (let n = 1; n <= Math.min(fits, MAX_RINGS); ++n) {
    let floor = 0;
    for (let i = 1; i <= n; ++i) {
      floor += (perimeter(frame.radiusX, frame.radiusY) * i * width) / n;
    }
    const miss = Math.abs(floor - target);
    if (miss < bestMiss) {
      best = n;
      bestMiss = miss;
    }
  }
  return best;
}

/**
 * Digs concentric rings into the grid and returns them with the spokes that
 * join them. The rings are ovals around the middle of the map, evenly spaced,
 * the outermost one near the border, and each wobbles by smooth noise so that
 * it is not perfect. Between every ring and the next, at least one spoke runs
 * at a random angle, which makes the mine one piece.
 */
export function layRings(
  grid: Grid,
  random: Random,
  noise: NoiseFunction,
  settings: RingsSettings,
): MinePassage[] {
  const { ringShape, ringWidth, ringWobble, spokes, veinWidth, veinWindiness } =
    settings;
  const halfWidth = (grid.width - 2 * MARGIN) / 2;
  const halfHeight = (grid.height - 2 * MARGIN) / 2;
  const fitX = halfWidth - ringWidth.max / 2 - MARGIN;
  const fitY = halfHeight - ringWidth.max / 2 - MARGIN;
  // a circle is as large as the shorter side allows, round the same center
  const round = Math.min(fitX, fitY);
  const frame: Frame = {
    center: { x: MARGIN + halfWidth, y: MARGIN + halfHeight },
    radiusX: ringShape === 'circle' ? round : fitX,
    radiusY: ringShape === 'circle' ? round : fitY,
  };
  const passages: MinePassage[] = [];
  if (frame.radiusX < MIN_RADIUS || frame.radiusY < MIN_RADIUS) {
    return passages;
  }
  const count = pickCount(random, frame, settings, ringWidth.max);
  const spacing = Math.min(frame.radiusX, frame.radiusY) / count;
  const reach = ringWobble * MAX_WOBBLE * spacing;

  /** The point of a ring at an angle, in tile units. */
  const ringPoint = (ring: number, angle: number): Point => {
    const share = (ring + 1) / count;
    const wobble =
      reach *
      noise(
        Math.cos(angle) * WOBBLE_FREQUENCY + ring * 5.17,
        Math.sin(angle) * WOBBLE_FREQUENCY + ring * 2.71,
      );
    return {
      x: frame.center.x + (frame.radiusX * share + wobble) * Math.cos(angle),
      y: frame.center.y + (frame.radiusY * share + wobble) * Math.sin(angle),
    };
  };

  for (let ring = 0; ring < count; ++ring) {
    const width = randomInt(random, ringWidth.min, ringWidth.max);
    const steps = Math.ceil(
      2 * perimeter(frame.radiusX, frame.radiusY) * ((ring + 1) / count),
    );
    const points: Point[] = [];
    for (let step = 0; step <= steps; ++step) {
      points.push(ringPoint(ring, (2 * Math.PI * step) / steps));
    }
    // the last tile is the first again, which closes the loop
    const first = points[0];
    const tiles = keepInside(
      grid,
      joinTiles(first ? [...points, first] : points),
    );
    carvePassageTiles(grid, tiles, width, MARGIN);
    passages.push({ kind: 'ring', tiles, width });
  }

  for (let ring = 0; ring + 1 < count; ++ring) {
    const wanted = Math.max(1, randomInt(random, spokes.min, spokes.max));
    const start = 2 * Math.PI * random();
    for (let spoke = 0; spoke < wanted; ++spoke) {
      // spread the spokes evenly round the ring, with a little shuffling
      const angle =
        start + (2 * Math.PI * (spoke + 0.6 * (random() - 0.5))) / wanted;
      const vein = digVein(
        grid,
        random,
        noise,
        [
          toTile(grid, ringPoint(ring, angle)),
          toTile(grid, ringPoint(ring + 1, angle)),
        ],
        { from: 0, to: 1, length: spacing },
        { width: veinWidth, windiness: veinWindiness },
        0.5 + passages.length * LANE_SPACING,
      );
      if (vein) {
        passages.push({ ...vein.passage, kind: 'spoke' });
      }
    }
  }
  return passages;
}

/** The tile that holds a point, kept inside the outer rings of the grid. */
function toTile(grid: Grid, point: Point): Point {
  return {
    x: Math.min(Math.max(Math.floor(point.x), MARGIN), grid.width - 1 - MARGIN),
    y: Math.min(
      Math.max(Math.floor(point.y), MARGIN),
      grid.height - 1 - MARGIN,
    ),
  };
}
