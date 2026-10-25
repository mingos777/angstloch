import { corridorTileCost } from './corridor-tile-cost';
import { DIRECTIONS } from './directions';
import type { CorridorMap } from './find-corridor';
import { pickRandom } from './pick-random';
import type { Point } from './point';
import type { Random } from './random';

export interface DigSettings {
  lattice: boolean;
  straight: number;
  /** The share of horizontal directions that a corridor favours at a tile. */
  share: (at: Point) => number;
}

export interface DugCorridor {
  /** Tiles of the corridor in order, without the origin. */
  tiles: Point[];
  /** Direction of the last step, as an index into `DIRECTIONS`. */
  direction: number;
}

/** Chance of a turn at each step of a corridor that has no preference for going straight. */
const TURN_CHANCE = 0.3;

/**
 * Digs a corridor of a number of steps from an origin without carving it:
 * the tiles are only listed, or `undefined` is returned if the corridor runs
 * into something. The corridor mostly goes straight, depending on `straight`,
 * and never turns twice in a row. It follows the same rules as routed
 * corridors, so it is never next to another corridor, not even diagonally.
 *
 * With `originOnCorridor` the origin is a tile of an existing corridor that the
 * new corridor branches off. Otherwise it is a wall tile, from which the
 * corridor starts with a single tile even on the lattice.
 */
export function digCorridor(
  map: CorridorMap,
  random: Random,
  settings: DigSettings,
  origin: Point,
  originOnCorridor: boolean,
  startDirection: number,
  steps: number,
): DugCorridor | undefined {
  const stride = settings.lattice ? 2 : 1;
  const tiles: Point[] = [];
  const pending = new Set<number>();
  let direction = startDirection;
  let previous: Point | undefined = originOnCorridor ? origin : undefined;
  let turned = false;

  for (let step = 0; step < steps; ++step) {
    const heading = DIRECTIONS[direction] as Point;
    const length = step === 0 && !originOnCorridor ? 1 : stride;
    let last = tiles.at(-1) ?? origin;
    for (let i = 0; i < length; ++i) {
      const tile = { x: last.x + heading.x, y: last.y + heading.y };
      const cost = corridorTileCost(map, tile.x, tile.y, direction, {
        crossing: false,
        isTarget: () => false,
        from: previous,
        pending,
      });
      if (cost === undefined) {
        return undefined;
      }
      tiles.push(tile);
      pending.add(tile.y * map.width + tile.x);
      previous = tile;
      last = tile;
    }

    // a corridor turns at the end of a step, towards the axis it favours
    if (step < steps - 1) {
      const horizontal = direction % 2 === 1;
      const share = settings.share(tiles.at(-1) ?? origin);
      const target = horizontal ? 1 - share : share;
      const turn: boolean =
        !turned &&
        random() < (1 - settings.straight) * TURN_CHANCE * 2 * target;
      if (turn) {
        direction = pickRandom(random, [
          (direction + 1) % 4,
          (direction + 3) % 4,
        ]);
      }
      turned = turn;
    }
  }
  return { tiles, direction };
}
