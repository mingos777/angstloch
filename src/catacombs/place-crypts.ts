import type { Point } from '../core/point';
import type { Random } from '../core/random';
import type { MapState } from '../pipeline/map-state';
import { createTakenPlacement } from '../rooms/create-taken-placement';
import { findTakenTiles } from '../rooms/find-taken-tiles';
import { listShapeDoors } from '../rooms/list-shape-doors';
import { reserveRoomShape } from '../rooms/reserve-room-shape';
import type { RoomShape } from '../rooms/room-shape';
import { carveTemplate } from '../rooms/templates/carve-template';
import { prepareTemplates } from '../rooms/templates/prepare-templates';
import type { CatacombSettings } from './catacomb-settings';

/** A crypt that `placeCrypts` placed, carved and reserved. */
export interface PlacedCrypt {
  shape: RoomShape;
  /** The index of its template. */
  template: number;
  /** Throws a `TemplatePlacementError` for the crypt. */
  fail: (problem: string) => never;
}

/**
 * Places every copy of the templates on a state, as the room steps do (see
 * `prepareTemplates`): clear of every tile that is not free, of the ring of
 * wall round the state and of the tiles in front of the fixed exits of the
 * `earlier` shapes, in the coordinates of the state, that are not opened yet,
 * and of the `approaches` of unopened cell block entrances (see
 * `findBlockApproaches`), in the same coordinates.
 * Carves them, their exits that lead outside left shut, and reserves their
 * shapes (see `reserveRoomShape`). An `Exit` cell gets a door by
 * `doorChance`. With `templateSymmetry`, every copy brings its images under
 * `symmetry` about the middle of the state along. Throws a
 * `TemplatePlacementError` for a template that does not fit.
 */
export function placeCrypts(
  state: MapState,
  random: Random,
  settings: Pick<
    CatacombSettings,
    'templates' | 'templateSymmetry' | 'doorChance' | 'symmetry'
  >,
  earlier: readonly RoomShape[],
  approaches: readonly Point[] = [],
): PlacedCrypt[] {
  const { templates, templateSymmetry, doorChance, symmetry } = settings;
  if (templates.length === 0) {
    return [];
  }
  const { grid } = state;
  const { width, height } = grid;
  const taken =
    findTakenTiles(state, earlier, approaches) ??
    new Uint8Array(width * height);
  for (let y = 0; y < height; ++y) {
    for (let x = 0; x < width; ++x) {
      if (x === 0 || y === 0 || x === width - 1 || y === height - 1) {
        taken[y * width + x] = 1;
      }
    }
  }
  const prepared = prepareTemplates(
    random,
    { templates, templateSymmetry },
    { width, height, placement: 'free', roomSpacing: 1, doorChance },
    symmetry,
    false,
    [createTakenPlacement(taken, width, height)],
  );
  const rooms = prepared.rooms();
  return prepared.placements.map((placement, id) => {
    carveTemplate(grid, placement, prepared.doors);
    const shape: RoomShape = {
      ...placement,
      doors: listShapeDoors(placement, prepared.doors, width),
    };
    reserveRoomShape(state, shape);
    return {
      shape,
      template: rooms[id]?.template ?? 0,
      fail: (problem) => prepared.fail(id, problem),
    };
  });
}
