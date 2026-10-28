import {
  addClearingPaths,
  addExits,
  addFootbridges,
  addRoads,
  addStreams,
  carveCorridors,
  carveMaze,
  carveNoiseCave,
  digCaveTunnels,
  digFishbone,
  digPillarHalls,
  digRings,
  digVeins,
  growCave,
  growRooms,
  openMazeRooms,
  partitionRooms,
  placeClearings,
  placeMazeRooms,
  placeMineRooms,
  placeTemplates,
  plantTrees,
  scatterRooms,
} from '../src';
import type {
  AnyStep,
  CaveNeighborhood,
  CavePlacement,
  CaveTunnelStyle,
  ClearingSpec,
  CorridorSymmetry,
  LayoutSymmetry,
  MazeSymmetry,
  MineHallEntrances,
  MineRingShape,
  NoiseCaveShape,
  Placement,
  RoadEntry,
  RoomConnection,
  RoomTemplate,
} from '../src';
import { FOREST_TEMPLATES } from './forest-templates';
import {
  areaFields,
  check,
  json,
  number,
  pair,
  select,
  TILES,
  vergeFields,
} from './step-fields';
import type { Field, Values } from './step-fields';

/** A step that the playground can add, with the controls for its options. */
export interface StepDef {
  /** The name of the step, which is also the name of the function. */
  name: string;
  /** What the step does, in a few words. */
  summary: string;
  fields: Field[];
  /** Makes the step from the values of its controls. Throws for a bad option. */
  make: (values: Values) => AnyStep;
}

const POSITIVE = { min: '1' };
const FRACTION = { min: '0', max: '1', step: '0.05' };

/** The choices of a `LayoutSymmetry`. */
const SYMMETRIES = [
  ['none', 'none'],
  ['horizontal', 'horizontal'],
  ['vertical', 'vertical'],
  ['both', 'both'],
  ['rotational', 'rotational'],
] as const;

/** The fields that `growCave` and `carveNoiseCave` share. */
function caveFields(): Field[] {
  return [
    check('borderWalls', 'Border walls', true),
    select('symmetry', 'Symmetry', 'none', SYMMETRIES),
    number('symmetryChance', 'Symmetry chance', 1, FRACTION),
    number('minRegionSize', 'Min cavern size', 0, { min: '0' }),
    check('largestOnly', 'Largest cavern only', false),
    ...areaFields(),
    select('placement', 'Placement', 'free', [
      ['free', 'free'],
      ['beside', 'beside'],
      ['overlap', 'overlap'],
    ]),
  ];
}

/** The shared options of a cave step, from the controls of `caveFields`. */
function caveOptions(v: Values) {
  return {
    borderWalls: v.flag('borderWalls'),
    symmetry: v.text('symmetry') as LayoutSymmetry,
    symmetryChance: v.number('symmetryChance'),
    minRegionSize: v.number('minRegionSize'),
    largestOnly: v.flag('largestOnly'),
    area: v.area(),
    count: v.range('count'),
    placement: v.text('placement') as CavePlacement,
  };
}

/** The fields that `scatterRooms`, `partitionRooms` and `growRooms` share. */
function roomPlacementFields(): Field[] {
  return [
    select('placement', 'Placement', 'free', [
      ['free', 'free'],
      ['lattice', 'lattice'],
    ]),
    ...pair('roomWidth', 'Room width', 3, 7, POSITIVE),
    ...pair('roomHeight', 'Room height', 3, 7, POSITIVE),
    number('sizeUniformity', 'Size uniformity', 0, FRACTION),
    number('roomCountMin', 'Rooms min', 1, { min: '0' }),
    number('roomCountMax', 'Rooms max (blank: no limit)', '', { min: '0' }),
    number('roomSpacing', 'Room spacing', 1, POSITIVE),
    number('fill', 'Fill', 0.12, FRACTION),
    number('spacingUniformity', 'Spacing uniformity', 0, FRACTION),
    json('templates', 'Templates (JSON, as the template editor exports them)'),
    check('templateSymmetry', 'Mirror templates', false),
    number('doorChance', 'Door chance (templates)', 1, FRACTION),
    select('symmetry', 'Symmetry', 'none', SYMMETRIES),
    number('symmetryChance', 'Symmetry chance', 1, FRACTION),
    ...areaFields(),
  ];
}

/** The options of a room placement step, from the controls of `roomPlacementFields`, but its `spacingUniformity`, which `growRooms` has not. */
function roomPlacementOptions(v: Values) {
  return {
    placement: v.text('placement') as Placement,
    roomWidth: v.range('roomWidth'),
    roomHeight: v.range('roomHeight'),
    sizeUniformity: v.number('sizeUniformity'),
    roomCount: {
      min: v.number('roomCountMin'),
      max: v.optional('roomCountMax') ?? Number.MAX_SAFE_INTEGER,
    },
    roomSpacing: v.number('roomSpacing'),
    fill: v.number('fill'),
    templates: v.json('templates') as RoomTemplate[] | undefined,
    templateSymmetry: v.flag('templateSymmetry'),
    doorChance: v.number('doorChance'),
    symmetry: v.text('symmetry') as LayoutSymmetry,
    symmetryChance: v.number('symmetryChance'),
    area: v.area(),
    count: v.range('count'),
  };
}

export const STEP_DEFS: StepDef[] = [
  {
    name: 'plantTrees',
    summary: 'noise decides where ground cover grows',
    fields: [
      number('scaleX', 'Scale x', 40, POSITIVE),
      number('scaleY', 'Scale y', 40, POSITIVE),
      number('rotation', 'Rotation', 0, { step: '5' }),
      number('octaves', 'Octaves', 1, POSITIVE),
      number('persistence', 'Persistence', 0.2, FRACTION),
      number('lacunarity', 'Lacunarity', 1, { min: '0.1', step: '0.1' }),
      ...pair('density', 'Density', 0, 0.25, FRACTION),
      select('tile', 'Planted tile', '4', TILES),
    ],
    make: (v) =>
      plantTrees({
        scaleX: v.number('scaleX'),
        scaleY: v.number('scaleY'),
        rotation: v.number('rotation'),
        octaves: v.number('octaves'),
        persistence: v.number('persistence'),
        lacunarity: v.number('lacunarity'),
        density: v.range('density'),
        tile: v.tile('tile'),
      }),
  },
  {
    name: 'addStreams',
    summary: 'a stream or river, with tributaries',
    fields: [
      number('angle', 'Angle (blank: random)', '', { step: '5' }),
      ...pair('width', 'Width', 1, 3, POSITIVE),
      number('windiness', 'Windiness', 0.5, FRACTION),
      number('shoreWidth', 'Shore width', 1, { min: '0' }),
      check('spring', 'Spring', false),
      number('tributaries', 'Tributaries', 1, { min: '0' }),
      ...pair('tributaryWidth', 'Tributary width', 1, 1, POSITIVE),
      ...pair('tributaryAngle', 'Tributary angle', 30, 60, {
        min: '1',
        max: '179',
      }),
      number(
        'tributaryLength',
        'Tributary length (blank: to the edge)',
        '',
        POSITIVE,
      ),
      ...vergeFields(0, 2),
    ],
    make: (v) =>
      addStreams({
        angle: v.optional('angle') ?? 'random',
        width: v.range('width'),
        windiness: v.number('windiness'),
        shoreWidth: v.number('shoreWidth'),
        spring: v.flag('spring'),
        tributaries: v.fixed('tributaries'),
        tributaryWidth: v.range('tributaryWidth'),
        tributaryAngle: v.range('tributaryAngle'),
        tributaryLength: v.fixed('tributaryLength'),
        ...v.verge(),
      }),
  },
  {
    name: 'addRoads',
    summary: 'roads, crossings and branches; bends to cross streams',
    fields: [
      number('angle', 'Angle (blank: random)', '', { step: '5' }),
      ...pair('width', 'Width', 3, 3, POSITIVE),
      number('windiness', 'Windiness', 0.3, FRACTION),
      number('crossings', 'Crossings', 0, { min: '0' }),
      ...pair('crossingAngle', 'Crossing angle', 45, 90, {
        min: '1',
        max: '179',
      }),
      number('branches', 'Branches', 0, { min: '0' }),
      ...pair('branchWidth', 'Branch width', 1, 1, POSITIVE),
      ...pair('branchAngle', 'Branch angle', 20, 70, { min: '1', max: '179' }),
      number(
        'branchLength',
        'Branch length (blank: to the edge)',
        '',
        POSITIVE,
      ),
      ...pair('bridgeAngle', 'Bridge angle', 75, 90, { min: '1', max: '179' }),
      ...vergeFields(1, 2),
      json('specs', 'Exact roads (JSON, blank: generated)'),
    ],
    make: (v) =>
      addRoads({
        angle: v.optional('angle') ?? 'random',
        width: v.range('width'),
        windiness: v.number('windiness'),
        crossings: v.fixed('crossings'),
        crossingAngle: v.range('crossingAngle'),
        branches: v.fixed('branches'),
        branchWidth: v.range('branchWidth'),
        branchAngle: v.range('branchAngle'),
        branchLength: v.fixed('branchLength'),
        bridgeAngle: v.range('bridgeAngle'),
        specs: v.json('specs') as RoadEntry[] | undefined,
        ...v.verge(),
      }),
  },
  {
    name: 'placeClearings',
    summary: 'glades with ragged edges, free of trees',
    fields: [
      number('random', 'Random clearings', 2, { min: '0' }),
      number('branchEnds', 'At branch ends', 0, { min: '0' }),
      number('onStreams', 'On streams', 0, { min: '0' }),
      ...pair('radius', 'Radius', 4, 7, POSITIVE),
      number('irregularity', 'Irregularity', 0.5, FRACTION),
      check('path', 'Ask for a path', false),
      number('pathWidth', 'Path width', 1, POSITIVE),
      number('pathWindiness', 'Path windiness', 0.3, FRACTION),
      number('spacing', 'Spacing', 2, { min: '0' }),
      number('falloff', 'Falloff', 3, { min: '0' }),
      select('distance', 'Distance', 'chebyshev', [
        ['chebyshev', 'chebyshev'],
        ['manhattan', 'manhattan'],
        ['euclidean', 'euclidean'],
      ]),
      json('exact', 'Exact clearings (JSON, added first)'),
    ],
    make: (v) => {
      const shape = {
        radiusX: v.range('radius'),
        irregularity: v.number('irregularity'),
        path: v.flag('path')
          ? {
              width: v.number('pathWidth'),
              windiness: v.number('pathWindiness'),
            }
          : undefined,
      };
      const several = (count: number, at?: 'branch-end' | 'stream') =>
        Array.from({ length: count }, (): ClearingSpec => ({ at, ...shape }));
      return placeClearings({
        clearings: [
          ...((v.json('exact') as ClearingSpec[] | undefined) ?? []),
          ...several(v.number('random')),
          ...several(v.number('branchEnds'), 'branch-end'),
          ...several(v.number('onStreams'), 'stream'),
        ],
        spacing: v.number('spacing'),
        falloff: v.number('falloff'),
        distance: v.verge().distance,
      });
    },
  },
  {
    name: 'placeTemplates',
    summary: 'a ruin, a camp or an arena',
    fields: [
      select('kind', 'Template', 'ruin', [
        ['ruin', 'ruin'],
        ['camp', 'camp'],
        ['arena', 'arena'],
      ]),
      ...pair('count', 'Count', 1, 1, { min: '0' }),
      number('chance', 'Chance', 1, FRACTION),
      number('margin', 'Margin', 3, { min: '0' }),
      check('clearing', 'Needs a clearing', true),
      select('distance', 'Distance', 'chebyshev', [
        ['chebyshev', 'chebyshev'],
        ['manhattan', 'manhattan'],
        ['euclidean', 'euclidean'],
      ]),
    ],
    make: (v) =>
      placeTemplates({
        templates: [
          {
            ...(FOREST_TEMPLATES[v.text('kind')] ?? { cells: [] }),
            count: v.range('count'),
            chance: v.number('chance'),
            margin: v.number('margin'),
            clearing: v.flag('clearing'),
          },
        ],
        distance: v.verge().distance,
      }),
  },
  {
    name: 'addClearingPaths',
    summary: 'the paths that clearings asked for',
    fields: vergeFields(1, 2),
    make: (v) => addClearingPaths(v.verge()),
  },
  {
    name: 'addFootbridges',
    summary: 'footbridges that join land the water cuts apart',
    fields: [number('minimum', 'At least this many bridges', 0, { min: '0' })],
    make: (v) => addFootbridges({ minimum: v.number('minimum') }),
  },
  {
    name: 'digFishbone',
    summary:
      'a main shaft with side tunnels branching off it (needs a wall map)',
    fields: [
      number('density', 'Density', 0.15, FRACTION),
      ...pair('shaftWidth', 'Shaft width', 2, 3, POSITIVE),
      number('shaftWindiness', 'Shaft windiness', 0.1, FRACTION),
      number('angle', 'Angle (blank: random)', '', { step: '5' }),
      ...pair('aditWidth', 'Adit width', 1, 2, POSITIVE),
      number('aditWindiness', 'Adit windiness', 0.4, FRACTION),
      ...pair('aditLength', 'Adit length', 15, 50, POSITIVE),
      ...pair('branchAngle', 'Branch angle', 45, 90, {
        min: '1',
        max: '179',
      }),
      number('loops', 'Loops', 0, FRACTION),
      ...areaFields(),
    ],
    make: (v) =>
      digFishbone({
        density: v.number('density'),
        shaftWidth: v.range('shaftWidth'),
        shaftWindiness: v.number('shaftWindiness'),
        angle: v.optional('angle') ?? 'random',
        aditWidth: v.range('aditWidth'),
        aditWindiness: v.number('aditWindiness'),
        aditLength: v.range('aditLength'),
        branchAngle: v.range('branchAngle'),
        loops: v.number('loops'),
        area: v.area(),
        count: v.range('count'),
      }),
  },
  {
    name: 'digVeins',
    summary: 'a web of winding tunnels between junctions (needs a wall map)',
    fields: [
      number('density', 'Density', 0.15, FRACTION),
      ...pair('veinWidth', 'Vein width', 1, 2, POSITIVE),
      number('veinWindiness', 'Vein windiness', 0.5, FRACTION),
      number('veinSpacing', 'Vein spacing', 16, { min: '3' }),
      ...areaFields(),
    ],
    make: (v) =>
      digVeins({
        density: v.number('density'),
        veinWidth: v.range('veinWidth'),
        veinWindiness: v.number('veinWindiness'),
        veinSpacing: v.number('veinSpacing'),
        area: v.area(),
        count: v.range('count'),
      }),
  },
  {
    name: 'digPillarHalls',
    summary:
      'large halls with pillars left standing, joined by veins (needs a wall map)',
    fields: [
      number('density', 'Density', 0.35, FRACTION),
      ...pair('halls', 'Halls', 2, 4, POSITIVE),
      ...pair('hallVeins', 'Hall veins', 2, 4, POSITIVE),
      select('hallEntrances', 'Hall entrances', 'facing', [
        ['facing', 'facing'],
        ['edge', 'edge'],
      ]),
      number('hallSizeMin', 'Hall size min (blank: density)', '', POSITIVE),
      number('hallSizeMax', 'Hall size max (blank: density)', '', POSITIVE),
      number('hallRagged', 'Hall ragged', 0.5, FRACTION),
      ...pair('pillarSize', 'Pillar size', 2, 5, POSITIVE),
      ...pair('pillarSpacing', 'Pillar spacing', 2, 4, POSITIVE),
      number('pillarRagged', 'Pillar ragged', 0.5, FRACTION),
      number('pillarJitter', 'Pillar jitter', 0.5, FRACTION),
      ...pair('veinWidth', 'Vein width', 1, 2, POSITIVE),
      number('veinWindiness', 'Vein windiness', 0.5, FRACTION),
      ...areaFields(),
    ],
    make: (v) =>
      digPillarHalls({
        density: v.number('density'),
        halls: v.range('halls'),
        hallVeins: v.range('hallVeins'),
        hallEntrances: v.text('hallEntrances') as MineHallEntrances,
        hallSize: v.optionalRange('hallSize'),
        hallRagged: v.number('hallRagged'),
        pillarSize: v.range('pillarSize'),
        pillarSpacing: v.range('pillarSpacing'),
        pillarRagged: v.number('pillarRagged'),
        pillarJitter: v.number('pillarJitter'),
        veinWidth: v.range('veinWidth'),
        veinWindiness: v.number('veinWindiness'),
        area: v.area(),
        count: v.range('count'),
      }),
  },
  {
    name: 'digRings',
    summary: 'concentric rings joined by spokes (needs a wall map)',
    fields: [
      number('density', 'Density', 0.3, FRACTION),
      number('ringsMin', 'Rings min (blank: density)', '', POSITIVE),
      number('ringsMax', 'Rings max (blank: density)', '', POSITIVE),
      select('ringShape', 'Ring shape', 'oval', [
        ['oval', 'oval'],
        ['circle', 'circle'],
      ]),
      ...pair('ringWidth', 'Ring width', 2, 3, POSITIVE),
      number('ringWobble', 'Ring wobble', 0.5, FRACTION),
      ...pair('spokes', 'Spokes', 1, 3, { min: '0' }),
      ...pair('veinWidth', 'Spoke width', 1, 2, POSITIVE),
      number('veinWindiness', 'Spoke windiness', 0.5, FRACTION),
      ...areaFields(),
    ],
    make: (v) =>
      digRings({
        density: v.number('density'),
        rings: v.optionalRange('rings'),
        ringShape: v.text('ringShape') as MineRingShape,
        ringWidth: v.range('ringWidth'),
        ringWobble: v.number('ringWobble'),
        spokes: v.range('spokes'),
        veinWidth: v.range('veinWidth'),
        veinWindiness: v.number('veinWindiness'),
        area: v.area(),
        count: v.range('count'),
      }),
  },
  {
    name: 'placeMineRooms',
    summary:
      'rooms beside the floor, joined to it by tunnels (needs a wall map)',
    fields: [
      ...pair('roomCount', 'Rooms', 1, 1, { min: '0' }),
      ...pair('roomWidth', 'Room width', 3, 7, POSITIVE),
      ...pair('roomHeight', 'Room height', 3, 7, POSITIVE),
      number('sizeUniformity', 'Size uniformity', 0, FRACTION),
      json(
        'templates',
        'Templates (JSON, as the template editor exports them)',
      ),
      ...pair('exitsPerRoom', 'Exits per room', 1, 3, POSITIVE),
      number('doorChance', 'Door chance', 1, FRACTION),
      ...pair('veinWidth', 'Tunnel width', 1, 2, POSITIVE),
      number('veinWindiness', 'Tunnel windiness', 0.5, FRACTION),
    ],
    make: (v) =>
      placeMineRooms({
        roomCount: v.range('roomCount'),
        roomWidth: v.range('roomWidth'),
        roomHeight: v.range('roomHeight'),
        sizeUniformity: v.number('sizeUniformity'),
        templates: v.json('templates') as RoomTemplate[] | undefined,
        exitsPerRoom: v.range('exitsPerRoom'),
        doorChance: v.number('doorChance'),
        veinWidth: v.range('veinWidth'),
        veinWindiness: v.number('veinWindiness'),
      }),
  },
  {
    name: 'growCave',
    summary:
      'caverns grown from random noise by a cellular automaton (needs a wall map)',
    fields: [
      number('fillChance', 'Fill chance', 0.45, FRACTION),
      number('iterations', 'Iterations', 4, { min: '0' }),
      select('neighborhood', 'Neighborhood', 'moore', [
        ['moore', 'moore'],
        ['von-neumann', 'von Neumann'],
      ]),
      number('birthLimit', 'Birth limit (blank: default)', '', { min: '0' }),
      number('survivalLimit', 'Survival limit (blank: default)', '', {
        min: '0',
      }),
      ...caveFields(),
    ],
    make: (v) =>
      growCave({
        fillChance: v.number('fillChance'),
        iterations: v.number('iterations'),
        neighborhood: v.text('neighborhood') as CaveNeighborhood,
        birthLimit: v.optional('birthLimit'),
        survivalLimit: v.optional('survivalLimit'),
        ...caveOptions(v),
      }),
  },
  {
    name: 'carveNoiseCave',
    summary: 'caverns where the noise is high (needs a wall map)',
    fields: [
      select('shape', 'Shape', 'blobs', [
        ['blobs', 'blobs'],
        ['veins', 'veins'],
      ]),
      number('fill', 'Fill', 0.45, FRACTION),
      number('cornerBias', 'Corner bias', 4, { min: '0' }),
      number('scaleX', 'Scale x', 12, POSITIVE),
      number('scaleY', 'Scale y', 12, POSITIVE),
      number('rotation', 'Rotation', 0, { step: '5' }),
      number('octaves', 'Octaves', 3, POSITIVE),
      number('persistence', 'Persistence', 0.5, FRACTION),
      number('lacunarity', 'Lacunarity', 2, { min: '1', step: '0.1' }),
      number('iterations', 'Smoothing passes', 0, { min: '0' }),
      ...caveFields(),
    ],
    make: (v) =>
      carveNoiseCave({
        shape: v.text('shape') as NoiseCaveShape,
        fill: v.number('fill'),
        cornerBias: v.number('cornerBias'),
        scaleX: v.number('scaleX'),
        scaleY: v.number('scaleY'),
        rotation: v.number('rotation'),
        octaves: v.number('octaves'),
        persistence: v.number('persistence'),
        lacunarity: v.number('lacunarity'),
        iterations: v.number('iterations'),
        ...caveOptions(v),
      }),
  },
  {
    name: 'digCaveTunnels',
    summary:
      'tunnels that join every piece of floor into one, round reserved tiles (needs a wall map)',
    fields: [
      select('style', 'Style', 'winding', [
        ['winding', 'winding'],
        ['direct', 'direct'],
      ]),
      number('width', 'Width', 1, POSITIVE),
      number('windiness', 'Windiness', 0.5, FRACTION),
      number('loops', 'Loops', 0, FRACTION),
      check('borderWalls', 'Border walls', true),
      select('symmetry', 'Symmetry', 'none', SYMMETRIES),
      number('symmetryChance', 'Symmetry chance', 1, FRACTION),
    ],
    make: (v) =>
      digCaveTunnels({
        style: v.text('style') as CaveTunnelStyle,
        width: v.number('width'),
        windiness: v.number('windiness'),
        loops: v.number('loops'),
        borderWalls: v.flag('borderWalls'),
        symmetry: v.text('symmetry') as LayoutSymmetry,
        symmetryChance: v.number('symmetryChance'),
      }),
  },
  {
    name: 'placeMazeRooms',
    summary:
      'rooms on the lattice of a maze, not opened yet (needs a wall map)',
    fields: [
      ...pair('roomCount', 'Rooms', 1, 1, { min: '0' }),
      ...pair('roomWidth', 'Room width', 3, 7, POSITIVE),
      ...pair('roomHeight', 'Room height', 3, 7, POSITIVE),
      number('sizeUniformity', 'Size uniformity', 0, FRACTION),
      json(
        'templates',
        'Templates (JSON, as the template editor exports them)',
      ),
      number('doorChance', 'Door chance', 1, FRACTION),
      number('keepClearX', 'Keep clear x (blank: none)', '', { min: '0' }),
      number('keepClearY', 'Keep clear y (blank: none)', '', { min: '0' }),
      ...areaFields(false),
    ],
    make: (v) => {
      const x = v.optional('keepClearX');
      const y = v.optional('keepClearY');
      return placeMazeRooms({
        roomCount: v.range('roomCount'),
        roomWidth: v.range('roomWidth'),
        roomHeight: v.range('roomHeight'),
        sizeUniformity: v.number('sizeUniformity'),
        templates: v.json('templates') as RoomTemplate[] | undefined,
        doorChance: v.number('doorChance'),
        keepClear: x === undefined || y === undefined ? undefined : { x, y },
        area: v.area(),
      });
    },
  },
  {
    name: 'carveMaze',
    summary:
      'a maze carved round what is there, by the recursive backtracker (needs a wall map)',
    fields: [
      number('horizontalBias', 'Horizontal bias', 0, { min: '0' }),
      number('verticalBias', 'Vertical bias', 0, { min: '0' }),
      number('loopChance', 'Loop chance', 0, FRACTION),
      number('fill', 'Fill', 1, FRACTION),
      number('straight', 'Straight', 0, FRACTION),
      select('pattern', 'Pattern', 'none', [
        ['none', 'none'],
        ['whirlpool', 'whirlpool'],
        ['snowflake', 'snowflake'],
      ]),
      number('patternChance', 'Pattern chance', 1, FRACTION),
      number('startX', 'Start x (blank: middle)', '', { min: '1' }),
      number('startY', 'Start y (blank: middle)', '', { min: '1' }),
      ...areaFields(),
    ],
    make: (v) => {
      const x = v.optional('startX');
      const y = v.optional('startY');
      return carveMaze({
        horizontalBias: v.number('horizontalBias'),
        verticalBias: v.number('verticalBias'),
        loopChance: v.number('loopChance'),
        fill: v.number('fill'),
        straight: v.number('straight'),
        pattern: v.text('pattern') as MazeSymmetry,
        patternChance: v.number('patternChance'),
        start: x === undefined || y === undefined ? undefined : { x, y },
        area: v.area(),
        count: v.range('count'),
      });
    },
  },
  {
    name: 'openMazeRooms',
    summary: 'openings from the rooms onto the maze round them',
    fields: [
      ...pair('exitsPerRoom', 'Exits per room', 1, 3, POSITIVE),
      number('doorChance', 'Door chance', 1, FRACTION),
    ],
    make: (v) =>
      openMazeRooms({
        exitsPerRoom: v.range('exitsPerRoom'),
        doorChance: v.number('doorChance'),
      }),
  },
  {
    name: 'scatterRooms',
    summary:
      'dungeon rooms tried at random spots, not opened yet (needs a wall map)',
    fields: roomPlacementFields(),
    make: (v) =>
      scatterRooms({
        ...roomPlacementOptions(v),
        spacingUniformity: v.number('spacingUniformity'),
      }),
  },
  {
    name: 'partitionRooms',
    summary:
      'dungeon rooms, one in each part of a binary space partition, not opened yet (needs a wall map)',
    fields: roomPlacementFields(),
    make: (v) =>
      partitionRooms({
        ...roomPlacementOptions(v),
        spacingUniformity: v.number('spacingUniformity'),
      }),
  },
  {
    name: 'growRooms',
    summary:
      'dungeon rooms grown from a seed, each beyond the wall of another, not opened yet (needs a wall map)',
    fields: [
      ...pair('gap', 'Gap', 1, 8, { min: '0' }),
      number('horizontalBias', 'Horizontal bias', 0, { min: '0' }),
      number('verticalBias', 'Vertical bias', 0, { min: '0' }),
      ...roomPlacementFields().filter(({ key }) => key !== 'spacingUniformity'),
    ],
    make: (v) =>
      growRooms({
        ...roomPlacementOptions(v),
        gap: v.range('gap'),
        horizontalBias: v.number('horizontalBias'),
        verticalBias: v.number('verticalBias'),
      }),
  },
  {
    name: 'carveCorridors',
    summary:
      'corridors and doors that join the rooms, dropping rooms that cannot be joined',
    fields: [
      select('connection', 'Connection', 'nearest', [
        ['nearest', 'nearest'],
        ['bsp', 'bsp'],
        ['bsp-random', 'bsp-random'],
      ]),
      ...pair('exitsPerRoom', 'Exits per room', 1, 3, POSITIVE),
      number('loopChance', 'Loop chance', 0.1, FRACTION),
      number('deadEndChance', 'Dead end chance', 0, FRACTION),
      number('doorChance', 'Door chance', 1, FRACTION),
      number('straight', 'Straight', 0.5, FRACTION),
      number('horizontalBias', 'Horizontal bias', 0, { min: '0' }),
      number('verticalBias', 'Vertical bias', 0, { min: '0' }),
      select('placement', 'Placement', 'free', [
        ['free', 'free'],
        ['lattice', 'lattice'],
      ]),
      select('symmetry', 'Symmetry', 'none', SYMMETRIES),
      number('symmetryChance', 'Symmetry chance', 1, FRACTION),
      select('corridorSymmetry', 'Corridor symmetry', 'none', [
        ['none', 'none'],
        ['whirlpool', 'whirlpool'],
        ['snowflake', 'snowflake'],
      ]),
      number('corridorSymmetryChance', 'Corridor symmetry chance', 1, FRACTION),
    ],
    make: (v) =>
      carveCorridors({
        connection: v.text('connection') as RoomConnection,
        exitsPerRoom: v.range('exitsPerRoom'),
        loopChance: v.number('loopChance'),
        deadEndChance: v.number('deadEndChance'),
        doorChance: v.number('doorChance'),
        straight: v.number('straight'),
        horizontalBias: v.number('horizontalBias'),
        verticalBias: v.number('verticalBias'),
        placement: v.text('placement') as Placement,
        symmetry: v.text('symmetry') as LayoutSymmetry,
        symmetryChance: v.number('symmetryChance'),
        corridorSymmetry: v.text('corridorSymmetry') as CorridorSymmetry,
        corridorSymmetryChance: v.number('corridorSymmetryChance'),
      }),
  },
  {
    name: 'addExits',
    summary: 'doors on the border, with tunnels to the nearest floor',
    fields: [
      ...pair('count', 'Exits', 1, 2, { min: '0' }),
      check('lattice', 'Odd coordinates only (maze)', false),
      select('symmetry', 'Symmetry', 'none', SYMMETRIES),
      number('symmetryChance', 'Symmetry chance', 1, FRACTION),
      select('tile', 'Door tile', '2', [
        ['2', 'door'],
        ['1', 'floor'],
      ]),
    ],
    make: (v) =>
      addExits({
        count: v.range('count'),
        lattice: v.flag('lattice'),
        symmetry: v.text('symmetry') as LayoutSymmetry,
        symmetryChance: v.number('symmetryChance'),
        tile: v.tile('tile'),
      }),
  },
];
