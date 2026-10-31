import {
  Reserve,
  Tile,
  createRoomMap,
  emptyMap,
  measureDistances,
  measureRoomDistances,
  pipeline,
} from '../src';
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
  RoomShape,
} from '../src';
import { findCaveRegions } from '../src/cave/find-cave-regions';
import { isFeatureRoom } from '../src/rooms/is-feature-room';
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
const roomLine = document.querySelector<HTMLElement>('#room');
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
  rooms: Room[];
  roomExits: Exit[];
  roomGroups: RoomGroup[];
  roomShapes: RoomShape[];
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

/** The tile under the mouse, if it is over the map. */
let pointed: Point | undefined;

/** The room id of every tile of each snapshot, made when first needed. */
const roomMaps = new WeakMap<Snapshot, Int32Array>();

/** The room id of every tile of a snapshot, -1 for none. */
function roomMapOf(shown: Snapshot): Int32Array {
  let map = roomMaps.get(shown);
  if (!map) {
    map = createRoomMap({
      grid: shown.grid,
      roomShapes: shown.extras.roomShapes ?? [],
    });
    roomMaps.set(shown, map);
  }
  return map;
}

/** The id of the room under the mouse, -1 for none. */
function pointedRoom(shown: Snapshot): number {
  return pointed
    ? (roomMapOf(shown)[pointed.y * shown.grid.width + pointed.x] ?? -1)
    : -1;
}

/** Tints the floor of the room under the mouse, outlines its exits, and says what it is. */
function paintPointedRoom(
  context: CanvasRenderingContext2D,
  shown: Snapshot,
  tileSize: number,
): void {
  if (!roomLine) {
    return;
  }
  const id = pointedRoom(shown);
  const room = shown.extras.rooms?.[id];
  if (!room) {
    roomLine.textContent =
      'Point at a room, hall, cavern or part of a sewer to see what it is.';
    return;
  }
  const map = roomMapOf(shown);
  context.globalAlpha = 0.35;
  context.fillStyle = Color.BrightMagenta;
  map.forEach((owner, tile) => {
    if (owner === id) {
      context.fillRect(
        (tile % shown.grid.width) * tileSize,
        Math.floor(tile / shown.grid.width) * tileSize,
        tileSize,
        tileSize,
      );
    }
  });
  context.globalAlpha = 1;
  const exits = room.exits.map((index) => shown.extras.roomExits?.[index]);
  for (const exit of exits) {
    if (exit) {
      mark(context, exit.position, Color.BrightMagenta, tileSize);
    }
  }
  const group =
    room.group === undefined
      ? 'no group'
      : `group ${String(room.group)} (${shown.extras.roomGroups?.[room.group]?.kind ?? '?'})`;
  const shared = exits.filter((exit) => (exit?.rooms.length ?? 0) > 1).length;
  roomLine.textContent = [
    `${room.kind} ${String(room.id)}, ${group}, at (${String(room.x)}, ${String(room.y)}), ${String(room.width)} by ${String(room.height)}:`,
    `${String(room.exitCount)} exit(s), ${String(room.doorCount)} with a door, ${String(shared)} shared with another room (outlined).`,
  ].join(' ');
}

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

/** The prison on the lattice, which every step is given, on a map of odd size. */
const LATTICE_PRISON: CardSpec[] = [
  [
    'placeCellBlocks',
    { blocksMin: '1', blocksMax: '2', guardRoom: true, placement: 'lattice' },
  ],
  ['placeScatteredRooms', { placement: 'lattice' }],
  ['digCorridors', { placement: 'lattice' }],
];

/** A sewer, then rooms in the rock round it, joined by corridors that reach its walkways, and a way out at an outfall or two. */
const SEWER: CardSpec[] = [
  'digSewers',
  'placeScatteredRooms',
  'digCorridors',
  ['openExits', { at: 'outfalls' }],
];

/** The same with a cistern or two. */
const SEWER_WITH_CISTERNS: CardSpec[] = [
  ['digSewers', { cisternsMin: '1', cisternsMax: '2' }],
  ...SEWER.slice(1),
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

/** A room by the floor `createRoomMap` gives it, written on the center of its box. */
function roomPlace(name: string, room: Area, floor: Point[]): Place {
  const { x, y, width, height } = room;
  return {
    name,
    tiles: floor,
    center: { x: x + Math.floor(width / 2), y: y + Math.floor(height / 2) },
  };
}

function pointPlace(name: string, point: Point): Place {
  return { name, tiles: [point], center: point };
}

/**
 * The places the steps reported, to measure the walk between: rooms, halls
 * and caverns first, by their floor from `createRoomMap` and in the order of
 * their ids, then clearings by their centers, and exits.
 */
function placesOf(shown: Snapshot): Place[] {
  const { extras, grid } = shown;
  const floors: Point[][] = (extras.rooms ?? []).map(() => []);
  roomMapOf(shown).forEach((id, tile) => {
    const x = tile % grid.width;
    floors[id]?.push({ x, y: (tile - x) / grid.width });
  });
  return [
    ...(extras.rooms ?? []).map((room, id) =>
      roomPlace(`${room.kind} ${String(room.id)}`, room, floors[id] ?? []),
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
  // rooms only: the rooms, halls and caverns, which come first in `placesOf`
  const roomsOnly = show.get('between') === 'rooms';
  const places = placesOf(shown).slice(
    0,
    roomsOnly ? (shown.extras.rooms?.length ?? 0) : undefined,
  );
  const from = places[picked] ?? places[0];
  if (!from) {
    distanceLine.textContent = roomsOnly
      ? 'No rooms, halls or caverns to measure between.'
      : 'No rooms, halls, caverns, clearings or exits to measure between.';
    return;
  }
  const given = show.get('costs');
  const costs = typeof given === 'string' ? given.trim() : '';
  let row: number[];
  const started = performance.now();
  try {
    const options = {
      metric: show.get('metric') as DistanceMetric,
      costs: costs ? (JSON.parse(costs) as Partial<Record<Tile, number>>) : {},
    };
    const distances = roomsOnly
      ? measureRoomDistances(
          {
            grid: shown.grid,
            roomShapes: shown.extras.roomShapes ?? [],
          },
          options,
        )
      : measureDistances(
          shown.grid,
          places.map(({ tiles }) => tiles),
          options,
        );
    row = distances[places.indexOf(from)] ?? [];
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
    roomsOnly
      ? `Walking distances of measureRoomDistances from ${from.name}; click a room, hall or cavern to measure from it.`
      : `Walking distances of measureDistances from ${from.name}; click a room, hall, cavern, clearing or exit to measure from it.`,
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
    for (const { x, y, width, height } of (extras.rooms ?? []).filter(
      ({ kind }) => kind === 'pillarHall',
    )) {
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
    for (const { x, y, width, height } of (extras.roomGroups ?? []).flatMap(
      (group) => (group.kind === 'cave' ? [group.area] : []),
    )) {
      context.strokeRect(
        x * tileSize,
        y * tileSize,
        width * tileSize,
        height * tileSize,
      );
    }
  }
  if (show.has('showRooms')) {
    // an outline round the floor of every room, but the halls and caverns,
    // which have overlays of their own
    context.strokeStyle = Color.BrightGreen;
    context.lineWidth = Math.max(1, tileSize / 6);
    for (const { x, y, width, height } of (extras.rooms ?? []).filter(
      (room) => !isFeatureRoom(room),
    )) {
      context.strokeRect(
        x * tileSize,
        y * tileSize,
        width * tileSize,
        height * tileSize,
      );
    }
  }
  if (show.has('showSewers')) {
    // an outline round every chamber of a sewer, yellow, and every cistern,
    // cyan, and a mark on every mouth: red on the water, yellow on the wall it
    // meets, and green on the way out of every outfall
    context.lineWidth = Math.max(1, tileSize / 6);
    for (const { kind, x, y, width, height } of (extras.rooms ?? []).filter(
      ({ kind }) => kind === 'sewerChamber' || kind === 'cistern',
    )) {
      context.strokeStyle =
        kind === 'cistern' ? Color.BrightCyan : Color.BrightYellow;
      context.strokeRect(
        x * tileSize,
        y * tileSize,
        width * tileSize,
        height * tileSize,
      );
    }
    for (const group of extras.roomGroups ?? []) {
      if (group.kind === 'sewer') {
        for (const { position, wall } of group.mouths) {
          mark(context, position, Color.BrightRed, tileSize);
          if (wall) {
            mark(context, wall, Color.BrightYellow, tileSize);
          }
        }
        for (const { position } of group.outfalls) {
          mark(context, position, Color.BrightGreen, tileSize);
        }
      }
    }
  }
  if (show.has('showBlocks')) {
    // an outline round the footprint of every cell block, its tunnel and its
    // guard room, walls included, and a mark on its entrance
    context.strokeStyle = Color.BrightMagenta;
    context.lineWidth = Math.max(1, tileSize / 6);
    const blocks = (extras.roomGroups ?? []).flatMap((group) =>
      group.kind === 'cellBlock' ? [group] : [],
    );
    const guards = (extras.rooms ?? [])
      .filter(({ kind }) => kind === 'guardRoom')
      .map(({ x, y, width, height }) => ({
        x: x - 1,
        y: y - 1,
        width: width + 2,
        height: height + 2,
      }));
    const tunnels = blocks.flatMap(({ tunnel }) =>
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
      ...blocks.map(({ footprint }) => footprint),
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
    for (const { entrance } of blocks) {
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
  paintPointedRoom(context, shown, tileSize);
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
              rooms: extras.rooms,
              roomExits: extras.roomExits,
              roomGroups: extras.roomGroups,
              roomShapes: extras.roomShapes,
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
      'rooms',
      'roomExits',
      'roomGroups',
    ]
      .filter((name) => done[name])
      .map((name) => `${String(done[name]?.length)} ${name}`);
    // the regions of floor of the finished map, which says whether it is in one piece
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
document.querySelector('#load-sewer')?.addEventListener('click', () => {
  setWallCards(SEWER);
});
document
  .querySelector('#load-sewer-cisterns')
  ?.addEventListener('click', () => {
    setWallCards(SEWER_WITH_CISTERNS);
  });
document.querySelector('#load-prison')?.addEventListener('click', () => {
  setWallCards(PRISON);
});
document
  .querySelector('#load-lattice-prison')
  ?.addEventListener('click', () => {
    setDungeonSize();
    setWallCards(LATTICE_PRISON);
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
/** The tile of the map under the mouse. */
function tileAt(event: MouseEvent, grid: Grid): Point | undefined {
  if (!canvas) {
    return undefined;
  }
  const bounds = canvas.getBoundingClientRect();
  const x = Math.floor(
    ((event.clientX - bounds.left) / bounds.width) * grid.width,
  );
  const y = Math.floor(
    ((event.clientY - bounds.top) / bounds.height) * grid.height,
  );
  return grid.inBounds(x, y) ? { x, y } : undefined;
}
// a click on a place measures the walking distances from it
canvas?.addEventListener('click', (event) => {
  const shown = snapshots[Number(after?.value)];
  const tile = shown && tileAt(event, shown.grid);
  if (!shown || !tile) {
    return;
  }
  const index = placesOf(shown).findIndex(({ tiles }) =>
    tiles.some(({ x, y }) => tile.x === x && tile.y === y),
  );
  if (index !== -1) {
    picked = index;
    paint();
  }
});
// the room under the mouse is painted again only when it changes
canvas?.addEventListener('mousemove', (event) => {
  const shown = snapshots[Number(after?.value)];
  if (!shown) {
    return;
  }
  const was = pointedRoom(shown);
  pointed = tileAt(event, shown.grid);
  if (pointedRoom(shown) !== was) {
    paint();
  }
});
canvas?.addEventListener('mouseleave', () => {
  const shown = snapshots[Number(after?.value)];
  const was = shown ? pointedRoom(shown) : -1;
  pointed = undefined;
  if (was !== -1) {
    paint();
  }
});
download?.addEventListener('click', () => {
  if (canvas) {
    downloadCanvas(canvas, 'angstloch-steps.png');
  }
});
setCards(FOREST);
