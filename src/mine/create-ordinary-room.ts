import { TemplateCell } from '../rooms/templates/template-cell';
import type { RoomTemplate } from '../rooms/templates/room-template';

const { Floor: F, Wall: W, OptionalExit: O } = TemplateCell;

/**
 * Makes the template of an ordinary room: a floor of the given size inside a
 * ring of wall, which can be opened into an exit anywhere along its sides.
 */
export function createOrdinaryRoom(
  width: number,
  height: number,
): RoomTemplate {
  const cells = Array.from({ length: height + 2 }, (_, y) =>
    Array.from({ length: width + 2 }, (__, x) => {
      const edgeX = x === 0 || x === width + 1;
      const edgeY = y === 0 || y === height + 1;
      if (edgeX && edgeY) {
        return W;
      }
      return edgeX || edgeY ? O : F;
    }),
  );
  return { cells, name: 'room' };
}
