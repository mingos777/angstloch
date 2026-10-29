import type { Area } from '../core/area';

/** A cave of `digCellularCave` or `digNoiseCave`: the group of its caverns. */
export interface CaveGroup {
  kind: 'cave';
  /** The box the cave was dug in. */
  area: Area;
}
