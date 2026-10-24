/** A room of a dungeon. Coordinates and dimensions describe its floor, without the surrounding wall. */
export interface Room {
  /** Position of the room in `DungeonResult#rooms`. */
  id: number;
  /** Column of the room's leftmost floor tile. */
  x: number;
  /** Row of the room's topmost floor tile. */
  y: number;
  /** Width in tiles. */
  width: number;
  /** Height in tiles. */
  height: number;
  /** Indices into `DungeonResult#exits` of the room's exits, doors or not. */
  exits: number[];
  /** Number of exits, which is `exits.length`. */
  exitCount: number;
  /** Number of exits that have a door. */
  doorCount: number;
}
