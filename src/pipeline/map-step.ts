import type { MapState } from './map-state';
import type { StepContext } from './step-context';

/**
 * A step of a pipeline: a function that changes the map state in place and
 * returns the extras it adds (`streams`, `roads`...), which the pipeline merges
 * into the state. It can also be called by hand, and then the context is
 * optional and its random source defaults to `Math.random`.
 *
 * `Needs` is what the state must hold for the step to run, `Adds` what the
 * step returns. A need that is optional (`Partial<...>`) is something the step
 * uses when it is there.
 */
export interface MapStep<
  Needs extends object = object,
  Adds extends object = object,
> {
  (state: MapState & Needs, context?: Partial<StepContext>): Adds;
  /** The name of the step, which failure records and errors quote. */
  readonly stepName: string;
  /** The extras the state must hold, checked at run time. */
  readonly needs: readonly string[];
  /** The names of the extras the step returns. */
  readonly adds: readonly string[];
  /** Checks the options against the map before it is built, for what only the map can tell, such as its size. Throws to refuse it. */
  readonly validate?: (state: MapState) => void;
}
