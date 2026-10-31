import type { CatacombSettings } from './catacomb-settings';

/** How deep the rock on each side of a gallery must be for what lines its walls: the deepest niche when a segment may get niches, one tile of wall and the deepest chamber when it may get chambers, whichever is deeper, else 0. */
export function sideRoom(
  settings: Pick<CatacombSettings, 'segments' | 'nicheDepth' | 'chamberDepth'>,
): number {
  return Math.max(
    settings.segments.niches > 0 ? settings.nicheDepth.max : 0,
    settings.segments.chambers > 0 ? 1 + settings.chamberDepth.max : 0,
  );
}
