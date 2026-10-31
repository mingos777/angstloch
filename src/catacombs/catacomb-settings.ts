import type { LayoutSymmetry } from '../core/layout-symmetry';
import type { Range } from '../core/range';
import type { RoomTemplate } from '../rooms/templates/room-template';

/** The options of `digCatacombs` that shape the catacomb, with their defaults filled in. */
export interface CatacombSettings {
  mainGalleries: Range;
  mainWidth: Range;
  sideWidth: Range;
  spacing: Range;
  loopChance: number;
  deadEndChance: number;
  /** The weights of the characters of a segment, every one filled in. */
  segments: { niches: number; chambers: number; bare: number };
  nicheDepth: Range;
  nicheSpacing: Range;
  nicheSides: Range;
  /** The size of a chamber along its gallery. */
  chamberWidth: Range;
  /** The size of a chamber away from its gallery. */
  chamberDepth: Range;
  chamberSpacing: Range;
  chamberSides: Range;
  chamberNicheChance: number;
  deadEndChamberChance: number;
  templates: RoomTemplate[];
  templateSymmetry: boolean;
  doorChance: number;
  symmetry: LayoutSymmetry;
  symmetryChance: number;
}
