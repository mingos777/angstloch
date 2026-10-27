/**
 * Scores forests with roads and streams for the artifacts listed in the
 * roadmap, over many seeds, so that a fix can be measured before and after.
 * Run with `npm run check:forest`, and add flags after `--`:
 *
 * - `--from 1 --to 200`: the seeds to check (1 to 200 by default),
 * - `--seeds 6,9,14`: these seeds instead,
 * - `--tributaries 2`: the number of tributaries (2 by default),
 * - `--show`: print the map of every seed that has an artifact, with the
 *   road as it was grown drawn as `o` where it differs from the laid road.
 *
 * The forest is the playground's, at 80 by 50 with its defaults, Road and
 * Stream checked.
 */
import { Tile } from '../src';
import type { ForestOptions, ForestResult, Grid, Point } from '../src';
import { buildForest } from '../src/forest/build-forest';
import { brushOffsets } from '../src/roads/brush-offsets';
import { sharpestTurn } from '../src/roads/sharpest-turn';
import { mulberry32 } from '../src/test-helpers/mulberry32';

declare const process: { argv: string[] };

/** The sharpest turn a road may take, in degrees, as `sharpestTurn` measures it. Calibrated on seeds 1 to 100: roads as grown turn 39° at most, and every seed the user flagged for a sharp turn 48° or more. */
const TURN_LIMIT = 45;
/** How many tiles of road, in multiples of its width and one more, before it may not come back within its width of itself: a road that keeps its heading is farther away by then. */
const DOUBLE_SPAN = 2;
/** How many centerline tiles in a row may run on land with the brush on water before a road counts as running along a bank. Calibrated on seeds 1 to 100, where every seed the user flagged has 4 or more. */
const GRAZE = 4;
/** How many centerline tiles in a row may run within `EDGE_REACH` tiles of the border before a road counts as running along the edge of the map. */
const EDGE_RUN = 12;
const EDGE_REACH = 1;
/** How far past its end a road or stream is continued, to see whether its end is square, and how many tiles back from the end tell its direction. */
const PAST = 3;
const END_SPAN = 6;
/** How many tiles may be missing from an end before it counts as square. */
const SQUARE = 2;

function flag(name: string): string | undefined {
  const at = process.argv.indexOf(`--${name}`);
  return at === -1 ? undefined : process.argv[at + 1];
}

function seedList(): number[] {
  const listed = flag('seeds');
  if (listed !== undefined) {
    return listed.split(',').map(Number);
  }
  const from = Number(flag('from') ?? 1);
  const to = Number(flag('to') ?? 200);
  return Array.from({ length: to - from + 1 }, (_, index) => from + index);
}

function options(seed: number): ForestOptions {
  const tributaries = Number(flag('tributaries') ?? 2);
  return {
    width: 80,
    height: 50,
    random: mulberry32(seed),
    streams: {
      angle: 'random',
      width: { min: 3, max: 3 },
      windiness: 0.5,
      shoreWidth: 1,
      spring: false,
      bridges: 0,
      tributaries: { min: tributaries, max: tributaries },
      tributaryWidth: { min: 1, max: 1 },
      tributaryAngle: { min: 30, max: 60 },
      bridgeAngle: { min: 75, max: 90 },
    },
    roads: {
      angle: 'random',
      width: { min: 3, max: 3 },
      windiness: 0.3,
      crossings: { min: 0, max: 0 },
      crossingAngle: { min: 45, max: 90 },
      branches: { min: 0, max: 0 },
      branchWidth: { min: 1, max: 1 },
      branchAngle: { min: 20, max: 70 },
    },
  };
}

const isWater = (tile: Tile) =>
  tile === Tile.ShallowWater || tile === Tile.DeepWater || tile === Tile.Bridge;

/** The tiles a brush of the width covers around each of the points, on the map. */
function cover(grid: Grid, points: Point[], width: number): Set<number> {
  const tiles = new Set<number>();
  for (const { x, y } of points) {
    for (const offset of brushOffsets(width)) {
      const tx = x + offset.x;
      const ty = y + offset.y;
      if (grid.inBounds(tx, ty)) {
        tiles.add(ty * grid.width + tx);
      }
    }
  }
  return tiles;
}

/** Whether a road comes back within its width of a part of itself it has passed. */
function doublesBack(points: Point[], width: number): boolean {
  return points.some((tile, at) =>
    points
      .slice(at + DOUBLE_SPAN * width + 1)
      .some((other) => Math.hypot(other.x - tile.x, other.y - tile.y) <= width),
  );
}

/**
 * How a road meets the water: `along` counts the runs of `GRAZE` or more
 * centerline tiles on land whose brush lies on water, where the road runs
 * along a bank instead of crossing (a clean crossing has a tile or two of
 * these at each bank), and `bitten` the road tiles over water that are not
 * a bridge, which gave way to the water.
 */
function wetness(
  grid: Grid,
  points: Point[],
  width: number,
): { along: number; bitten: number } {
  const wet = (x: number, y: number) =>
    grid.inBounds(x, y) && isWater(grid.get(x, y));
  let along = 0;
  let run = 0;
  for (const { x, y } of [...points, undefined].map(
    (tile) => tile ?? { x: -1, y: -1 },
  )) {
    const grazes =
      grid.inBounds(x, y) &&
      !wet(x, y) &&
      brushOffsets(width).some((offset) => wet(x + offset.x, y + offset.y));
    if (grazes) {
      ++run;
    } else {
      along += run >= GRAZE ? 1 : 0;
      run = 0;
    }
  }
  let bitten = 0;
  for (const at of cover(grid, points, width)) {
    const tile = grid.get(at % grid.width, Math.floor(at / grid.width));
    bitten += tile === Tile.ShallowWater || tile === Tile.DeepWater ? 1 : 0;
  }
  return { along, bitten };
}

/** Whether a road runs along the edge of the map for `EDGE_RUN` tiles or more. */
function alongEdge(grid: Grid, points: Point[]): boolean {
  let run = 0;
  for (const { x, y } of points) {
    const near =
      Math.min(x, y, grid.width - 1 - x, grid.height - 1 - y) <= EDGE_REACH;
    run = near ? run + 1 : 0;
    if (run >= EDGE_RUN) {
      return true;
    }
  }
  return false;
}

/** The groups of bridge tiles that no road covers, each as its tiles. */
function footbridges(grid: Grid, roads: Set<number>): Point[][] {
  const seen = new Set<number>();
  const groups: Point[][] = [];
  for (let start = 0; start < grid.width * grid.height; ++start) {
    const bridge = (at: number) =>
      !roads.has(at) &&
      grid.get(at % grid.width, Math.floor(at / grid.width)) === Tile.Bridge;
    if (seen.has(start) || !bridge(start)) {
      continue;
    }
    seen.add(start);
    const group = [start];
    for (let index = 0; index < group.length; ++index) {
      const at = group[index] ?? 0;
      const x = at % grid.width;
      const y = Math.floor(at / grid.width);
      for (const [nx, ny] of [
        [x - 1, y],
        [x + 1, y],
        [x, y - 1],
        [x, y + 1],
      ] as const) {
        const next = ny * grid.width + nx;
        if (grid.inBounds(nx, ny) && !seen.has(next) && bridge(next)) {
          seen.add(next);
          group.push(next);
        }
      }
    }
    groups.push(
      group.map((at) => ({
        x: at % grid.width,
        y: Math.floor(at / grid.width),
      })),
    );
  }
  return groups;
}

/** The length of a footbridge, from end to end. */
function span(tiles: Point[]): number {
  let longest = 0;
  for (const one of tiles) {
    for (const other of tiles) {
      longest = Math.max(longest, Math.hypot(one.x - other.x, one.y - other.y));
    }
  }
  return longest + 1;
}

/**
 * How many tiles on the map a road or stream would gain if it went on
 * `PAST` tiles beyond its end on the edge of the map, which is what makes
 * an end look square. Ends inside the map count 0.
 */
function missingAtEnds(
  grid: Grid,
  points: Point[],
  width: number,
  belongs: (tile: Tile) => boolean,
): number[] {
  return [points, [...points].reverse()].map((line) => {
    const end = line[line.length - 1];
    const back = line[Math.max(0, line.length - 1 - END_SPAN)];
    if (
      !end ||
      !back ||
      (end.x > 0 &&
        end.y > 0 &&
        end.x < grid.width - 1 &&
        end.y < grid.height - 1)
    ) {
      return 0;
    }
    const length = Math.hypot(end.x - back.x, end.y - back.y) || 1;
    // only the bits of the line off the map: on it, the road was laid already
    const beyond = Array.from({ length: PAST }, (_, step) => ({
      x: Math.round(end.x + ((step + 1) * (end.x - back.x)) / length),
      y: Math.round(end.y + ((step + 1) * (end.y - back.y)) / length),
    })).filter(({ x, y }) => !grid.inBounds(x, y));
    return [...cover(grid, beyond, width)].filter(
      (at) => !belongs(grid.get(at % grid.width, Math.floor(at / grid.width))),
    ).length;
  });
}

interface Score {
  seed: number;
  turn: number;
  grownTurn: number;
  doubling: boolean;
  edge: boolean;
  grownEdge: boolean;
  along: number;
  bitten: number;
  footbridges: number;
  longFootbridges: number;
  squareRoadEnds: number;
  squareStreamEnds: number;
}

function score(seed: number): {
  score: Score;
  result: ForestResult;
  grown: Point[][];
} {
  const grown: Point[][] = [];
  const result = buildForest(options(seed), {
    grown: (points) => grown.push(points),
  });
  const { grid, roads, streams } = result;
  const widest = Math.max(...streams.map(({ width }) => width));
  const covered = new Set(
    roads.flatMap(({ points, width }) => [...cover(grid, points, width)]),
  );
  const feet = footbridges(grid, covered);
  const wet = roads.map(({ points, width }) => wetness(grid, points, width));
  return {
    result,
    grown,
    score: {
      seed,
      turn: Math.max(0, ...roads.map(({ points }) => sharpestTurn(points))),
      grownTurn: Math.max(0, ...grown.map(sharpestTurn)),
      doubling: roads.some(({ points, width }) => doublesBack(points, width)),
      edge: roads.some(({ points }) => alongEdge(grid, points)),
      grownEdge: grown.some((points) => alongEdge(grid, points)),
      along: wet.reduce((sum, { along }) => sum + along, 0),
      bitten: wet.reduce((sum, { bitten }) => sum + bitten, 0),
      footbridges: feet.length,
      longFootbridges: feet.filter((tiles) => span(tiles) > widest + 3).length,
      squareRoadEnds: roads
        .flatMap(({ points, width }) =>
          missingAtEnds(
            grid,
            points,
            width,
            (tile) => tile === Tile.Road || tile === Tile.Bridge,
          ),
        )
        .filter((missing) => missing >= SQUARE).length,
      squareStreamEnds: streams
        .filter(({ width }) => width > 1)
        .flatMap(({ points, width }) =>
          missingAtEnds(grid, points, width, isWater),
        )
        .filter((missing) => missing >= SQUARE).length,
    },
  };
}

/** The map with spaces for grass and trees, and `o` where the grown road ran and the laid one does not. */
function draw(result: ForestResult, grown: Point[][]): string {
  const rows = result.grid
    .toString()
    .split('\n')
    .map((row) => Array.from(row.replace(/["T]/g, ' ')));
  for (const { x, y } of grown.flat()) {
    const row = rows[y];
    if (row && row[x] !== '=' && row[x] !== '%') {
      row[x] = 'o';
    }
  }
  const tens = Array.from({ length: result.grid.width }, (_, x) =>
    x % 10 === 0 ? String(x / 10) : ' ',
  ).join('');
  return [
    `    ${tens}`,
    ...rows.map((row, y) => `${String(y).padStart(3)} ${row.join('')}`),
  ].join('\n');
}

const CHECKS: { name: string; failed: (score: Score) => boolean }[] = [
  {
    name: `turn over ${String(TURN_LIMIT)}°`,
    failed: (s) => s.turn > TURN_LIMIT,
  },
  {
    name: `grown road turns over ${String(TURN_LIMIT)}° (baseline)`,
    failed: (s) => s.grownTurn > TURN_LIMIT,
  },
  { name: 'road doubles back', failed: (s) => s.doubling },
  { name: 'road runs along the edge of the map', failed: (s) => s.edge },
  {
    name: 'grown road runs along the edge of the map (baseline)',
    failed: (s) => s.grownEdge,
  },
  { name: 'road runs along water', failed: (s) => s.along > 0 },
  { name: 'road tiles given back to water', failed: (s) => s.bitten > 0 },
  { name: 'long footbridge', failed: (s) => s.longFootbridges > 0 },
  { name: 'square road end', failed: (s) => s.squareRoadEnds > 0 },
  { name: 'square stream end', failed: (s) => s.squareStreamEnds > 0 },
];

const seeds = seedList();
const scored = seeds.map(score);
const scores = scored.map(({ score }) => score);
console.log(
  `${String(seeds.length)} seeds, tributaries ${flag('tributaries') ?? '2'}, ${String(
    scores.reduce((sum, s) => sum + s.footbridges, 0),
  )} footbridges in all\n`,
);
for (const { name, failed } of CHECKS) {
  const hits = scores.filter(failed).map(({ seed }) => seed);
  console.log(`${name}: ${String(hits.length)}/${String(seeds.length)}`);
  if (hits.length > 0) {
    console.log(`  ${hits.join(' ')}`);
  }
}
if (process.argv.includes('--show')) {
  for (const { score: s, result, grown } of scored) {
    const failed = CHECKS.filter(
      ({ name, failed: fails }) => !name.includes('baseline') && fails(s),
    ).map(({ name }) => name);
    if (failed.length > 0) {
      console.log(
        `\nseed ${String(s.seed)}: ${failed.join(', ')}, sharpest turn ${s.turn.toFixed(0)}°`,
      );
      console.log(draw(result, grown));
    }
  }
}
