/** One failed attempt of a pipeline. */
export interface PipelineFailure {
  /** The attempt that failed, counting from 1. */
  attempt: number;
  /** The name of the step that threw. */
  step: string;
  /** What it threw. */
  error: unknown;
}
