import type { PipelineFailure } from './pipeline-failure';

/** What `pipeline` adds to the final state. */
export interface PipelineSummary {
  /** The number of attempts it took, 1 or more. */
  attempts: number;
  /** One entry per failed attempt, also when a later attempt succeeded. */
  failures: PipelineFailure[];
}

/** The result of `pipeline`: the final state, its extras, and a summary. */
export type PipelineResult<State> = State & PipelineSummary;
