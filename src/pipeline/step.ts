import { resolveRandom } from '../core/resolve-random';
import type { MapState } from './map-state';
import type { MapStep } from './map-step';
import type { StepContext } from './step-context';

type RequiredKeys<T> = {
  [K in keyof T]-?: object extends Pick<T, K> ? never : K;
}[keyof T] &
  string;

/** What a step declares about its extras. */
export interface StepSpec<Needs extends object, Adds extends object> {
  /** The extras that must be in the state, by name. Leave out the optional ones. */
  needs?: readonly RequiredKeys<Needs>[];
  /** The extras the step returns, by name. */
  adds?: readonly (keyof Adds & string)[];
  /**
   * Checks the step's options against the map, for what only the map can tell,
   * such as its size. `pipeline` calls it once, with a fresh base state,
   * before the first attempt, and whatever it throws is thrown at once and is
   * not retried. Throw a `RangeError` for a bad option.
   */
  validate?: (state: MapState) => void;
}

/**
 * Builds a named step. A pipeline checks `needs` against the `adds` of the
 * steps before it, and the step checks them again against the state when it
 * runs, so that a plain-JS caller gets a `TypeError` that names the step and
 * the missing extra. `run` always gets a context: the one the caller passed, with
 * `Math.random` as the fallback source of randomness.
 */
export function step<
  Needs extends object = object,
  Adds extends object = object,
>(
  name: string,
  spec: StepSpec<Needs, Adds>,
  run: (state: MapState & Needs, context: StepContext) => Adds,
): MapStep<Needs, Adds> {
  const needs: readonly string[] = spec.needs ?? [];
  const adds: readonly string[] = spec.adds ?? [];
  const mapStep = (
    state: MapState & Needs,
    context?: Partial<StepContext>,
  ): Adds => {
    for (const need of needs) {
      if ((state as Record<string, unknown>)[need] === undefined) {
        throw new TypeError(
          `Step "${name}" needs "${need}", which the map does not have yet`,
        );
      }
    }
    return run(state, {
      random: resolveRandom(context?.random),
      trace: context?.trace,
    });
  };
  return Object.assign(mapStep, {
    stepName: name,
    needs,
    adds,
    validate: spec.validate,
  });
}
