import type { Area } from '../core/area';
import type { CatacombChamber } from './catacomb-chamber';
import type { CatacombNiche } from './catacomb-niche';
import type { CatacombSegment } from './catacomb-segment';

/** A catacomb of `digCatacombs`: one section, with its galleries, niches, burial chambers and crypts. */
export interface CatacombGroup {
  kind: 'catacomb';
  /** The box the catacomb was dug in. */
  area: Area;
  /** The straight stretches of its galleries, each between two junctions, turns or dead ends. */
  segments: CatacombSegment[];
  /** Its niches, off its galleries and inside its chambers, in the order of their segments. */
  niches: CatacombNiche[];
  /** Its burial chambers, in the order of their segments. */
  chambers: CatacombChamber[];
  /** The ids in `rooms` of its crypts, the rooms made from its templates. */
  crypts: number[];
}
