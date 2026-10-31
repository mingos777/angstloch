import type { Area } from '../core/area';
import type { SewerCanal } from './sewer-canal';
import type { SewerMouth } from './sewer-mouth';
import type { SewerOutfall } from './sewer-outfall';

/** A sewer of `digSewers`: the group of its chambers and tunnels. */
export interface SewerGroup {
  kind: 'sewer';
  /** The box the sewer was dug in. */
  area: Area;
  /** Its canals, the trunk first. */
  canals: SewerCanal[];
  /** Every end of a canal, in the order of `canals`: the trunk has two, a branch one. */
  mouths: SewerMouth[];
  /** The ends of the trunk at the border of the map, each with the tile beside it where a way out may be opened. */
  outfalls: SewerOutfall[];
}
