import { Reserve, Tile, emptyMap, measureDistances, pipeline } from '../src';
import type {
  Area,
  CrossingPlan,
  DistanceMetric,
  Exit,
  ForestTemplate,
  Grid,
  MinePassage,
  PlacedClearing,
  Point,
  Room,
  RoomGroup,
} from '../src';
import { describeCaveRegion } from '../src/cave/describe-cave-region';
import { findCaveRegions } from '../src/cave/find-cave-regions';
import { mulberry32 } from '../src/test-helpers/mulberry32';
import { downloadCanvas } from './download-canvas';
import { Color, drawGrid } from './draw-grid';
import type { DisplayMode } from './draw-grid';
import { STEP_DEFS } from './step-defs';
import { createTemplateEditor } from './template-editor';
import type { StepDef } from './step-defs';
import { Values } from './step-fields';
import type { Field, FieldValue } from './step-fields';

const form = document.querySelector<HTMLFormElement>('#controls');
const overlays = document.querySelector<HTMLFormElement>('#overlays');
const list = document.querySelector<HTMLElement>('#steps');
const addKind = document.querySelector<HTMLSelectElement>('#add-kind');
const after = document.querySelector<HTMLSelectElement>('#after');
const display = document.querySelector<HTMLSelectElement>('#display');
const download = document.querySelector<HTMLButtonElement>('#download');
const canvas = document.querySelector<HTMLCanvasElement>('#map');
const error = document.querySelector<HTMLElement>('#error');
const stats = document.querySelector<HTMLElement>('#stats');
const failures = document.querySelector<HTMLElement>('#failures');
const distanceLine = document.querySelector<HTMLElement>('#distances');
const templatePanel = document.querySelector<HTMLElement>('#templates');
const context = canvas?.getContext('2d');

/** A step in the list, with what its controls hold. */
interface Card {
  def: StepDef;
  values: Record<string, FieldValue>;
}

/** What the steps have reported by the time a snapshot was taken. */
interface Extras {
  clearings: PlacedClearing[];
  templates: ForestTemplate[];
  junctions: Point[];
  exits: Point[];
  passages: MinePassage[];
  halls: Area[];
  caverns: Area[];
  rooms: Room[];
  roomExits: Exit[];
  roomGroups: RoomGroup[];
  start: Point;
}

/** The map after a step of the last attempt. */
interface Snapshot {
  name: string;
  grid: Grid;
  reserved: Uint8Array;
  extras: Partial<Extras>;
}

/** The steps that were added, in order. */
let cards: Card[] = [];

/** The maps after each step of the last run, in order, starting with the base. */
let snapshots: Snapshot[] = [];

/** What `layRoads` traced in the last attempt: the roads as grown and how they cross the streams. */
let traced: { grown: Point[][]; plans: CrossingPlan[] } | undefined;

/** The place the walking distances are measured from, by its index in `placesOf`. */
let picked = 0;

function newCard(
  name: string,
  values: Record<string, FieldValue> = {},
): Card | undefined {
  const def = STEP_DEFS.find((candidate) => candidate.name === name);
  return (
    def && {
      def,
      values: {
        ...Object.fromEntries(def.fields.map(({ key, value }) => [key, value])),
        ...values,
      },
    }
  );
}

/** A step to load, by name, with the values that differ from its card's defaults. */
type CardSpec = string | readonly [string, Record<string, FieldValue>];

/** The steps of a forest, to start from. */
const FOREST = [
  'plantTrees',
  'layStreams',
  'layRoads',
  'placeClearings',
  'layFootbridges',
];

/** The tunnels of the cave and mine presets: single-width veins that only join the pieces. */
const TUNNELS: CardSpec = [
  'digVeins',
  { density: '0', veinWidthMin: '1', veinWidthMax: '1' },
];

/** The steps of `generateMine`, with its defaults. It is dug out of wall, so the base tile is set to wall. */
const MINE: CardSpec[] = ['digFishbone'];

/** The steps of `generateMine` with `caverns: {}`: the caverns get the preset's defaults, which differ from the step's. */
const MINE_WITH_CAVERNS: CardSpec[] = [
  'digFishbone',
  [
    'digNoiseCave',
    {
      scaleX: '7',
      scaleY: '7',
      largestOnly: true,
      areaWidthMin: '12',
      areaWidthMax: '24',
      areaHeightMin: '12',
      areaHeightMax: '24',
      placement: 'beside',
    },
  ],
  TUNNELS,
];

/** The steps of `generateCave`, with its defaults. It is dug out of wall too. */
const CAVE: CardSpec[] = ['digCellularCave', TUNNELS];

/** The steps of `generateNoiseCave`, with its defaults. */
const NOISE_CAVE: CardSpec[] = ['digNoiseCave', TUNNELS];

/** The steps of `generateMaze`, with its defaults. It is carved out of wall too. */
const MAZE: CardSpec[] = ['digMaze'];

/** The steps of `generateMaze` with rooms and exits, the exits on the lattice so their doors face the cells of the maze. */
const MAZE_WITH_ROOMS: CardSpec[] = [
  ['placeMazeRooms', { roomCountMin: '3', roomCountMax: '5' }],
  'digMaze',
  'openMazeRooms',
  ['openExits', { lattice: true }],
];

/** The steps of `generateRoomDungeon`, with its defaults. It is carved out of wall too. */
const DUNGEON: CardSpec[] = ['placeScatteredRooms', 'digCorridors'];

/** The steps of `generateDigDungeon`, with its defaults. It is carved out of wall too. */
const GROWN_DUNGEON: CardSpec[] = ['placeClusteredRooms', 'digCorridors'];

/** Rooms scattered round a pillar hall and a noise cavern, which `digCorridors` joins as stand-ins: the features run of check:dungeon. */
const DUNGEON_WITH_FEATURES: CardSpec[] = [
  [
    'digPillarHalls',
    {
      areaWidthMin: '16',
      areaWidthMax: '16',
      areaHeightMin: '12',
      areaHeightMax: '12',
    },
  ],
  [
    'digNoiseCave',
    {
      largestOnly: true,
      areaWidthMin: '14',
      areaWidthMax: '18',
      areaHeightMin: '10',
      areaHeightMax: '14',
    },
  ],
  'placeScatteredRooms',
  'digCorridors',
];

/** A cavern in part of the map and a few rooms, joined by cave tunnels that enter the rooms through their potential exits. */
const CAVE_WITH_ROOMS: CardSpec[] = [
  [
    'digCellularCave',
    {
      areaWidthMin: '24',
      areaWidthMax: '24',
      areaHeightMin: '16',
      areaHeightMax: '16',
    },
  ],
  ['placeScatteredRooms', { roomCountMin: '4', roomCountMax: '6' }],
  TUNNELS,
];

/** A cell block or two, then rooms round them, joined by corridors that enter each block at its entrance. */
const PRISON: CardSpec[] = [
  ['placeCellBlocks', { blocksMin: '1', blocksMax: '2', guardRoom: true }],
  'placeScatteredRooms',
  'digCorridors',
];

/** Outlines a tile. */
function mark(
  context: CanvasRenderingContext2D,
  { x, y }: Point,
  color: string,
  tileSize: number,
): void {
  context.strokeStyle = color;
  context.lineWidth = Math.max(1, tileSize / 6);
  context.strokeRect(
    x * tileSize + 1,
    y * tileSize + 1,
    tileSize - 2,
    tileSize - 2,
  );
}

/** A place to measure the walk to: what the steps reported, its tiles, and where to write its distance. */
interface Place {
  name: string;
  tiles: Point[];
  center: Point;
}

function boxPlace(name: string, { x, y, width, height }: Area): Place {
  const tiles: Point[] = [];
  for (let row = y; row < y + height; ++row) {
    for (let column = x; column < x + width; ++column) {
      tiles.push({ x: column, y: row });
    }
  }
  return {
    name,
    tiles,
    center: { x: x + Math.floor(width / 2), y: y + Math.floor(height / 2) },
  };
}

function pointPlace(name: string, point: Point): Place {
  return { name, tiles: [point], center: point };
}

/**
 * The places the steps reported, to measure the walk between: rooms, halls
 * and caverns by their boxes (the rock in a box is left out by
 * `measureDistances`, though a tunnel through it counts), clearings by their
 * centers, and exits.
 */
function placesOf(extras: Partial<Extras>): Place[] {
  return [
    ...(extras.rooms ?? []).map((room) =>
      boxPlace(`room ${String(room.id)}`, room),
    ),
    ...(extras.halls ?? []).map((hall, index) =>
      boxPlace(`hall ${String(index)}`, hall),
    ),
    ...(extras.caverns ?? []).map((cavern, index) =>
      boxPlace(`cavern ${String(index)}`, cavern),
    ),
    ...(extras.clearings ?? []).map(({ x, y }, index) =>
      pointPlace(`clearing ${String(index)}`, { x, y }),
    ),
    ...(extras.exits ?? []).map((exit, index) =>
      pointPlace(`exit ${String(index)}`, exit),
    ),
  ];
}

/** Writes the walk from the picked place to every other place on the map. */
function paintDistances(
  context: CanvasRenderingContext2D,
  shown: Snapshot,
  tileSize: number,
  show: FormData,
): void {
  if (!distanceLine) {
    return;
  }
  distanceLine.textContent = '';
  if (!show.has('showDistances')) {
    return;
  }
  const places = placesOf(shown.extras);
  const from = places[picked] ?? places[0];
  if (!from) {
    distanceLine.textContent =
      'No rooms, halls, caverns, clearings or exits to measure between.';
    return;
  }
  const given = show.get('costs');
  const costs = typeof given === 'string' ? given.trim() : '';
  let row: number[];
  const started = performance.now();
  try {
    row =
      measureDistances(
        shown.grid,
        places.map(({ tiles }) => tiles),
        {
          metric: show.get('metric') as DistanceMetric,
          costs: costs
            ? (JSON.parse(costs) as Partial<Record<Tile, number>>)
            : {},
        },
      )[places.indexOf(from)] ?? [];
  } catch (e) {
    distanceLine.textContent = `Distances: ${e instanceof Error ? e.message : String(e)}`;
    return;
  }
  const took = performance.now() - started;
  const farthest = Math.max(0, ...row);
  // a white outline round the picked place
  const xs = from.tiles.map(({ x }) => x);
  const ys = from.tiles.map(({ y }) => y);
  context.strokeStyle = Color.BrightWhite;
  context.lineWidth = Math.max(1, tileSize / 6);
  context.strokeRect(
    Math.min(...xs) * tileSize,
    Math.min(...ys) * tileSize,
    (Math.max(...xs) - Math.min(...xs) + 1) * tileSize,
    (Math.max(...ys) - Math.min(...ys) + 1) * tileSize,
  );
  // the distance on the center of every other place: red for the farthest,
  // yellow for at least 70% of it, gray for no way
  context.font = `bold ${String(Math.max(9, tileSize))}px monospace`;
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  places.forEach((place, index) => {
    const distance = row[index] ?? -1;
    if (place === from) {
      return;
    }
    const text = distance < 0 ? '×' : String(Math.round(distance * 10) / 10);
    const cx = (place.center.x + 0.5) * tileSize;
    const cy = (place.center.y + 0.5) * tileSize;
    const width = context.measureText(text).width + 4;
    context.fillStyle = Color.Black;
    context.fillRect(
      cx - width / 2,
      cy - tileSize / 2 - 1,
      width,
      tileSize + 2,
    );
    context.fillStyle =
      distance < 0
        ? Color.BrightBlack
        : distance === farthest
          ? Color.BrightRed
          : distance >= 0.7 * farthest
            ? Color.BrightYellow
            : Color.BrightWhite;
    context.fillText(text, cx, cy);
  });
  const far = places
    .filter((_, index) => row[index] === farthest && farthest > 0)
    .map(({ name }) => name);
  distanceLine.textContent = [
    `Walking distances from ${from.name}; click a room, hall, cavern, clearing or exit to measure from it.`,
    far.length > 0
      ? `Farthest: ${far.join(', ')} at ${String(Math.round(farthest * 10) / 10)}; yellow is at least 70% of that, × no way.`
      : 'Nothing else can be reached.',
    `${String(places.length)} places measured in ${took.toFixed(1)} ms.`,
  ].join(' ');
}

function paint(): void {
  if (!form || !overlays || !after || !display || !canvas || !context) {
    return;
  }
  const at = Number(after.value);
  const shown = snapshots[at];
  if (!shown) {
    return;
  }
  const tileSize = Number(new FormData(form).get('tileSize'));
  const show = new FormData(overlays);
  const { extras } = shown;
  drawGrid(
    canvas,
    context,
    shown.grid,
    tileSize,
    display.value as DisplayMode,
    [
      ...(show.has('showExits') ? (extras.exits ?? []) : []),
      // room openings without a door
      ...(show.has('showGaps')
        ? (extras.roomExits ?? [])
            .filter(({ door }) => !door)
            .map(({ position }) => position)
        : []),
    ],
  );
  if (show.has('showReserved')) {
    // a tinted square on every reserved tile, one color for each kind
    context.globalAlpha = 0.5;
    shown.reserved.forEach((kind, tile) => {
      if (kind !== Reserve.None) {
        context.fillStyle =
          kind === Reserve.Solid ? Color.Red : Color.BrightCyan;
        context.fillRect(
          (tile % shown.grid.width) * tileSize,
          Math.floor(tile / shown.grid.width) * tileSize,
          tileSize,
          tileSize,
        );
      }
    });
    context.globalAlpha = 1;
  }
  if (show.has('showClearings')) {
    // an outlined square on the center of every clearing
    for (const center of extras.clearings ?? []) {
      mark(context, center, Color.BrightYellow, tileSize);
    }
  }
  if (show.has('showCenters')) {
    // an outlined square on the center of every region of floor, as the cave
    // presets report them
    for (const { center } of findCaveRegions(shown.grid).map(
      describeCaveRegion,
    )) {
      mark(context, center, Color.BrightRed, tileSize);
    }
  }
  if (show.has('showTemplates')) {
    // an outline round the box of every template
    context.strokeStyle = Color.BrightMagenta;
    context.lineWidth = Math.max(1, tileSize / 6);
    for (const { x, y, width, height } of extras.templates ?? []) {
      context.strokeRect(
        x * tileSize,
        y * tileSize,
        width * tileSize,
        height * tileSize,
      );
    }
  }
  if (show.has('showTunnels')) {
    // a small square on the middle line of every passage: red for a main
    // shaft, blue for every other tunnel
    for (const { kind, tiles } of extras.passages ?? []) {
      context.fillStyle = kind === 'shaft' ? Color.BrightRed : Color.BrightBlue;
      for (const { x, y } of tiles) {
        context.fillRect(
          x * tileSize + tileSize / 3,
          y * tileSize + tileSize / 3,
          tileSize / 3,
          tileSize / 3,
        );
      }
    }
  }
  if (show.has('showHalls')) {
    // an outline round the box of every hall
    context.strokeStyle = Color.BrightYellow;
    context.lineWidth = Math.max(1, tileSize / 6);
    for (const { x, y, width, height } of extras.halls ?? []) {
      context.strokeRect(
        x * tileSize,
        y * tileSize,
        width * tileSize,
        height * tileSize,
      );
    }
  }
  if (show.has('showCaverns')) {
    // an outline round the area of every cave
    context.strokeStyle = Color.BrightCyan;
    context.lineWidth = Math.max(1, tileSize / 6);
    for (const { x, y, width, height } of extras.caverns ?? []) {
      context.strokeRect(
        x * tileSize,
        y * tileSize,
        width * tileSize,
        height * tileSize,
      );
    }
  }
  if (show.has('showRooms')) {
    // an outline round the floor of every room
    context.strokeStyle = Color.BrightGreen;
    context.lineWidth = Math.max(1, tileSize / 6);
    for (const { x, y, width, height } of extras.rooms ?? []) {
      context.strokeRect(
        x * tileSize,
        y * tileSize,
        width * tileSize,
        height * tileSize,
      );
    }
  }
  if (show.has('showBlocks')) {
    // an outline round the footprint of every cell block, its tunnel and its
    // guard room, walls included, and a mark on its entrance
    context.strokeStyle = Color.BrightMagenta;
    context.lineWidth = Math.max(1, tileSize / 6);
    const guards = (extras.rooms ?? [])
      .filter(({ kind }) => kind === 'guardRoom')
      .map(({ x, y, width, height }) => ({
        x: x - 1,
        y: y - 1,
        width: width + 2,
        height: height + 2,
      }));
    const tunnels = (extras.roomGroups ?? []).flatMap(({ tunnel }) =>
      // between its walls, across a tunnel that is one tile wide
      tunnel
        ? [
            tunnel.height === 1
              ? { ...tunnel, y: tunnel.y - 1, height: 3 }
              : { ...tunnel, x: tunnel.x - 1, width: 3 },
          ]
        : [],
    );
    for (const box of [
      ...(extras.roomGroups ?? []).map(({ footprint }) => footprint),
      ...guards,
      ...tunnels,
    ]) {
      context.strokeRect(
        box.x * tileSize,
        box.y * tileSize,
        box.width * tileSize,
        box.height * tileSize,
      );
    }
    for (const { entrance } of extras.roomGroups ?? []) {
      mark(context, entrance, Color.BrightYellow, tileSize);
    }
  }
  if (show.has('showStart') && extras.start) {
    // a green square on the cell the maze was carved from
    context.fillStyle = Color.BrightGreen;
    context.fillRect(
      extras.start.x * tileSize + tileSize / 4,
      extras.start.y * tileSize + tileSize / 4,
      tileSize / 2,
      tileSize / 2,
    );
  }
  if (show.has('showJunctions')) {
    // a red square on every junction
    context.fillStyle = '#d23c3c';
    for (const { x, y } of extras.junctions ?? []) {
      context.fillRect(
        x * tileSize + tileSize / 4,
        y * tileSize + tileSize / 4,
        tileSize / 2,
        tileSize / 2,
      );
    }
  }
  // what layRoads traced belongs to the map from that step on
  const roadsAt = snapshots.findIndex(({ name }) => name === 'layRoads');
  if (traced && roadsAt !== -1 && at >= roadsAt) {
    if (show.has('showGrown')) {
      // a small dot on every tile of a road as it was grown
      context.fillStyle = Color.BrightMagenta;
      for (const { x, y } of traced.grown.flat()) {
        context.fillRect(
          x * tileSize + tileSize / 3,
          y * tileSize + tileSize / 3,
          tileSize / 3,
          tileSize / 3,
        );
      }
    }
    if (show.has('showPlans')) {
      // outlined squares on the ends of the roads and where they cross water
      for (const { start, end, crossings } of traced.plans) {
        mark(context, start, Color.BrightCyan, tileSize);
        mark(context, end, Color.BrightCyan, tileSize);
        for (const { approach, entry, exit, departure } of crossings) {
          mark(context, approach, Color.BrightCyan, tileSize);
          mark(context, departure, Color.BrightCyan, tileSize);
          mark(context, entry, Color.BrightYellow, tileSize);
          mark(context, exit, Color.BrightYellow, tileSize);
        }
      }
    }
  }
  paintDistances(context, shown, tileSize, show);
}

/** Runs the steps in the list and shows the last attempt. */
function render(): void {
  if (!form || !after || !error || !stats || !failures) {
    return;
  }
  const data = new FormData(form);
  const value = (name: string): number => Number(data.get(name));
  const kept = after.value;
  // a view of the last step follows the last step, as steps are added or moved
  const followsLast = kept === '' || Number(kept) === after.options.length - 1;

  let summary = '';
  let failed: { attempt: number; step: string; error: unknown }[] = [];
  snapshots = [];
  traced = undefined;
  try {
    // a bad option throws when its step is made
    const steps = cards.map(({ def, values }) => def.make(new Values(values)));
    const makeBase = emptyMap({
      width: value('width'),
      height: value('height'),
      tile: value('baseTile') as Tile,
    });
    const run = pipeline(
      () => {
        // a new attempt starts here, so keep the snapshots of the last one only
        const state = makeBase();
        traced = undefined;
        snapshots = [
          {
            name: 'base',
            grid: state.grid.clone(),
            reserved: state.reserved.slice(),
            extras: {},
          },
        ];
        return state;
      },
      steps,
      {
        random: mulberry32(value('seed')),
        attempts: value('attempts'),
        trace: (_name, traceData) => {
          traced = traceData as { grown: Point[][]; plans: CrossingPlan[] };
        },
        onStep: (name, state) => {
          const extras = state as unknown as Partial<Extras>;
          snapshots.push({
            name,
            grid: state.grid.clone(),
            reserved: state.reserved.slice(),
            extras: {
              clearings: extras.clearings,
              templates: extras.templates,
              junctions: extras.junctions,
              exits: extras.exits,
              passages: extras.passages,
              halls: extras.halls,
              caverns: extras.caverns,
              rooms: extras.rooms,
              roomExits: extras.roomExits,
              roomGroups: extras.roomGroups,
              start: extras.start,
            },
          });
        },
      },
    );
    const done = run as unknown as Partial<Record<string, unknown[]>>;
    const counts = [
      'roads',
      'streams',
      'bridges',
      'clearings',
      'templates',
      'passages',
      'halls',
      'caverns',
      'rooms',
      'roomExits',
      'roomGroups',
    ]
      .filter((name) => done[name])
      .map((name) => `${String(done[name]?.length)} ${name}`);
    // the regions of floor, which the cave presets report
    const regions = findCaveRegions(run.grid).length;
    // the rooms by kind, which tells apart what the room steps made
    const kinds = new Map<string, number>();
    for (const { kind } of (done.rooms ?? []) as Room[]) {
      kinds.set(kind, (kinds.get(kind) ?? 0) + 1);
    }
    summary = [
      `${String(run.attempts)} attempt(s), ${String(run.failures.length)} failure(s)`,
      ...counts,
      ...(kinds.size > 0
        ? [
            `rooms by kind: ${[...kinds].map(([kind, count]) => `${String(count)} ${kind}`).join(', ')}`,
          ]
        : []),
      ...(regions > 0 ? [`${String(regions)} regions of floor`] : []),
    ].join(', ');
    failed = run.failures;
    error.textContent = '';
  } catch (e) {
    error.textContent = e instanceof Error ? e.message : String(e);
  }

  after.replaceChildren(
    ...snapshots.map(({ name }, index) => {
      const option = document.createElement('option');
      option.value = String(index);
      option.textContent = `${String(index)}: ${name}`;
      return option;
    }),
  );
  after.value =
    !followsLast && snapshots[Number(kept)]
      ? kept
      : String(snapshots.length - 1);
  stats.textContent = summary;
  failures.textContent = failed
    .map(
      ({ attempt, step: name, error: e }) =>
        `attempt ${String(attempt)}: step "${name}" threw ${e instanceof Error ? e.message : String(e)}`,
    )
    .join('\n');
  paint();
}

/** Makes the control of a field. */
function control(card: Card, field: Field): HTMLLabelElement {
  const label = document.createElement('label');
  label.append(field.label);
  const input =
    field.type === 'select'
      ? document.createElement('select')
      : field.type === 'json'
        ? document.createElement('textarea')
        : document.createElement('input');
  input.dataset.field = field.key;
  if (input instanceof HTMLSelectElement) {
    for (const [value, text] of field.options ?? []) {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = text;
      input.append(option);
    }
  } else if (input instanceof HTMLInputElement) {
    input.type = field.type;
    for (const [name, attribute] of Object.entries(field.attrs ?? {})) {
      input.setAttribute(name, attribute);
    }
  }
  const current = card.values[field.key] ?? field.value;
  if (input instanceof HTMLInputElement && field.type === 'checkbox') {
    input.checked = current === true;
  } else {
    input.value = String(current);
  }
  label.append(input);
  if (field.type === 'json') {
    label.classList.add('wide');
  }
  return label;
}

/** Draws the list of cards again, after a step was added, moved or removed. */
function renderCards(): void {
  list?.replaceChildren(
    ...cards.map((card, index) => {
      const box = document.createElement('section');
      box.className = 'step';
      box.dataset.index = String(index);
      const head = document.createElement('header');
      const title = document.createElement('strong');
      title.textContent = `${String(index + 1)}. ${card.def.name}`;
      const summary = document.createElement('span');
      summary.textContent = card.def.summary;
      head.append(title, summary);
      for (const [action, text] of [
        ['up', '↑'],
        ['down', '↓'],
        ['remove', '×'],
      ] as const) {
        const button = document.createElement('button');
        button.type = 'button';
        button.dataset.action = action;
        button.textContent = text;
        head.append(button);
      }
      const fields = document.createElement('div');
      fields.className = 'fields';
      fields.append(...card.def.fields.map((field) => control(card, field)));
      box.append(head, fields);
      return box;
    }),
  );
}

function setCards(specs: readonly CardSpec[]): void {
  cards = specs.flatMap((spec) =>
    typeof spec === 'string'
      ? (newCard(spec) ?? [])
      : (newCard(spec[0], spec[1]) ?? []),
  );
  renderCards();
  render();
}

addKind?.replaceChildren(
  ...STEP_DEFS.map(({ name }) => {
    const option = document.createElement('option');
    option.value = name;
    option.textContent = name;
    return option;
  }),
);
document.querySelector('#add-step')?.addEventListener('click', () => {
  const card = addKind && newCard(addKind.value);
  if (card) {
    cards.push(card);
    renderCards();
    render();
  }
});
document.querySelector('#load-forest')?.addEventListener('click', () => {
  setCards(FOREST);
});
/** Loads steps that dig out of rock, on a base of wall. */
function setWallCards(specs: readonly CardSpec[]): void {
  const base = form?.elements.namedItem('baseTile');
  if (base instanceof HTMLSelectElement) {
    base.value = String(Tile.Wall);
  }
  setCards(specs);
}

document.querySelector('#load-mine')?.addEventListener('click', () => {
  setWallCards(MINE);
});
document.querySelector('#load-mine-caverns')?.addEventListener('click', () => {
  setWallCards(MINE_WITH_CAVERNS);
});
document.querySelector('#load-cave')?.addEventListener('click', () => {
  setWallCards(CAVE);
});
document.querySelector('#load-noise-cave')?.addEventListener('click', () => {
  setWallCards(NOISE_CAVE);
});
document.querySelector('#load-maze')?.addEventListener('click', () => {
  setWallCards(MAZE);
});
document.querySelector('#load-maze-rooms')?.addEventListener('click', () => {
  setWallCards(MAZE_WITH_ROOMS);
});
document.querySelector('#load-dungeon')?.addEventListener('click', () => {
  setWallCards(DUNGEON);
});
/** Sets the size of the map to the one that check:dungeon measures. */
function setDungeonSize(): void {
  for (const [name, size] of [
    ['width', 61],
    ['height', 41],
  ] as const) {
    const input = form?.elements.namedItem(name);
    if (input instanceof HTMLInputElement) {
      input.value = String(size);
    }
  }
}

document.querySelector('#load-grown-dungeon')?.addEventListener('click', () => {
  setDungeonSize();
  setWallCards(GROWN_DUNGEON);
});
document
  .querySelector('#load-dungeon-features')
  ?.addEventListener('click', () => {
    setDungeonSize();
    setWallCards(DUNGEON_WITH_FEATURES);
  });
document.querySelector('#load-cave-rooms')?.addEventListener('click', () => {
  setDungeonSize();
  setWallCards(CAVE_WITH_ROOMS);
});
document.querySelector('#load-prison')?.addEventListener('click', () => {
  setWallCards(PRISON);
});
// the room cards take the templates as JSON, which the editor exports
if (templatePanel) {
  createTemplateEditor(templatePanel, () => undefined);
}

document.querySelector('#clear-steps')?.addEventListener('click', () => {
  setCards([]);
});

list?.addEventListener('click', (event) => {
  const target = event.target;
  const box =
    target instanceof HTMLElement && target.closest<HTMLElement>('.step');
  const action = target instanceof HTMLElement && target.dataset.action;
  const index = Number(box && box.dataset.index);
  if (!box || !action) {
    return;
  }
  const card = cards[index];
  if (action === 'remove') {
    cards.splice(index, 1);
  } else if (card) {
    const to = action === 'up' ? index - 1 : index + 1;
    const other = cards[to];
    if (other) {
      cards[to] = card;
      cards[index] = other;
    }
  }
  renderCards();
  render();
});
list?.addEventListener('input', (event) => {
  const target = event.target;
  const box =
    target instanceof HTMLElement && target.closest<HTMLElement>('.step');
  const card = box && cards[Number(box.dataset.index)];
  if (
    card &&
    (target instanceof HTMLInputElement ||
      target instanceof HTMLSelectElement ||
      target instanceof HTMLTextAreaElement) &&
    target.dataset.field
  ) {
    card.values[target.dataset.field] =
      target instanceof HTMLInputElement && target.type === 'checkbox'
        ? target.checked
        : target.value;
    render();
  }
});
form?.addEventListener('input', render);
// only the picture changes, so do not run the pipeline again
after?.addEventListener('input', paint);
display?.addEventListener('input', paint);
overlays?.addEventListener('input', paint);
// a click on a place measures the walking distances from it
canvas?.addEventListener('click', (event) => {
  const shown = snapshots[Number(after?.value)];
  if (!shown) {
    return;
  }
  const bounds = canvas.getBoundingClientRect();
  const x = Math.floor(
    ((event.clientX - bounds.left) / bounds.width) * shown.grid.width,
  );
  const y = Math.floor(
    ((event.clientY - bounds.top) / bounds.height) * shown.grid.height,
  );
  const index = placesOf(shown.extras).findIndex(({ tiles }) =>
    tiles.some((tile) => tile.x === x && tile.y === y),
  );
  if (index !== -1) {
    picked = index;
    paint();
  }
});
download?.addEventListener('click', () => {
  if (canvas) {
    downloadCanvas(canvas, 'angstloch-steps.png');
  }
});
setCards(FOREST);
