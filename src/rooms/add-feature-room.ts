import type { Area } from '../core/area';
import type { Point } from '../core/point';
import type { FeatureRooms } from './feature-rooms';
import type { RoomKind } from './room-kind';
import { TemplateCell } from './templates/template-cell';

/** The smallest rectangle that holds the tiles, of which there must be at least one. */
function boundsOf(tiles: readonly Point[]): Area {
  let [x, y, right, bottom] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const tile of tiles) {
    x = Math.min(x, tile.x);
    y = Math.min(y, tile.y);
    right = Math.max(right, tile.x);
    bottom = Math.max(bottom, tile.y);
  }
  return { x, y, width: right - x + 1, height: bottom - y + 1 };
}

/**
 * Appends a hall or a cavern to the rooms of `into`, with the next id: its box
 * is `box`, which must hold every tile, or else the smallest rectangle that
 * holds its floor `tiles` (there must be at least one), and its shape is that
 * floor, every other cell of the box `Unused`, with no exits, so it blocks
 * nothing.
 */
export function addFeatureRoom(
  into: FeatureRooms,
  kind: Extract<RoomKind, 'pillarHall' | 'cavern'>,
  group: number,
  tiles: readonly Point[],
  box: Area = boundsOf(tiles),
): void {
  const { x, y, width, height } = box;
  const cells = Array.from({ length: height }, () =>
    Array.from({ length: width }, () => TemplateCell.Unused),
  );
  for (const tile of tiles) {
    (cells[tile.y - y] as TemplateCell[])[tile.x - x] = TemplateCell.Floor;
  }
  into.rooms.push({
    id: into.rooms.length,
    kind,
    x,
    y,
    width,
    height,
    exits: [],
    exitCount: 0,
    doorCount: 0,
    group,
  });
  into.roomShapes.push({
    x,
    y,
    width,
    height,
    cells,
    exits: [],
    rotation: 0,
    mirrored: false,
    doors: [],
  });
}
