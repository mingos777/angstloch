import type { Random } from '../core/random';
import type { MapState } from './map-state';

/** Options of `pipeline`. */
export interface PipelineOptions {
  /** Source of randomness, shared by all steps and attempts. Defaults to `Math.random`. */
  random?: Random;
  /**
   * How many times the map is built from the start when a step throws.
   * Defaults to 3. An error that has `permanent` set, such as a
   * `TemplatePlacementError` that no other map could fix, is thrown at once.
   */
  attempts?: number;
  /** Called after every step with its name and the state, which is the live state, so copy what you keep. */
  onStep?: (name: string, state: MapState) => void;
  /** Receives what steps report through their context's `trace`. */
  trace?: (name: string, data: unknown) => void;
}
