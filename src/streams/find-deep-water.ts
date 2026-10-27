import type { Road } from '../roads/road';
import { extendPastBorder } from '../roads/extend-past-border';
import { stampRoadBrush } from '../roads/stamp-road-brush';

/**
 * Finds the deep water of the streams: for each, a band along its centerline
 * that is `shoreWidth` tiles narrower than the stream on each side. A stream
 * that is no wider than twice `shoreWidth` has none. Returns one byte per
 * tile, row by row, 1 where the water is deep.
 */
export function findDeepWater(
  streams: readonly Road[],
  mapWidth: number,
  mapHeight: number,
  shoreWidth: number,
): Uint8Array {
  const deep = new Uint8Array(mapWidth * mapHeight);
  for (const { width, points } of streams) {
    const core = width - 2 * shoreWidth;
    if (core < 1) {
      continue;
    }
    // past the border too, like the stream itself
    for (const { x, y } of [
      ...points,
      ...extendPastBorder(points, mapWidth, mapHeight),
    ]) {
      stampRoadBrush(deep, mapWidth, mapHeight, x, y, core);
    }
  }
  return deep;
}
