import type { Point } from '../core/point';
import type { StreamTerrain } from './stream-terrain';

/** How far along the border an end is moved to keep to the land the road is on, in tiles. */
const SLIDE = 30;

/**
 * Moves an end of a road that lies on the border of the map, in the water
 * or on `verge`, along the border to the nearest tile that is clear of it.
 * Preferably that tile is on the same side of the map and on the piece of
 * land `piece` that the road reaches first, then on the same side, then
 * anywhere on the border. An end that is clear already stays where it is,
 * and so does an end inside the map, and one that finds no tile clear.
 */
export function clearRoadEnd(
  terrain: StreamTerrain,
  tile: Point,
  piece: number | undefined,
  verge: Uint8Array,
): Point {
  const { mapWidth, mapHeight, pieces } = terrain;
  const key = ({ x, y }: Point) => y * mapWidth + x;

  // the tiles along the border of the map, clockwise
  const ring: Point[] = [];
  for (let x = 0; x < mapWidth; ++x) {
    ring.push({ x, y: 0 });
  }
  for (let y = 1; y < mapHeight; ++y) {
    ring.push({ x: mapWidth - 1, y });
  }
  for (let x = mapWidth - 2; x >= 0 && mapHeight > 1; --x) {
    ring.push({ x, y: mapHeight - 1 });
  }
  for (let y = mapHeight - 2; y >= 1 && mapWidth > 1; --y) {
    ring.push({ x: 0, y });
  }

  const free = (other: Point) => verge[key(other)] !== 1;
  const at = ring.findIndex(({ x, y }) => x === tile.x && y === tile.y);
  if (at === -1 || free(tile)) {
    return tile;
  }
  const sameSide = (other: Point) =>
    (other.x === tile.x && (tile.x === 0 || tile.x === mapWidth - 1)) ||
    (other.y === tile.y && (tile.y === 0 || tile.y === mapHeight - 1));
  for (const [onSide, onLand] of [
    [true, true],
    [true, false],
    [false, false],
  ] as const) {
    for (let away = 1; away < (onLand ? SLIDE : ring.length); ++away) {
      for (const other of [
        ring[(at + away) % ring.length],
        ring[(at - away + ring.length) % ring.length],
      ]) {
        if (
          other &&
          free(other) &&
          (!onSide || sameSide(other)) &&
          (!onLand || piece === undefined || pieces[key(other)] === piece)
        ) {
          return other;
        }
      }
    }
  }
  return tile;
}
