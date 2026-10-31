import type { Area } from '../core/area';
import type { Point } from '../core/point';
import type { RoomShape } from '../rooms/room-shape';
import { findTemplateExits } from '../rooms/templates/find-template-exits';
import { TemplateCell } from '../rooms/templates/template-cell';

/** The shape of a burial chamber: its floor and the tiles of its niches as `Floor`, every tile round them as `Wall`, and its door as a `Door` that it has. */
export function createChamberShape(
  floor: Area,
  door: Point,
  niches: readonly Point[][],
): RoomShape {
  const tiles: Point[] = [...niches.flat()];
  for (let y = floor.y; y < floor.y + floor.height; ++y) {
    for (let x = floor.x; x < floor.x + floor.width; ++x) {
      tiles.push({ x, y });
    }
  }
  const xs = tiles.map(({ x }) => x);
  const ys = tiles.map(({ y }) => y);
  const [left, top] = [Math.min(...xs) - 1, Math.min(...ys) - 1];
  const width = Math.max(...xs) + 2 - left;
  const height = Math.max(...ys) + 2 - top;
  const cells = Array.from({ length: height }, () =>
    Array.from({ length: width }, (): TemplateCell => TemplateCell.Unused),
  );
  for (const { x, y } of tiles) {
    for (let dy = -1; dy <= 1; ++dy) {
      for (let dx = -1; dx <= 1; ++dx) {
        const row = cells[y + dy - top] as TemplateCell[];
        if (row[x + dx - left] === TemplateCell.Unused) {
          row[x + dx - left] = TemplateCell.Wall;
        }
      }
    }
  }
  for (const { x, y } of tiles) {
    (cells[y - top] as TemplateCell[])[x - left] = TemplateCell.Floor;
  }
  (cells[door.y - top] as TemplateCell[])[door.x - left] = TemplateCell.Door;
  return {
    x: left,
    y: top,
    width,
    height,
    cells,
    exits: findTemplateExits(cells),
    rotation: 0,
    mirrored: false,
    doors: [{ ...door, door: true }],
  };
}
