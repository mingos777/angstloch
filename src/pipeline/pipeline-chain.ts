import type { MapStep } from './map-step';

/** Any step, whatever it needs and adds. */
export type AnyStep = MapStep<never>;

/** The slot of a step that runs before the extras it needs exist, which makes the compile error say so. */
export interface StepOrderError<Missing extends string> {
  readonly 'this step needs extras that no earlier step adds': Missing;
}

/**
 * Checks a tuple of steps in order: each step's state parameter must accept
 * the base state plus everything the steps before it add. A step that does not
 * is replaced by a `StepOrderError` that names the missing extras, so the
 * argument fails to compile there. A plain array of steps is not checked.
 */
export type ValidChain<
  Acc,
  Steps extends readonly AnyStep[],
> = Steps extends readonly [
  infer First extends AnyStep,
  ...infer Rest extends readonly AnyStep[],
]
  ? readonly [
      Acc extends Parameters<First>[0]
        ? First
        : StepOrderError<
            Exclude<keyof Parameters<First>[0], keyof Acc> & string
          >,
      ...ValidChain<Acc & ReturnType<First>, Rest>,
    ]
  : Steps;

/** The state after a chain of steps: the start plus the extras every step adds. */
export type ChainState<
  Acc,
  Steps extends readonly AnyStep[],
> = Steps extends readonly [
  infer First extends AnyStep,
  ...infer Rest extends readonly AnyStep[],
]
  ? ChainState<Acc & ReturnType<First>, Rest>
  : Acc;
