import { createTransforms } from './create-transforms';
import { decideTemplateDoors } from './decide-template-doors';
import type { DungeonOptions } from '../dungeon-options';
import { effectiveSpacing } from '../effective-spacing';
import type { LayoutSymmetry } from '../../core/layout-symmetry';
import { placeRoomTemplates } from './place-room-templates';
import type { Random } from '../../core/random';
import type { ResolvedDungeonOptions } from '../resolve-dungeon-options';
import type { Room } from '../room';
import type { RoomTemplate } from './room-template';
import { TemplateCell } from './template-cell';
import type { TemplatePlacement } from './template-placement';
import { TemplatePlacementError } from './template-placement-error';
import { validateTemplate } from './validate-template';
import { validateTemplateAreas } from './validate-template-areas';
import { validateTemplateLattice } from './validate-template-lattice';

/** The templated rooms of a dungeon, placed and ready to be carved. */
export interface PreparedTemplates {
  /** The placement of each templated room, by room id. The templated rooms have the lowest ids. */
  placements: TemplatePlacement[];
  /** Whether each `Exit` and `Door` cell gets a door, keyed by `y * width + x`. */
  doors: ReadonlyMap<number, boolean>;
  /** Number of tiles of the templated rooms that are floor, doors included. */
  floor: number;
  /** The templated rooms, new every time as building a dungeon fills in their exits. */
  rooms: () => Room[];
  /** Throws a `TemplatePlacementError` for the templated room with an id. */
  fail: (room: number, problem: string) => never;
}

/**
 * Validates the templates of the options, places every copy of each of them,
 * and decides their doors. With `centerFirst`, the first template is placed in
 * the middle of the map unless it has positions of its own.
 */
export function prepareTemplates(
  random: Random,
  options: DungeonOptions,
  resolved: ResolvedDungeonOptions,
  layout: LayoutSymmetry,
  centerFirst = false,
): PreparedTemplates {
  const { width, height } = resolved;
  const lattice = resolved.placement === 'lattice';
  const templates = options.templates ?? [];
  templates.forEach((template, index) => {
    validateTemplate(template, index);
    if (lattice) {
      validateTemplateLattice(template, index);
    }
    validateTemplateAreas(template, index, width, height, lattice);
  });
  const mirrors =
    options.templateSymmetry === true
      ? createTransforms(layout, width, height, lattice)
      : [];
  const aimed: RoomTemplate[] = templates.map((template, index) =>
    centerFirst &&
    index === 0 &&
    template.positions === undefined &&
    template.areas === undefined
      ? {
          ...template,
          positions: [
            {
              coords: { x: Math.floor(width / 2), y: Math.floor(height / 2) },
              anchor: 'center',
            },
          ],
        }
      : template,
  );
  const placed = placeRoomTemplates(
    random,
    aimed,
    {
      width,
      height,
      spacing: effectiveSpacing(resolved.roomSpacing, lattice),
      lattice,
    },
    mirrors,
  );
  const placements = placed.map(({ placement }) => placement);
  const doors = decideTemplateDoors(
    random,
    placements,
    mirrors,
    resolved.doorChance,
    width,
  );
  // a doorway that two rooms share is one tile of floor
  const floor = new Set<number>();
  for (const placement of placements) {
    placement.cells.forEach((row, dy) => {
      row.forEach((cell, dx) => {
        if (
          cell === TemplateCell.Floor ||
          cell === TemplateCell.Exit ||
          cell === TemplateCell.Door
        ) {
          floor.add((placement.y + dy) * width + placement.x + dx);
        }
      });
    });
  }
  return {
    placements,
    doors,
    floor: floor.size,
    rooms: () =>
      placed.map(({ placement, template }, id) => ({
        id,
        x: placement.x,
        y: placement.y,
        width: placement.width,
        height: placement.height,
        exits: [],
        exitCount: 0,
        doorCount: 0,
        template,
        rotation: placement.rotation,
        mirrored: placement.mirrored,
      })),
    fail: (room, problem) => {
      const index = placed[room]?.template ?? 0;
      throw new TemplatePlacementError(index, templates[index]?.name, problem);
    },
  };
}
