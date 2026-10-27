import { TemplatePlacementError } from './template-placement-error';

/** Maps generated before a template that finds no place is reported as an error. */
const MAP_ATTEMPTS = 3;

/**
 * Builds a map, and builds a new one when a template finds no place in it, up
 * to `MAP_ATTEMPTS` maps in all. A template is requested because the map needs
 * it, so it is never left out. Once the last map fails, the error of the
 * last one is thrown, since the input is then at fault and not the map. Errors
 * that no other map could fix, such as a template too big for the map, are
 * thrown at once.
 */
export function retryPlacement<T>(build: () => T): T {
  for (let attempt = 1; ; ++attempt) {
    try {
      return build();
    } catch (error) {
      if (
        !(error instanceof TemplatePlacementError) ||
        error.permanent ||
        attempt === MAP_ATTEMPTS
      ) {
        throw error;
      }
    }
  }
}
