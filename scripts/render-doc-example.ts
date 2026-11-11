import { format, resolveConfig } from 'prettier';
import { emptyMap, pipeline } from '../src';
import type { AnyStep } from '../src';
import { mapCode } from '../demo/map-code';
import { mulberry32 } from '../src/test-helpers/mulberry32';
import type {
  DocExample,
  DocGeneratorExample,
  DocStepsExample,
} from './doc-example';
import { DOC_GENERATORS } from './doc-generators';
import { DOC_STEPS } from './doc-steps';
import { generatorCode } from './generator-code';

/** The seed of every example in the docs. */
const SEED = 1;
const DEFAULT_ATTEMPTS = 3;
/** The space between the maps before and after. */
const GAP = '    ';

/**
 * The Markdown of an example: its code, formatted as Prettier formats the
 * docs, and the map it makes, or the maps before and after its last step side
 * by side. With `mapOnly`, the map alone.
 */
export async function renderDocExample(example: DocExample): Promise<string> {
  const { code, map } =
    'generator' in example ? runGenerator(example) : runSteps(example);
  const block = ['```text', map, '```'];
  if (example.mapOnly) {
    return block.join('\n');
  }
  const config = (await resolveConfig('docs/example.ts')) ?? {};
  const formatted = await format(code, { ...config, parser: 'typescript' });
  return ['```ts', formatted.trimEnd(), '```', '', ...block].join('\n');
}

/** The code and the map of an example made by a preset. */
function runGenerator(example: DocGeneratorExample): {
  code: string;
  map: string;
} {
  const generate = DOC_GENERATORS[example.generator] as (options: object) => {
    grid: { toString(): string };
  };
  const { grid } = generate({ ...example.options, random: mulberry32(SEED) });
  return {
    code: generatorCode(example.generator, example.options, SEED),
    map: grid.toString(),
  };
}

/** The code and the map, or maps, of an example made by `pipeline`. */
function runSteps(example: DocStepsExample): { code: string; map: string } {
  const attempts = example.attempts ?? DEFAULT_ATTEMPTS;
  const steps = example.steps.map(({ name, options }) =>
    (DOC_STEPS[name] as (options: unknown) => AnyStep)(options),
  );
  const base = emptyMap({
    width: example.width,
    height: example.height,
    tile: example.tile,
  });
  let before = '';
  let index = 0;
  const result = pipeline(
    () => {
      // a new attempt starts here, so the map before is that of the last one
      const state = base();
      before = state.grid.toString();
      index = 0;
      return state;
    },
    steps,
    {
      random: mulberry32(SEED),
      attempts,
      onStep: (_name, state) => {
        ++index;
        if (index === steps.length - 1) {
          before = state.grid.toString();
        }
      },
    },
  );
  const after = result.grid.toString();

  const code = mapCode({
    width: example.width,
    height: example.height,
    tile: example.tile,
    attempts,
    steps: example.steps,
    seed: SEED,
  });
  const map = example.beforeAfter ? sideBySide(before, after) : after;
  return { code, map };
}

/** Two maps of the same size side by side, under the headings before and after. */
function sideBySide(before: string, after: string): string {
  const left = before.split('\n');
  const right = after.split('\n');
  const width = left[0]?.length ?? 0;
  return [
    `${'before'.padEnd(width)}${GAP}after`,
    ...left.map((row, y) => `${row}${GAP}${right[y] ?? ''}`),
  ].join('\n');
}
