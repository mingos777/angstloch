import type { Area } from '../core/area';
import { lineArea } from './line-area';
import type { SewerLine } from './sewer-line';

/** The floor of a line's tunnel, walkways included. */
export function tunnelArea(line: SewerLine): Area {
  return lineArea(line.horizontal, line.tunnel, {
    min: line.across - 1,
    max: line.across + line.width,
  });
}
