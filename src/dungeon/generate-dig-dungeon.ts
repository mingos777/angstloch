import { buildDigDungeon } from './build-dig-dungeon';
import type { DungeonResult } from './dungeon-result';
import { retryPlacement } from '../rooms/templates/retry-placement';
import type { DigDungeonOptions } from './dig-dungeon-options';

/**
 * Generates a dungeon by digging: it starts with a room in the middle and
 * keeps digging a corridor from a room or from another corridor, and putting a
 * room at the end of it, until there are enough rooms. Corridors that find no
 * space for a room are filled in again. Afterwards rooms get the exits they
 * want, and loops and dead ends are added.
 */
export function generateDigDungeon(options: DigDungeonOptions): DungeonResult {
  return retryPlacement(() => buildDigDungeon(options));
}
