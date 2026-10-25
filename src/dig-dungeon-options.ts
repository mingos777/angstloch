import type { DungeonOptions } from './dungeon-options';
import type { Range } from './range';
import type { SymmetryOptions } from './symmetry-options';

/** Options of `generateDigDungeon`. */
export interface DigDungeonOptions extends DungeonOptions, SymmetryOptions {
  /** Length of the corridor dug from a room or another corridor to the next room, in tiles. 0 puts the next room right against the wall of the room, with one door between them, which needs a `roomSpacing` of 1. With `lattice` placement lengths are rounded to what fits the lattice. Defaults to 1 to 8. */
  corridorLength?: Range;
  /** Chance that a new corridor branches off an existing corridor instead of a room, from 0 to 1. Defaults to 0.3. */
  branchChance?: number;
}
