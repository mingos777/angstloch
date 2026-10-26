/**
 * Tile kinds. The numeric values are part of the public contract: new kinds may
 * be added, but existing values never change. `Wall` is 0 so that a freshly
 * allocated grid is solid rock.
 *
 * `Door` marks a potential door placement; what to put there is up to the game.
 * `Grass` and `Tree` are the ground and the trees of outdoor maps. Whether a
 * tree blocks movement or sight is up to the game too. `Road` is a road or
 * a path, which differ only in how wide they are. `ShallowWater` is the bank
 * of a stream, which can be waded at the cost of getting wet, and `DeepWater`
 * its middle, where a swimmer is needed. A game may treat both as plain
 * water. `Bridge` is where a road crosses water.
 */
export const Tile = {
  Wall: 0,
  Floor: 1,
  Door: 2,
  Grass: 3,
  Tree: 4,
  Road: 5,
  ShallowWater: 6,
  DeepWater: 7,
  Bridge: 8,
} as const;

export type Tile = (typeof Tile)[keyof typeof Tile];
