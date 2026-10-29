import type { ClearingPathOptions } from './clearing-path-options';
import type { Clearing } from './clearing';

/** A clearing that `placeClearings` made: its shape, and the path that was asked to lead to it. */
export interface PlacedClearing extends Clearing {
  /** The path that was asked to lead to the clearing, with the defaults filled in, for the step that lays it. Left out when none was asked for, and for a clearing on a stream, where no path leads. */
  path?: Required<ClearingPathOptions>;
}
