import type { Random } from '../core/random';

/** What a pipeline hands to every step. */
export interface StepContext {
  /** The source of randomness, shared by all steps of a run. */
  random: Random;
  /** Receives a step's internal data, for diagnostics. Absent unless the caller asked for it. */
  trace?: (name: string, data: unknown) => void;
}
