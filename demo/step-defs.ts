import {
  addClearingPaths,
  addFootbridges,
  addRoads,
  addStreams,
  placeClearings,
  placeTemplates,
  plantTrees,
} from '../src';
import type { AnyStep, ClearingSpec, RoadEntry } from '../src';
import { FOREST_TEMPLATES } from './forest-templates';
import {
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
];
