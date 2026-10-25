/**
 * Tile kinds. The numeric values are part of the public contract: new kinds may
 * be added, but existing values never change. `Wall` is 0 so that a freshly
 * allocated grid is solid rock.
 *
 * `Door` marks a potential door placement; what to put there is up to the game.
 */
export const Tile = {
  Wall: 0,
  Floor: 1,
  Door: 2,
} as const;

export type Tile = (typeof Tile)[keyof typeof Tile];
