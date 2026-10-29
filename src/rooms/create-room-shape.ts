import type { Area } from '../core/area';
import { findTemplateExits } from './templates/find-template-exits';
import { TemplateCell } from './templates/template-cell';
import type { TemplatePlacement } from './templates/template-placement';

const { Floor: F, Wall: W, OptionalExit: O } = TemplateCell;

/**
 * Makes the shape of an ordinary room with the given floor: the floor inside
 * a ring of wall one tile wider on every side, which can be opened into an
 * exit anywhere along its sides but not at its corners.
 */
export function createRoomShape(floor: Area): TemplatePlacement {
  const { width, height } = floor;
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
  return {
    x: floor.x - 1,
    y: floor.y - 1,
    width: width + 2,
    height: height + 2,
    cells,
    exits: findTemplateExits(cells),
    rotation: 0,
    mirrored: false,
  };
}
