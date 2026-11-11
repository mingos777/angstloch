import type { Tile } from '../src';
import type { DOC_GENERATORS } from './doc-generators';
import type { DOC_STEPS } from './doc-steps';

type DocSteps = typeof DOC_STEPS;
type DocGenerators = typeof DOC_GENERATORS;

/** A step of an example: the name of a public step and its options, checked against the step. */
export type DocExampleStep = {
  [N in keyof DocSteps]: {
    name: N;
    options?: Parameters<DocSteps[N]>[0];
  };
}[keyof DocSteps];

/** What every example has. */
interface DocExampleBase {
  /** Shows the map alone, without its code, as the README does. */
  mapOnly?: boolean;
}

/** A map made by `pipeline` with seed 1, shown with its code. */
export interface DocStepsExample extends DocExampleBase {
  width: number;
  height: number;
  /** The tile of the empty map. */
  tile: Tile;
  /** As in `pipeline`; 3 when left out. */
  attempts?: number;
  steps: DocExampleStep[];
  /** Shows the map before the last step beside the map after it. */
  beforeAfter?: boolean;
}

/** A map made by a preset with seed 1, shown with its code: the name of the preset and its options but `random`. */
export type DocGeneratorExample = {
  [N in keyof DocGenerators]: DocExampleBase & {
    generator: N;
    options: Omit<Parameters<DocGenerators[N]>[0], 'random'>;
  };
}[keyof DocGenerators];

/** A map in the docs. */
export type DocExample = DocStepsExample | DocGeneratorExample;
