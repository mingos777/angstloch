import { DIRECTIONS } from './directions';
import type { CorridorMap } from './find-corridor';

/** Extra cost of running over an existing corridor, when that is allowed at all. */
const CROSSING_PENALTY = 3;

const DIAGONALS: readonly (readonly [number, number])[] = [
  [-1, -1],
  [1, -1],
  [-1, 1],
  [1, 1],
];

/** What a corridor may do on its way, which decides the tiles it can use. */
export interface CorridorRules {
  /** Whether the corridor may run over existing corridors. */
  crossing: boolean;
  /** Tiles where the corridor ends, which it may run into even though they hold a corridor. */
  isTarget: (x: number, y: number) => boolean;
  /** The tile the corridor starts from, which it may head straight away from even if it holds a corridor. */
  from?: Point;
  /** Tiles of a corridor that is being dug and is not on the map yet. */
  pending?: ReadonlySet<number>;
}

interface Point {
  x: number;
  y: number;
}

/**
 * Cost of stepping onto a tile while moving in a direction, or `undefined`
 * when it cannot be used. A corridor stays inside the map border and away from
 * reserved tiles. It never runs alongside another, as that would make it two
 * tiles wide: the only corridor tiles it may touch are the ones it crosses,
 * straight on. Nor does it pass diagonally beside one, as that would let a
 * diagonal step jump from one corridor to the other.
 */
export function corridorTileCost(
  map: CorridorMap,
  x: number,
  y: number,
  direction: number,
  rules: CorridorRules,
): number | undefined {
  const { width, height } = map;
  if (x < 1 || y < 1 || x > width - 2 || y > height - 2) {
    return undefined;
  }
  const index = y * width + x;
  if (map.reserved[index] === 1) {
    return undefined;
  }

  const isCorridor = (tx: number, ty: number): boolean =>
    tx >= 0 && tx < width && ty >= 0 && ty < height
      ? map.corridor[ty * width + tx] === 1 ||
        (rules.pending?.has(ty * width + tx) ?? false)
      : false;
  // corridor tiles that a corridor may head straight into
  const isTouchable = (tx: number, ty: number): boolean =>
    rules.crossing ||
    rules.isTarget(tx, ty) ||
    (tx === rules.from?.x && ty === rules.from.y);

  const onCorridor = map.corridor[index] === 1;
  if (onCorridor && !(rules.crossing || rules.isTarget(x, y))) {
    return undefined;
  }
  for (const [side, step] of DIRECTIONS.entries()) {
    const nx = x + step.x;
    const ny = y + step.y;
    if (isCorridor(nx, ny)) {
      const inLine = side % 2 === direction % 2;
      // touching a corridor ahead or behind is how a crossing, a junction or
      // a branch begins and ends, but running along it is not. Ending on the
      // tip of a corridor that goes on straight ahead is an end-to-end join.
      const joiningEnd = rules.isTarget(x, y) && side === direction;
      if (
        onCorridor ? inLine && !joiningEnd : !(inLine && isTouchable(nx, ny))
      ) {
        return undefined;
      }
    }
  }
  for (const [dx, dy] of DIAGONALS) {
    if (
      isCorridor(x + dx, y + dy) &&
      !isCorridor(x + dx, y) &&
      !isCorridor(x, y + dy)
    ) {
      return undefined;
    }
  }
  const share = map.steer?.[index];
  const move =
    share === undefined
      ? direction % 2 === 1
        ? map.horizontalCost
        : map.verticalCost
      : direction % 2 === 1
        ? 1.5 - share
        : 0.5 + share;
  return (
    move + (map.noise[index] as number) + (onCorridor ? CROSSING_PENALTY : 0)
  );
}
