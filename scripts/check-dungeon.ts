/**
 * Measures the dungeons over many seeds: how often they fail and what it
 * costs, and how they look. Run with `npm run check:dungeon`, and add flags after `--`:
 *
 * - `--from 1 --to 200`: the seeds to check (1 to 200 by default),
 * - `--seeds 6,9,14`: these seeds instead,
 * - `--templates 0,2,5`: the numbers of templated rooms to run (0, 2 and 5
 *   by default),
 * - `--placement lattice`: rooms and corridors on the lattice.
 *
 * Every dungeon is 61 by 41 with the defaults of the steps, built room-first
 * (`scatterRooms` or `partitionRooms`, then `carveCorridors`, as
 * `generateRoomDungeon` does) and grown (`growRooms`, then `carveCorridors`,
 * as `generateDigDungeon` does), with 0, 2 and 5 templated rooms. The
 * templates are the two examples of the playground's template editor, which
 * both have a fixed exit. Two in five of the templated rooms are halls,
 * rounded, and the rest closets: 2 is a closet and a hall, 5 is three closets
 * and two halls. A last run scatters the rooms round two features made
 * first, a pillar hall of 16 by 12 (`digPillarHalls`) and a noise cavern of
 * 14 to 18 by 10 to 14 (`carveNoiseCave`, its largest piece only), which
 * `carveCorridors` joins as stand-ins; a map fails there also when a feature
 * finds no spot or is cut off.
 *
 * Failure figures, per dungeon and number of templates:
 *
 * - tries: how many times a map was built round its templates (3 routings
 *   of `carveCorridors` at most), the mean and the
 *   most for one map,
 * - maps: how many maps were built for one seed (3 at most), the mean and
 *   the number of seeds that needed more than one,
 * - failed: the seeds that threw after the last map,
 * - time: per seed, retries included, the mean and the most.
 *
 * Look figures, over the seeds that did not fail (only rooms and exits for
 * the run with features, whose floor would count as corridor):
 *
 * - rooms: the room count,
 * - corridor: the pieces of corridor, the open tiles outside every room and
 *   exit, joined orthogonally; the mean length of a piece, and the mean of
 *   the longest piece of each map. A piece that branches or joins several
 *   rooms counts as one,
 * - spread: the share of the map covered by the box round every room, which
 *   is smaller when the rooms cluster,
 * - exits: the exits of a room, a shared door counting for both rooms,
 * - dead ends: corridor tiles with one open neighbor.
 */
import {
  Tile,
  TemplateCell,
  TemplatePlacementError,
  carveNoiseCave,
  digPillarHalls,
  emptyMap,
  growRooms,
  partitionRooms,
  pipeline,
  scatterRooms,
  step,
} from '../src';
import type {
  AnyStep,
  DungeonResult,
  MapStep,
  Placement,
  RoomTemplate,
} from '../src';
import { joinRooms } from '../src/dungeon/join-rooms';
import type { JoinedRooms } from '../src/dungeon/join-rooms';
import type { PlacedRooms } from '../src/dungeon/placed-rooms';
import { resolveCorridorSettings } from '../src/dungeon/resolve-corridor-settings';
import { corridorTiles, deadEnds } from '../src/test-helpers/dungeon-checks';
import { mulberry32 } from '../src/test-helpers/mulberry32';

declare const process: { argv: string[] };

const WIDTH = 61;
const HEIGHT = 41;
/** Maps built for one seed before it fails, as `pipeline` does. */
const MAP_ATTEMPTS = 3;

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

function cells(rows: string[]): TemplateCell[][] {
  return rows.map((row) =>
    Array.from(row, (char) =>
      char === '.'
        ? TemplateCell.Floor
        : char === 'E'
          ? TemplateCell.Exit
          : char === 'o'
            ? TemplateCell.OptionalExit
            : TemplateCell.Wall,
    ),
  );
}

const closet = (count: number): RoomTemplate => ({
  name: 'closet',
  count: { min: count, max: count },
  cells: cells(['#E#', '#.#', '###']),
});

const hall = (count: number): RoomTemplate => ({
  name: 'hall',
  count: { min: count, max: count },
  cells: cells([
    '#########',
    '#.......#',
    '#.......#',
    '#.......#',
    '###E#o#o#',
  ]),
});

/** The templated rooms of each run: two in five are halls, the rest closets. */
const TEMPLATE_SETS = (flag('templates') ?? '0,2,5')
  .split(',')
  .map(Number)
  .map((count) => {
    const halls = Math.round(count * 0.4);
    return {
      count,
      templates: [closet(count - halls), hall(halls)].filter(
        (template) => (template.count?.max ?? 0) > 0,
      ),
    };
  });

const placement: Placement =
  flag('placement') === 'lattice' ? 'lattice' : 'free';

type Build = (
  random: () => number,
  templates: RoomTemplate[],
  onTry: () => void,
) => DungeonResult;

/** Builds one map with a placement step and `carveCorridors`, after the features if any, counting the routing tries; `run` does the maps, as the pipeline would. */
function buildSteps(
  place: MapStep<Partial<PlacedRooms>, PlacedRooms>,
  random: () => number,
  onTry: () => void,
  features: AnyStep[] = [],
): DungeonResult {
  const corridors = step<PlacedRooms & Partial<JoinedRooms>, JoinedRooms>(
    'carveCorridors',
    {
      needs: ['rooms', 'roomShapes'],
      adds: ['rooms', 'roomShapes', 'roomExits'],
    },
    (state, context) =>
      joinRooms(
        state,
        context.random,
        resolveCorridorSettings({ placement }),
        onTry,
      ),
  );
  const steps: AnyStep[] = [...features, place, corridors];
  const result = pipeline(
    emptyMap({ width: WIDTH, height: HEIGHT, tile: Tile.Wall }),
    steps,
    { random, attempts: 1 },
  );
  const { rooms, roomExits } = result as unknown as JoinedRooms;
  return { grid: result.grid, rooms, exits: roomExits, fill: 0 };
}

/** A pillar hall and a noise cavern, each in an area of its own. */
const features = (): AnyStep[] => [
  digPillarHalls({
    area: { width: { min: 16, max: 16 }, height: { min: 12, max: 12 } },
  }),
  carveNoiseCave({
    area: { width: { min: 14, max: 18 }, height: { min: 10, max: 14 } },
    largestOnly: true,
  }),
];

const DUNGEONS: { name: string; build: Build; features?: boolean }[] = [
  {
    name: 'room-first scatter',
    build: (random, templates, onTry) =>
      buildSteps(scatterRooms({ templates, placement }), random, onTry),
  },
  {
    name: 'room-first bsp',
    build: (random, templates, onTry) =>
      buildSteps(partitionRooms({ templates, placement }), random, onTry),
  },
  {
    name: 'grown',
    build: (random, templates, onTry) =>
      buildSteps(growRooms({ templates, placement }), random, onTry),
  },
  {
    name: 'scatter, hall, cavern',
    build: (random, templates, onTry) =>
      buildSteps(
        scatterRooms({ templates, placement }),
        random,
        onTry,
        features(),
      ),
    features: true,
  },
];

interface Look {
  rooms: number;
  corridors: number[];
  spread: number;
  exitsPerRoom: number;
  deadEnds: number;
}

interface Run {
  /** The tries of each map built for the seed. */
  tries: number[];
  failed: boolean;
  ms: number;
  look?: Look;
}

/** The sizes of the pieces of corridor: open tiles outside rooms and exits, joined orthogonally. */
function corridorPieces(result: DungeonResult): number[] {
  const { width } = result.grid;
  const exits = new Set(
    result.exits.map(({ position }) => position.y * width + position.x),
  );
  const open = new Set(
    corridorTiles(result)
      .map(({ x, y }) => y * width + x)
      .filter((at) => !exits.has(at)),
  );
  const pieces: number[] = [];
  for (const start of open) {
    open.delete(start);
    const queue = [start];
    for (let index = 0; index < queue.length; ++index) {
      const at = queue[index] ?? 0;
      const x = at % width;
      for (const next of [
        x > 0 ? at - 1 : -1,
        x < width - 1 ? at + 1 : -1,
        at - width,
        at + width,
      ]) {
        if (open.delete(next)) {
          queue.push(next);
        }
      }
    }
    pieces.push(queue.length);
  }
  return pieces;
}

function lookOf(result: DungeonResult): Look {
  const { rooms } = result;
  const left = Math.min(...rooms.map(({ x }) => x));
  const top = Math.min(...rooms.map(({ y }) => y));
  const right = Math.max(...rooms.map(({ x, width }) => x + width));
  const bottom = Math.max(...rooms.map(({ y, height }) => y + height));
  return {
    rooms: rooms.length,
    corridors: corridorPieces(result),
    spread:
      rooms.length === 0
        ? 0
        : ((right - left) * (bottom - top)) / (WIDTH * HEIGHT),
    exitsPerRoom:
      rooms.reduce((sum, { exitCount }) => sum + exitCount, 0) /
      Math.max(1, rooms.length),
    deadEnds: deadEnds(result).length,
  };
}

/** Builds the dungeon of a seed as `pipeline` does, counting the tries and the maps. */
function run(build: Build, templates: RoomTemplate[], seed: number): Run {
  const random = mulberry32(seed);
  const tries: number[] = [];
  const started = performance.now();
  for (let map = 1; ; ++map) {
    tries.push(0);
    try {
      const result = build(random, templates, () => {
        tries[tries.length - 1] = (tries.at(-1) ?? 0) + 1;
      });
      return {
        tries,
        failed: false,
        ms: performance.now() - started,
        look: lookOf(result),
      };
    } catch (error) {
      // the pipeline retries every error but a permanent one, and so does this
      if (
        !(error instanceof Error) ||
        error instanceof TypeError ||
        (error instanceof TemplatePlacementError && error.permanent)
      ) {
        throw error;
      }
      if (map === MAP_ATTEMPTS) {
        return { tries, failed: true, ms: performance.now() - started };
      }
    }
  }
}

const mean = (values: number[]) =>
  values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);

function table(head: string[], rows: string[][]): string {
  const widths = head.map((cell, column) =>
    Math.max(cell.length, ...rows.map((row) => (row[column] ?? '').length)),
  );
  const line = (row: string[]) =>
    row
      .map((cell, column) =>
        column === 0
          ? cell.padEnd(widths[column] ?? 0)
          : cell.padStart(widths[column] ?? 0),
      )
      .join('  ');
  return [line(head), ...rows.map(line)].join('\n');
}

const seeds = seedList();
// a first, untimed round, so that the times do not include warming up
for (const { build } of DUNGEONS) {
  for (const { templates } of TEMPLATE_SETS) {
    run(build, templates, 0);
  }
}

const failureRows: string[][] = [];
const lookRows: string[][] = [];
for (const { name, build, features: featured } of DUNGEONS) {
  for (const { count, templates } of TEMPLATE_SETS) {
    const runs = seeds.map((seed) => run(build, templates, seed));
    const tries = runs.flatMap((one) => one.tries);
    const looks = runs.flatMap(({ look }) => (look ? [look] : []));
    const corridors = looks.flatMap(({ corridors: pieces }) => pieces);
    const label = `${name}, ${String(count)} templates`;
    const failed = runs.filter((one) => one.failed).length;
    failureRows.push([
      label,
      mean(tries).toFixed(2),
      String(Math.max(...tries)),
      mean(runs.map((one) => one.tries.length)).toFixed(2),
      String(runs.filter((one) => one.tries.length > 1).length),
      String(failed),
      mean(runs.map(({ ms }) => ms)).toFixed(1),
      Math.max(...runs.map(({ ms }) => ms)).toFixed(1),
    ]);
    const unless = (figure: string) => (featured ? '-' : figure);
    lookRows.push([
      label,
      mean(looks.map(({ rooms }) => rooms)).toFixed(1),
      unless(mean(corridors).toFixed(1)),
      unless(
        mean(
          looks.map(({ corridors: pieces }) => Math.max(0, ...pieces)),
        ).toFixed(1),
      ),
      unless(mean(looks.map(({ spread }) => spread)).toFixed(2)),
      mean(looks.map(({ exitsPerRoom }) => exitsPerRoom)).toFixed(2),
      unless(mean(looks.map(({ deadEnds: ends }) => ends)).toFixed(1)),
    ]);
  }
}

console.log(
  `${String(seeds.length)} seeds, ${String(WIDTH)} by ${String(HEIGHT)}, ${placement} placement\n`,
);
console.log(
  table(
    ['dungeon', 'tries', 'most', 'maps', 'retried', 'failed', 'ms', 'most ms'],
    failureRows,
  ),
);
console.log('');
console.log(
  table(
    ['dungeon', 'rooms', 'corridor', 'longest', 'spread', 'exits', 'dead ends'],
    lookRows,
  ),
);
