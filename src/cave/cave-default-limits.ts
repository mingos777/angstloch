import type { CaveNeighborhood } from './cave-neighborhood';

/** The birth and survival limits of the automaton for each neighborhood. */
export const CAVE_DEFAULT_LIMITS: Record<
  CaveNeighborhood,
  { birthLimit: number; survivalLimit: number }
> = {
  moore: { birthLimit: 5, survivalLimit: 4 },
  'von-neumann': { birthLimit: 3, survivalLimit: 2 },
};
