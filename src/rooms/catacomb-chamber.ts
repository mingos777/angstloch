import type { CatacombSide } from './catacomb-side';

/** A burial chamber of a catacomb of `digCatacombs`: a room of kind `'burialChamber'` with one door onto a gallery. */
export interface CatacombChamber {
  /** Its id in `rooms`, where its floor is, and through its exit in `roomExits`, its door. */
  room: number;
  /** The index in `segments` of the segment its door opens onto. */
  segment: number;
  /** Which way the chamber lies from its gallery: a side of the gallery, or for a chamber at a dead end, the end it closes. */
  side: CatacombSide;
  /** Whether it closes a dead end of the gallery, its door in the end wall, rather than standing beside the gallery. */
  deadEnd: boolean;
}
