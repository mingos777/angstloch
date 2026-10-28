import type { StreamLayout } from './stream-layout';

/** The streams of a map and the water they make. */
export interface LaidStreams extends StreamLayout {
  /** One byte per tile, row by row: 1 where the water is deep. */
  deep: Uint8Array;
}
