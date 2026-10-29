import { resolveRandom } from '../core/resolve-random';
import type { MapBase } from './map-base';
import type { MapState } from './map-state';
import type { AnyStep, ChainState, ValidChain } from './pipeline-chain';
import type { PipelineFailure } from './pipeline-failure';
import type { PipelineOptions } from './pipeline-options';
import type { PipelineResult } from './pipeline-result';

const DEFAULT_ATTEMPTS = 3;

/**
 * Builds a map: runs the steps in order on a fresh base and merges the extras
 * each one returns into the state (a later `roads` replaces an earlier one).
 * When a step throws, the map is built again from the start, up to `attempts`
 * times; every failure is reported in `failures`, and the last error is thrown
 * once the attempts run out.
 *
 * The order of the steps is checked against what they need, at compile time for
 * a literal list of steps, and before the first attempt at run time, with a
 * `TypeError` that names the step and the missing extra.
 */
export function pipeline<const S extends readonly AnyStep[]>(
  base: MapBase,
  steps: S & ValidChain<MapState, S>,
  options: PipelineOptions = {},
): PipelineResult<ChainState<MapState, S>> {
  const attempts = options.attempts ?? DEFAULT_ATTEMPTS;
  if (!Number.isInteger(attempts) || attempts < 1) {
    throw new RangeError(
      `attempts must be an integer >= 1, got ${String(attempts)}`,
    );
  }
  assertOrder(steps);
  // what only the map can tell is checked before any attempt, with no retry
  const probe = base();
  for (const mapStep of steps) {
    mapStep.validate?.(probe);
  }

  const random = resolveRandom(options.random);
  const context = { random, trace: options.trace };
  const failures: PipelineFailure[] = [];

  for (let attempt = 1; ; ++attempt) {
    const state = base() as MapState & Record<string, unknown>;
    let current = '';
    try {
      for (const mapStep of steps) {
        current = mapStep.stepName;
        Object.assign(state, mapStep(state as never, context));
        options.onStep?.(current, state);
      }
    } catch (error) {
      failures.push({ attempt, step: current, error });
      if (isPermanent(error) || attempt === attempts) {
        throw error;
      }
      continue;
    }
    return { ...state, attempts: attempt, failures } as PipelineResult<
      ChainState<MapState, S>
    >;
  }
}

/** Throws a `TypeError` for the first step that needs an extra no earlier step adds. */
function assertOrder(steps: readonly AnyStep[]): void {
  const available = new Set<string>();
  for (const mapStep of steps) {
    for (const need of mapStep.needs) {
      if (!available.has(need)) {
        throw new TypeError(
          `Step "${mapStep.stepName}" needs "${need}", which no step before it adds`,
        );
      }
    }
    for (const added of mapStep.adds) {
      available.add(added);
    }
  }
}

/** Whether the error says that no other map could fix it, like a `TemplatePlacementError` that is `permanent`. */
function isPermanent(error: unknown): boolean {
  return (
    error instanceof Error &&
    'permanent' in error &&
    (error as { permanent: unknown }).permanent === true
  );
}
