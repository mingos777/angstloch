import { TemplateCell } from './templates/template-cell';
import type { TemplatePlacement } from './templates/template-placement';

/** The taken tiles, a byte for each tile row by row, as one placement the size of the map, which templates keep clear of like another room. */
export function createTakenPlacement(
  taken: Uint8Array,
  width: number,
  height: number,
): TemplatePlacement {
  return {
    x: 0,
    y: 0,
    width,
    height,
    cells: Array.from({ length: height }, (_, y) =>
      Array.from({ length: width }, (__, x) =>
        taken[y * width + x] ? TemplateCell.Floor : TemplateCell.Unused,
      ),
    ),
    exits: [],
    rotation: 0,
    mirrored: false,
  };
}
