import type { Area } from '../core/area';
import type { Random } from '../core/random';
import { Tile } from '../core/tile';
import { isFree } from '../pipeline/is-free';
import type { MapState } from '../pipeline/map-state';
import { openReserved } from '../pipeline/open-reserved';
import { Reserve } from '../pipeline/reserve';
import { reserveTile } from '../pipeline/reserve-tile';
import type { RoomShape } from '../rooms/room-shape';
import { TemplateCell } from '../rooms/templates/template-cell';
import type { CatacombSettings } from './catacomb-settings';
import { createCatacombMirrors } from './create-catacomb-mirrors';
import { createChamberShape } from './create-chamber-shape';
import { lineCatacomb } from './line-catacomb';
import type { LinedCatacomb } from './line-catacomb';
import { joinCatacombRooms } from './join-catacomb-rooms';
import type { CatacombEntry, CatacombRoom } from './join-catacomb-rooms';
import { listCatacombSegments } from './list-catacomb-segments';
import { listDeadEnds } from './list-dead-ends';
import { listLatticeEdges } from './list-lattice-edges';
import { placeCrypts } from './place-crypts';
import type { PlacedCrypt } from './place-crypts';
import { planLattice } from './plan-lattice';
import { pruneLattice } from './prune-lattice';

/** Whether every tile of the box and of a margin of one tile round it is free. */
function isClear(state: MapState, box: Area): boolean {
  for (let y = box.y - 1; y <= box.y + box.height; ++y) {
    for (let x = box.x - 1; x <= box.x + box.width; ++x) {
      if (!isFree(state, x, y)) {
        return false;
      }
    }
  }
  return true;
}

/** What `buildCatacomb` made, in the coordinates of its state. */
export interface BuiltCatacomb extends LinedCatacomb {
  /** The shapes of the chambers, in the order of `chambers`. */
  shapes: RoomShape[];
  crypts: PlacedCrypt[];
  /** Where the galleries enter the crypts and the `earlier` rooms, the crypts numbered first. */
  entries: CatacombEntry[];
}

/**
 * Builds a catacomb on the whole of a state, inside a ring of wall: places
 * the crypts (see `placeCrypts`), plans its lattice (see `planLattice`),
 * mirrored on the axes that `symmetry` mirrors about the middle of the state, keeps
 * the edges whose floor, nodes and a margin round them are free, prunes them
 * (see `pruneLattice`), together with their twins, plans how they enter the crypts and the `earlier`
 * rooms, those placed before in the state, and keeps the largest piece that
 * makes (see `joinCatacombRooms`). It digs the galleries and the passages as
 * `Floor`, opens the rooms' walls as `Floor` or `Door` (see `openReserved`),
 * and lines the segments and dead ends with chambers and niches and their
 * twins (see `lineCatacomb`). Every free tile of rock in the box of the galleries is
 * reserved `Solid`, so no later step digs between them, and so is every free
 * tile next to a niche, even corner to corner, so none digs into one, and the
 * shape of every chamber (see `createChamberShape`), door included. Throws an
 * ordinary `Error` when no gallery finds free room, and a
 * `TemplatePlacementError` for a crypt that does not fit or cannot be joined.
 */
export function buildCatacomb(
  state: MapState,
  random: Random,
  settings: CatacombSettings,
  earlier: readonly CatacombRoom[] = [],
): BuiltCatacomb {
  const { grid } = state;
  const mirrors = createCatacombMirrors(
    settings.symmetry,
    grid.width,
    grid.height,
  );
  const crypts = placeCrypts(
    state,
    random,
    settings,
    earlier.map(({ shape }) => shape),
  );
  const lattice = planLattice(
    random,
    { x: 1, y: 1, width: grid.width - 2, height: grid.height - 2 },
    settings,
    {
      columns: mirrors.some(({ x }) => x),
      rows: mirrors.some(({ y }) => y),
    },
  );
  const { columns, rows } = lattice;
  const nodes = rows.length * columns.length;
  const pruned = pruneLattice(
    random,
    nodes,
    listLatticeEdges(lattice).filter(({ span }) => isClear(state, span)),
    settings.loopChance,
    settings.deadEndChance,
    mirrors.map(({ x, y }) => (node) => {
      const [row, column] = [
        Math.floor(node / columns.length),
        node % columns.length,
      ];
      return (
        (y ? rows.length - 1 - row : row) * columns.length +
        (x ? columns.length - 1 - column : column)
      );
    }),
  );
  if (pruned.length === 0) {
    throw new Error(
      `digCatacombs found no free room for a gallery in its area of ${String(grid.width)} by ${String(grid.height)} tiles. Run it before the steps that fill its area.`,
    );
  }
  const { edges, entries } = joinCatacombRooms(
    state,
    random,
    nodes,
    pruned,
    [
      ...crypts.map(({ shape, fail }) => ({ shape, must: true, fail })),
      ...earlier,
    ],
    settings.doorChance,
    mirrors,
  );

  let [left, top, right, bottom] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const { span } of edges) {
    for (let y = span.y; y < span.y + span.height; ++y) {
      for (let x = span.x; x < span.x + span.width; ++x) {
        grid.set(x, y, Tile.Floor);
      }
    }
    left = Math.min(left, span.x);
    top = Math.min(top, span.y);
    right = Math.max(right, span.x + span.width - 1);
    bottom = Math.max(bottom, span.y + span.height - 1);
  }
  for (const { wall, door, passage } of entries) {
    for (const { x, y } of passage) {
      grid.set(x, y, Tile.Floor);
    }
    grid.set(wall.x, wall.y, door ? Tile.Door : Tile.Floor);
    openReserved(state, wall.x, wall.y);
  }
  const segments = listCatacombSegments(edges);
  const lined = lineCatacomb(
    state,
    random,
    segments,
    listDeadEnds(edges, segments),
    settings,
    mirrors,
  );
  const shapes = lined.chambers.map(({ floor, door }, index) =>
    createChamberShape(
      floor,
      door,
      lined.niches.flatMap(({ tiles, chamber }) =>
        chamber === index ? [tiles] : [],
      ),
    ),
  );
  for (const shape of shapes) {
    shape.cells.forEach((row, dy) => {
      row.forEach((cell, dx) => {
        if (cell !== TemplateCell.Unused) {
          reserveTile(state, shape.x + dx, shape.y + dy, Reserve.Solid);
        }
      });
    });
  }
  const reserve = (x: number, y: number) => {
    if (isFree(state, x, y)) {
      reserveTile(state, x, y, Reserve.Solid);
    }
  };
  for (let y = top; y <= bottom; ++y) {
    for (let x = left; x <= right; ++x) {
      reserve(x, y);
    }
  }
  for (const { tiles } of lined.niches) {
    for (const tile of tiles) {
      for (let y = tile.y - 1; y <= tile.y + 1; ++y) {
        for (let x = tile.x - 1; x <= tile.x + 1; ++x) {
          reserve(x, y);
        }
      }
    }
  }
  return { ...lined, shapes, crypts, entries };
}
