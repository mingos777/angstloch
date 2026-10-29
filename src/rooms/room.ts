import type { Rotation } from '../core/rotation';
import type { RoomKind } from './room-kind';

/** A room of a dungeon. Coordinates and dimensions describe its floor, without the surrounding wall; for a templated room they describe the template's bounding box, walls included. */
export interface Room {
  /** Position of the room in `DungeonResult#rooms`. */
  id: number;
  /** What the room is, so the game never has to guess. */
  kind: RoomKind;
  /** Column of the room's leftmost floor tile. */
  x: number;
  /** Row of the room's topmost floor tile. */
  y: number;
  /** Width in tiles. */
  width: number;
  /** Height in tiles. */
  height: number;
  /** Indices into `DungeonResult#exits` (or the `roomExits` of the other results and of the steps) of the room's exits, doors or not. A hall's or cavern's are the places where a corridor, a vein or a tunnel enters it. */
  exits: number[];
  /** Number of exits, which is `exits.length`. */
  exitCount: number;
  /** Number of exits that have a door. */
  doorCount: number;
  /** Index into the `roomGroups` extra of the group the room belongs to, such as the cell block of a cell. Absent for a room of no group. */
  group?: number;
  /** Index into the `templates` option of the template this room was made from. Absent for ordinary rooms. */
  template?: number;
  /** The clockwise rotation the template was placed in, for templated rooms. */
  rotation?: Rotation;
  /** Whether the template was placed mirrored, for templated rooms. */
  mirrored?: boolean;
}
