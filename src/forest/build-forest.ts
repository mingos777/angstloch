import type { Point } from '../core/point';
import { retryPlacement } from '../rooms/templates/retry-placement';
import type { CrossingPlan } from '../streams/crossing-plan';
import { buildForestOnce } from './build-forest-once';
import type { ForestObserver } from './forest-observer';
import type { ForestOptions } from './forest-options';
import type { ForestResult } from './forest-result';

/**
 * Builds the forest of `generateForest`. A template that finds no place gets
 * a new forest, up to three in all, before a `TemplatePlacementError` is
 * thrown. `observer`, if given, is told the roads as they were grown and the
 * plans of their crossings, so that the playground and the checker can show
 * what the streams did to them. It hears only of the forest that is returned.
 */
export function buildForest(
  options: ForestOptions,
  observer?: ForestObserver,
): ForestResult {
  return retryPlacement(() => {
    const grown: Point[][] = [];
    const planned: CrossingPlan[] = [];
    const result = buildForestOnce(
      options,
      observer && {
        grown: (points) => grown.push(points),
        planned: (plan) => planned.push(plan),
      },
    );
    grown.forEach((points) => observer?.grown?.(points));
    planned.forEach((plan) => observer?.planned?.(plan));
    return result;
  });
}
