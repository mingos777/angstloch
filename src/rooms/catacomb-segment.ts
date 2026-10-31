import type { Area } from '../core/area';

/** A segment of a catacomb of `digCatacombs`: a straight stretch of gallery. */
export interface CatacombSegment {
  /** The floor of the stretch, between the junctions, turns or dead ends at its ends, whose tiles belong to no segment. */
  floor: Area;
  /** Which way the gallery runs. */
  orientation: 'horizontal' | 'vertical';
  /** How many tiles wide the gallery is. */
  width: number;
  /** Whether it is a stretch of a main gallery, or else of a side gallery. */
  main: boolean;
  /** What the segment became: `'chambers'` when its walls are lined with burial chambers, at least one, `'niches'` when they are lined with niches, at least one, and `'bare'` when they are neither. */
  character: 'chambers' | 'niches' | 'bare';
}
