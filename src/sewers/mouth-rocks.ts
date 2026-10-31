import type { Area } from '../core/area';
import { lineArea } from './line-area';
import type { SewerLine } from './sewer-line';
import { MOUTH_ROCK } from './sewer-limits';

/** The rock behind the wall at an end of the water, `1` for its far end and `-1` for its near one, as wide as the water. */
function mouthRock(line: SewerLine, end: 1 | -1): Area {
  const edge = end === 1 ? line.water.max : line.water.min;
  const near = edge + 2 * end;
  const far = edge + (MOUTH_ROCK + 1) * end;
  return lineArea(
    line.horizontal,
    { min: Math.min(near, far), max: Math.max(near, far) },
    { min: line.across, max: line.across + line.width - 1 },
  );
}

/** The rock behind every mouth of a line inside the map that meets a wall, which is reserved: at the ends of the trunk that are no outfalls, and at the far end of a branch, unless it runs into a cistern. */
export function mouthRocks(line: SewerLine): Area[] {
  return line.level === 'trunk'
    ? ([-1, 1] as const)
        .filter((end) => !line.outfalls?.some((outfall) => outfall.end === end))
        .map((end) => mouthRock(line, end))
    : line.headLedges
      ? []
      : [mouthRock(line, line.outward)];
}
