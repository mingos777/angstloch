import type { BaseOptions } from '../core/base-options';
import type { OpenExitsOptions } from '../exits/open-exits-options';
import type { CorridorSymmetry } from '../rooms/corridor-symmetry';
import type { DigMazeOptions } from './dig-maze-options';
import type { OpenMazeRoomsOptions } from './open-maze-rooms-options';
import type { PlaceMazeRoomsOptions } from './place-maze-rooms-options';

/** How corridors are forced into a pattern around the map center. */
export type MazeSymmetry = CorridorSymmetry;

/**
 * The options of a maze that are not its size or its randomness: one key per
 * step of the maze, each holding the options of that step.
 */
export interface MazeStepOptions {
  /** The maze itself, carved on the whole map. See `digMaze`, less its `area` and `count`: a maze in part of a map is a composition of your own. Defaults to the defaults of that step. */
  maze?: Omit<DigMazeOptions, 'area' | 'count'>;
  /** Rooms and templates, placed before the maze is carved round them. See `placeMazeRooms`. It takes nothing from `maze`: to keep the rooms off a given `start`, give the same point as `keepClear`. Defaults to no rooms. */
  rooms?: PlaceMazeRoomsOptions;
  /** How the rooms open onto the maze. See `openMazeRooms`. Only used when there are `rooms`, and then with the defaults of that step unless given. */
  openings?: OpenMazeRoomsOptions;
  /** Exits on the map border. See `openExits`, with the defaults of that step: give `lattice: true` for doors that face the cells of the maze. Defaults to no exits. */
  exits?: OpenExitsOptions;
}

/** The options of `generateMaze`. */
export interface MazeOptions extends BaseOptions, MazeStepOptions {}
