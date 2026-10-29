import type { Area } from '../core/area';

/** The halls that `digPillarHalls` dug in one area: the group of its halls. */
export interface PillarHallsGroup {
  kind: 'pillarHalls';
  /** The box the halls were dug in. */
  area: Area;
}
