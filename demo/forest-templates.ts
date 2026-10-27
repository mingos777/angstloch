import { TemplateCell } from '../src';
import type { RoomTemplate } from '../src';

/** Reads a design from rows of text: `#` is wall, `.` is floor, anything else is unused. */
function design(rows: string[]): RoomTemplate['cells'] {
  return rows.map((row) =>
    Array.from(row, (char) =>
      char === '#'
        ? TemplateCell.Wall
        : char === '.'
          ? TemplateCell.Floor
          : TemplateCell.Unused,
    ),
  );
}

/** The templates the forest playground can place, which have no exits since a forest has no tunnels. */
export const FOREST_TEMPLATES: Record<string, RoomTemplate> = {
  ruin: {
    name: 'ruin',
    cells: design([
      '  ###  ',
      ' #...# ',
      '#.....#',
      '#.....#',
      '#.....#',
      ' ##.## ',
      '       ',
    ]),
    rotate: [0, 90, 180, 270],
    mirror: true,
  },
  camp: {
    name: 'camp',
    cells: design(['  .  ', ' ... ', '.....', ' ... ', '  .  ']),
  },
  arena: {
    name: 'arena',
    cells: design([
      '   #####   ',
      ' ##.....## ',
      ' #.......# ',
      '#.........#',
      '#.........#',
      '...........',
      '#.........#',
      '#.........#',
      ' #.......# ',
      ' ##.....## ',
      '   #####   ',
    ]),
    rotate: [0, 90],
  },
};
