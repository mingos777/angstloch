import { Tile } from '../src';

/** What the playground runs, to be written out as code. */
export interface MapCodeInput {
  width: number;
  height: number;
  tile: Tile;
  attempts: number;
  steps: readonly { name: string; options: unknown }[];
}

const WIDTH = 80;
const IDENTIFIER = /^[A-Za-z_$][\w$]*$/;

/** The name of a tile, as in `Tile.Grass`. */
function tileName(tile: number): string | undefined {
  return Object.entries(Tile).find(([, value]) => value === tile)?.[0];
}

/** A value as a JS literal, on one line when it fits, indented by `depth` levels. */
function literal(value: unknown, depth: number, key?: string): string {
  if (typeof value === 'string') {
    return `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
  }
  if (typeof value === 'number') {
    const name = key === 'tile' ? tileName(value) : undefined;
    return name ? `Tile.${name}` : String(value);
  }
  if (typeof value !== 'object' || value === null) {
    return String(value);
  }
  const entries = Array.isArray(value)
    ? value.map((item) => literal(item, depth + 1))
    : Object.entries(value)
        .filter(([, item]) => item !== undefined)
        .map(
          ([name, item]) =>
            `${IDENTIFIER.test(name) ? name : `'${name}'`}: ${literal(item, depth + 1, name)}`,
        );
  const [open, close] = Array.isArray(value) ? ['[', ']'] : ['{ ', ' }'];
  if (entries.length === 0) {
    return Array.isArray(value) ? '[]' : '{}';
  }
  const inline = `${open}${entries.join(', ')}${close}`;
  if (!inline.includes('\n') && depth * 2 + inline.length <= WIDTH) {
    return inline;
  }
  const pad = '  '.repeat(depth + 1);
  return `${open.trim()}\n${entries.map((entry) => `${pad}${entry},\n`).join('')}${'  '.repeat(depth)}${close.trim()}`;
}

/** The code that makes the map with `pipeline`, but for the seed. */
export function mapCode({
  width,
  height,
  tile,
  attempts,
  steps,
}: MapCodeInput): string {
  const names = [
    'emptyMap',
    'pipeline',
    'Tile',
    ...new Set(steps.map(({ name }) => name)),
  ];
  const imports = `import { ${names.join(', ')} } from 'angstloch';`;
  const calls = steps.map(
    ({ name, options }) =>
      `    ${name}(${options === undefined ? '' : literal(options, 2)}),\n`,
  );
  return [
    imports.length <= WIDTH
      ? imports
      : `import {\n${names.map((name) => `  ${name},\n`).join('')}} from 'angstloch';`,
    '',
    'const result = pipeline(',
    `  emptyMap(${literal({ width, height, tile }, 1)}),`,
    `  [\n${calls.join('')}  ],`,
    '  // add random: a seeded PRNG, to make the same map again',
    `  { attempts: ${String(attempts)} },`,
    ');',
    '',
  ].join('\n');
}
