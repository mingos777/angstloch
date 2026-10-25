import { DIRECTIONS } from '../../core/directions';
import type { Room } from '../room';
import { TemplateCell } from './template-cell';
import type { TemplatePlacement } from './template-placement';

/**
 * Returns a test for whether a room's floor is too close to the placements: at
 * most `spacing` tiles from their footprints, or from the tiles in front of
 * their exits, which corridors must be able to start on.
 */
export function createTemplateBlocker(
  placements: readonly TemplatePlacement[],
  width: number,
  height: number,
  spacing: number,
): ((room: Pick<Room, 'x' | 'y' | 'width' | 'height'>) => boolean) | undefined {
  if (placements.length === 0) {
    return undefined;
  }
  const taken = new Uint8Array(width * height);
  const take = (x: number, y: number): void => {
    if (x >= 0 && y >= 0 && x < width && y < height) {
      taken[y * width + x] = 1;
    }
  };
  for (const placement of placements) {
    placement.cells.forEach((row, dy) => {
      row.forEach((cell, dx) => {
        if (cell !== TemplateCell.Unused) {
          take(placement.x + dx, placement.y + dy);
        }
      });
    });
    for (const exit of placement.exits) {
      for (const direction of exit.directions) {
        const step = DIRECTIONS[direction];
        if (step) {
          take(placement.x + exit.x + step.x, placement.y + exit.y + step.y);
        }
      }
    }
  }
  return (room) => {
    for (let y = room.y - spacing; y < room.y + room.height + spacing; y++) {
      for (let x = room.x - spacing; x < room.x + room.width + spacing; x++) {
        if (
          x >= 0 &&
          y >= 0 &&
          x < width &&
          y < height &&
          taken[y * width + x]
        ) {
          return true;
        }
      }
    }
    return false;
  };
}
