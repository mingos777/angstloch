import type { Room } from '../src';

/** Outlines the bounding box of every templated room and labels it with the template's index. */
export function drawTemplates(
  context: CanvasRenderingContext2D,
  rooms: Room[],
  tileSize: number,
): void {
  context.lineWidth = 2;
  context.strokeStyle = '#e0457b';
  context.fillStyle = '#e0457b';
  context.font = `bold ${String(Math.max(10, tileSize))}px monospace`;
  context.textAlign = 'left';
  context.textBaseline = 'top';
  for (const room of rooms) {
    if (room.template === undefined) {
      continue;
    }
    context.strokeRect(
      room.x * tileSize,
      room.y * tileSize,
      room.width * tileSize,
      room.height * tileSize,
    );
    context.fillText(
      `#${String(room.template)}`,
      room.x * tileSize + 3,
      room.y * tileSize + 3,
    );
  }
}
