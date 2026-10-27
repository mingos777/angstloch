import { retryPlacement } from '../rooms/templates/retry-placement';
import { assertMineOptions } from './assert-mine-options';
import { buildMine } from './build-mine';
import type { MineOptions } from './mine-options';
import type { MineResult } from './mine-result';

/**
 * Generates a mine: a filled map with tunnels dug into it, which are always
 * one connected piece. With the `fishbone` layout the main shaft is dug first,
 * and then side tunnels branch off the existing ones until the `density` is
 * reached. With `veins`, tunnels join junctions spread over the map. With
 * `pillars`, a few large halls with islands of wall left standing in them are
 * joined by tunnels. The map is closed in by a ring of wall, except for the
 * exits. With `rings`, concentric loops are joined by spokes. A template that
 * finds no place, or cannot be joined, gets a new map, up to three in all,
 * before a `TemplatePlacementError` is thrown.
 */
export function generateMine(options: MineOptions): MineResult {
  assertMineOptions(options);
  return retryPlacement(() => buildMine(options));
}
