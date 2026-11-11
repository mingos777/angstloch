import { TemplateCell } from '../src';
import type { Tile } from '../src';
import { CELL_ALIASES, codeLiteral } from './code-literal';

/** What the playground runs, to be written out as code. */
export interface MapCodeInput {
  width: number;
  height: number;
  tile: Tile;
  attempts: number;
  steps: readonly { name: string; options?: unknown }[];
  /** The seed of `mulberry32`, as defined in the README's quick start; left out, the code says where to add one. */
  seed?: number;
}

const WIDTH = 80;
/** The attempts of `pipeline` when it is given none. */
const DEFAULT_ATTEMPTS = 3;

/** The code that makes the map with `pipeline`, with the seed when it is given. */
export function mapCode({
  width,
  height,
  tile,
  attempts,
  steps,
  seed,
}: MapCodeInput): string {
  const used = new Set<TemplateCell>();
  const calls = steps.map(
    ({ name, options }) =>
      `    ${name}(${options === undefined ? '' : codeLiteral(options, 2, used)}),\n`,
  );
  const names = [
    'emptyMap',
    'pipeline',
    ...(used.size > 0 ? ['TemplateCell'] : []),
    'Tile',
    ...new Set(steps.map(({ name }) => name)),
  ];
  const imports = `import { ${names.join(', ')} } from 'angstloch';`;
  // the aliases of the cells used, in the order of their values
  const aliases = Object.entries(TemplateCell)
    .filter(([, cell]) => used.has(cell))
    .map(([name, cell]) => `${name}: ${CELL_ALIASES[cell]}`);
  // the options of pipeline, left out at their defaults
  const settings = [
    ...(seed === undefined ? [] : [`random: mulberry32(${String(seed)})`]),
    ...(attempts === DEFAULT_ATTEMPTS ? [] : [`attempts: ${String(attempts)}`]),
  ];
  return [
    imports.length <= WIDTH
      ? imports
      : `import {\n${names.map((name) => `  ${name},\n`).join('')}} from 'angstloch';`,
    '',
    ...(aliases.length > 0
      ? [`const { ${aliases.join(', ')} } = TemplateCell;`, '']
      : []),
    'const result = pipeline(',
    `  emptyMap(${codeLiteral({ width, height, tile }, 1, used)}),`,
    `  [\n${calls.join('')}  ],`,
    ...(seed === undefined
      ? ['  // add random: a seeded PRNG, to make the same map again']
      : []),
    ...(settings.length > 0 ? [`  { ${settings.join(', ')} },`] : []),
    ');',
    '',
  ].join('\n');
}
