import type { LayoutSymmetry } from '../core/layout-symmetry';
import type { Range } from '../core/range';
import type { AreaSpec } from '../pipeline/area-spec';
import type { RoomTemplate } from '../rooms/templates/room-template';
import type { CatacombSegmentWeights } from './catacomb-segment-weights';

/** Options of `digCatacombs`. */
export interface DigCatacombsOptions {
  /** How many of the galleries are main galleries, a `Range` of whole numbers of at least 0. One is picked, and the main galleries are picked among the rows and columns of the lattice, the inner ones first. Defaults to `{ min: 1, max: 2 }`. */
  mainGalleries?: Range;
  /** The width of a main gallery in whole tiles of at least 1, drawn for each and cut down to what the area has room for. Defaults to `{ min: 2, max: 3 }`. */
  mainWidth?: Range;
  /** The width of a side gallery in whole tiles of at least 1, drawn for each. Defaults to `{ min: 1, max: 1 }`. */
  sideWidth?: Range;
  /** The rock between two galleries side by side in whole tiles of at least 1, drawn for each gap, besides the room for niches and chambers: when a segment may get niches, every gap is wider by twice the deepest niche, `nicheDepth.max`, and when it may get chambers, by twice the deepest chamber and its wall, `chamberSize.depth.max + 1`, whichever is wider. The lattice keeps that room from the ring of wall round it too. Defaults to `{ min: 1, max: 2 }`. */
  spacing?: Range;
  /** How likely each character of a segment is, a straight stretch of gallery between two junctions, turns or dead ends: `niches` lines its walls with niches, `chambers` with burial chambers, `bare` leaves them bare. Only the ratio matters, a missing weight is 0, and at least one must be above 0. A segment with no room for a chamber gets niches instead, and one with no room for a niche is bare. Defaults to `{ niches: 3, chambers: 1, bare: 1 }`. */
  segments?: CatacombSegmentWeights;
  /** How deep a niche is in whole tiles of at least 1, drawn for each niche and cut down to the rock it has. Defaults to `{ min: 1, max: 2 }`. */
  nicheDepth?: Range;
  /** The rock between two niches along a wall in whole tiles of at least 1, drawn for each segment. Defaults to `{ min: 1, max: 1 }`. */
  nicheSpacing?: Range;
  /** On how many sides of its gallery a segment with niches has them, a `Range` of whole numbers from 1 to 2, drawn for each segment; with one side, the side is drawn too. Defaults to `{ min: 1, max: 2 }`. */
  nicheSides?: Range;
  /** The size of a burial chamber's floor in whole tiles of at least 1: its `width` along its gallery, drawn for each segment, and its `depth` away from it, drawn for each chamber and cut down to the rock it has, but not below `depth.min`. Defaults to `{ width: { min: 3, max: 5 }, depth: { min: 2, max: 3 } }`. */
  chamberSize?: { width?: Range; depth?: Range };
  /** The rock between two chambers along a wall in whole tiles of at least 1, drawn for each segment; at 1 they share a wall. Defaults to `{ min: 1, max: 2 }`. */
  chamberSpacing?: Range;
  /** On how many sides of its gallery a segment with chambers has them, a `Range` of whole numbers from 1 to 2, drawn for each segment; with one side, the side is drawn too, and with two, the chambers face each other in pairs. Defaults to `{ min: 1, max: 2 }`. */
  chamberSides?: Range;
  /** The chance that the walls of a chamber are lined with niches, from 0 to 1, drawn for each chamber. The niches take `nicheDepth` and `nicheSpacing`, and are dug where the rock round the chamber has room for them. Defaults to 0.5. */
  chamberNicheChance?: number;
  /** The chance that a dead end of a gallery is closed by a burial chamber, its door in the end wall, from 0 to 1, drawn for each dead end with room for one. Defaults to 0.5. */
  deadEndChamberChance?: number;
  /** The chance that a stretch of side gallery between two crossings of the lattice is kept although the galleries are joined without it, making a loop, from 0 to 1. Defaults to 0.3. */
  loopChance?: number;
  /** The chance that a dead end is kept, from 0 to 1. A dead end that is not kept is joined to a gallery next to it. Defaults to 0.1. */
  deadEndChance?: number;
  /** Crypts: `RoomTemplate` objects placed in the area before the galleries, which route round them and enter them by passages from their exits. Their positions and areas are in the coordinates of the area. One that cannot be placed or joined fails the attempt. Defaults to none. */
  templates?: RoomTemplate[];
  /** Whether the crypts get mirror images, which follow `symmetry` always, whatever `symmetryChance` says: every copy of a template is only placed where its images fit too, and brings them along. It has no effect without a `symmetry`. Defaults to false. */
  templateSymmetry?: boolean;
  /** The chance that a way into a room gets a door, from 0 to 1: an `Exit` cell of a crypt, and an opened `OptionalExit` of a crypt or of a room placed before. A `Door` cell always gets one. Defaults to 1. */
  doorChance?: number;
  /** Mirrors or rotates the catacomb about the middle of its area: `'horizontal'` (left to right), `'vertical'` (top to bottom), `'both'` or `'rotational'` (by 180°). The lattice of galleries is always symmetric, as far as the free ground allows; its niches and chambers get twins by `symmetryChance`. Defaults to `'none'`. */
  symmetry?: LayoutSymmetry;
  /** How often a segment's niches and chambers get their twins, rolled once for a segment and its twins, and once for a dead end and its twins, from 0 (never) to 1 (always). Defaults to 1. */
  symmetryChance?: number;
  /** The size of the part of the map to dig in. Defaults to the whole map. A smaller area goes on a random free spot, and the catacomb is closed in by a ring of wall inside it. Its smallest size must hold two side galleries each way, with the room for their niches and chambers. */
  area?: AreaSpec;
}
