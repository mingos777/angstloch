import type { Area } from '../core/area';
import type { Grid } from '../core/grid';
import type { Point } from '../core/point';
import type { Random } from '../core/random';
import { randomInt } from '../core/random-int';
import type { Range } from '../core/range';
import { Tile } from '../core/tile';
import type { AreaSpec } from '../pipeline/area-spec';
import { buildInArea } from '../pipeline/build-in-area';
import { isFree } from '../pipeline/is-free';
import type { MapState } from '../pipeline/map-state';
import { pickAreaSize } from '../pipeline/pick-area-size';
import { placeArea } from '../pipeline/place-area';
import { placeAreas } from '../pipeline/place-areas';
import { placeBeside } from '../pipeline/place-beside';
import { Reserve } from '../pipeline/reserve';
import { stampTile } from '../pipeline/stamp-tile';
import { addFeatureRoom } from '../rooms/add-feature-room';
import type { FeatureRooms } from '../rooms/feature-rooms';
import type { CavePlacement } from './cave-placement';
import { findCaveRegions } from './find-cave-regions';

/** What `carveCaveInAreas` needs to know besides the cave itself. */
export interface CaveAreaSettings {
  area: AreaSpec;
  count: Range;
  minRegionSize: number;
  largestOnly: boolean;
  placement: CavePlacement;
  /** The share of the cave's floor that may land on tiles that are not free, with `placement: 'overlap'`. */
  overlapShare: Range;
}

/** The regions of a cave that culling keeps: none below `minRegionSize`, and only the largest with `largestOnly`. */
function cull(
  regions: Point[][],
  { minRegionSize, largestOnly }: CaveAreaSettings,
): Point[][] {
  return regions.filter(
    (tiles, index) =>
      tiles.length >= minRegionSize && !(largestOnly && index > 0),
  );
}

/** Adds a cave's group and a room of kind `'cavern'` for each of its caverns, given by their tiles on the map. A cave with no caverns adds nothing. */
function addCave(
  into: FeatureRooms,
  area: Area,
  caverns: readonly (readonly Point[])[],
): void {
  if (caverns.length === 0) {
    return;
  }
  const group = into.roomGroups.length;
  into.roomGroups.push({ kind: 'cave', area });
  for (const tiles of caverns) {
    addFeatureRoom(into, 'cavern', group, tiles);
  }
}

/**
 * Carves every copy with `placement: 'beside'`: the cave is made and culled on
 * its own grid, its noise sampled at a random spot of the map, and `placeBeside`
 * picks where it goes. A copy that finds no spot fails the attempt up to
 * `count.min` copies and is left out above it. A cave with no floor left is
 * left out.
 */
function carveBeside(
  state: MapState,
  random: Random,
  settings: CaveAreaSettings,
  make: (box: Area) => Grid,
  into: FeatureRooms,
): void {
  const { width, height } = state.grid;
  const { area, count } = settings;
  const copies = randomInt(random, count.min, count.max);
  for (let copy = 0; copy < copies; ++copy) {
    const size = {
      width: pickAreaSize(random, area.width, width, false),
      height: pickAreaSize(random, area.height, height, false),
    };
    const cave = make({
      x: randomInt(random, 0, width - size.width),
      y: randomInt(random, 0, height - size.height),
      ...size,
    });
    const caverns = cull(findCaveRegions(cave), settings);
    const floor = caverns.flat();
    if (floor.length === 0) {
      continue;
    }
    const box = placeBeside(state, random, size, floor);
    if (!box) {
      if (copy < count.min) {
        throw new Error(
          `No spot beside the dug ground for a cave of ${String(size.width)} by ${String(size.height)} tiles on a ${String(width)} by ${String(height)} map after 100 tries (copy ${String(copy + 1)} of ${String(copies)}, of which ${String(count.min)} are required). Make the area smaller, ask for fewer copies (those above count.min are left out when they find no spot), or use placement 'overlap'.`,
        );
      }
      continue;
    }
    for (const { x, y } of floor) {
      stampTile(state, box.x + x, box.y + y, Tile.Floor);
    }
    addCave(
      into,
      box,
      caverns.map((tiles) =>
        tiles.map(({ x, y }) => ({ x: x + box.x, y: y + box.y })),
      ),
    );
  }
}

/**
 * Lays a cave grid the size of `box` over the map and returns its caverns, on
 * the map. Floor that is there already, unless reserved, counts as part of the
 * cave when its caverns are measured; reserved tiles and any other tile that is
 * not free count as wall. Culled caverns are left out, and the rest is stamped
 * as floor on the free tiles. A cavern holds only the floor this cave dug.
 */
function layOver(
  state: MapState,
  box: Area,
  cave: Grid,
  settings: CaveAreaSettings,
): Point[][] {
  return buildInArea(state, box, (scratch) => {
    for (let y = 0; y < box.height; ++y) {
      for (let x = 0; x < box.width; ++x) {
        const floor =
          scratch.grid.get(x, y) === Tile.Floor &&
          scratch.reserved[y * box.width + x] === Reserve.None;
        if (floor) {
          cave.set(x, y, Tile.Floor);
        } else if (!isFree(scratch, x, y)) {
          cave.set(x, y, Tile.Wall);
        }
      }
    }
    return cull(
      findCaveRegions(cave).filter((region) =>
        region.some(({ x, y }) => isFree(scratch, x, y)),
      ),
      settings,
    ).map((tiles) => {
      const dug = tiles.filter(({ x, y }) => isFree(scratch, x, y));
      for (const { x, y } of dug) {
        stampTile(scratch, x, y, Tile.Floor);
      }
      return dug.map(({ x, y }) => ({ x: x + box.x, y: y + box.y }));
    });
  });
}

/** Whether the share of `floor` (on the cave's own grid) that lands on tiles that are not free, with the cave at `box`, lies in `share`. */
function overlapFits(
  state: MapState,
  box: Area,
  floor: readonly Point[],
  share: Range,
): boolean {
  let covered = 0;
  for (const { x, y } of floor) {
    if (!isFree(state, box.x + x, box.y + y)) {
      ++covered;
    }
  }
  const measured = covered / floor.length;
  return measured >= share.min && measured <= share.max;
}

/**
 * Carves every copy with `placement: 'overlap'`: the cave is made and culled on
 * its own grid, its noise sampled at a random spot of the map, and `placeArea`
 * picks a spot clear of the other copies where the share of its floor on tiles
 * that are not free lies in `overlapShare`, also on every step of a gravity
 * slide. The cave is then laid over the map (see `layOver`). A copy that finds
 * no spot fails the attempt up to `count.min` copies and is left out above it.
 * A cave with no floor left is left out.
 */
function carveOverlap(
  state: MapState,
  random: Random,
  settings: CaveAreaSettings,
  make: (box: Area) => Grid,
  into: FeatureRooms,
): void {
  const { width, height } = state.grid;
  const { area, count, overlapShare } = settings;
  const copies = randomInt(random, count.min, count.max);
  const boxes: Area[] = [];
  for (let copy = 0; copy < copies; ++copy) {
    const size = {
      width: pickAreaSize(random, area.width, width, false),
      height: pickAreaSize(random, area.height, height, false),
    };
    const cave = make({
      x: randomInt(random, 0, width - size.width),
      y: randomInt(random, 0, height - size.height),
      ...size,
    });
    const floor = cull(findCaveRegions(cave), settings).flat();
    if (floor.length === 0) {
      continue;
    }
    const box = placeArea(state, random, size, area, boxes, {
      overlap: true,
      accepts: (spot) => overlapFits(state, spot, floor, overlapShare),
    });
    if (!box) {
      if (copy < count.min) {
        throw new Error(
          `No spot for a cave of ${String(size.width)} by ${String(size.height)} tiles on a ${String(width)} by ${String(height)} map where the share of its floor over what is there lies from ${String(overlapShare.min)} to ${String(overlapShare.max)}, after 100 tries (copy ${String(copy + 1)} of ${String(copies)}, of which ${String(count.min)} are required). Widen overlapShare, make the area smaller than the map, or ask for fewer copies (those above count.min are left out when they find no spot).`,
        );
      }
      continue;
    }
    boxes.push(box);
    addCave(into, box, layOver(state, box, cave, settings));
  }
}

/**
 * Carves a cave once in every area that `placement` picks, and returns the
 * rooms, shapes and groups of the state, if any, followed by a `'cave'` group
 * for each new copy, with the box it was carved in, and a room of kind
 * `'cavern'` for each of its caverns (see `addFeatureRoom`). `make` returns
 * the walls and floors of a cave the size of the box.
 *
 * With `free`, the boxes come from `placeAreas` and the cave is laid over what
 * the box holds (see `layOver`): a tile that is not free keeps what it has.
 * Floor that is there already, unless reserved, counts as part of the cave
 * when its caverns are measured, so a cavern cut by an earlier tunnel is still
 * one cavern; reserved tiles and any other tile count as wall. Then the caverns
 * below `minRegionSize`, and all but the largest with `largestOnly`, are left
 * out, and the rest is stamped as floor on the free tiles. A piece of old floor
 * that no new floor touches is not a cavern of this cave, and the room of a
 * cavern holds only the floor this cave dug. With `overlap`, see
 * `carveOverlap`, and with `beside`, see `carveBeside`.
 */
export function carveCaveInAreas(
  state: MapState & Partial<FeatureRooms>,
  random: Random,
  settings: CaveAreaSettings,
  make: (box: Area) => Grid,
): FeatureRooms {
  const added: FeatureRooms = {
    rooms: [...(state.rooms ?? [])],
    roomShapes: [...(state.roomShapes ?? [])],
    roomGroups: [...(state.roomGroups ?? [])],
  };
  if (settings.placement === 'beside') {
    carveBeside(state, random, settings, make, added);
    return added;
  }
  if (settings.placement === 'overlap') {
    carveOverlap(state, random, settings, make, added);
    return added;
  }
  for (const box of placeAreas(state, random, settings.area, settings.count)) {
    addCave(added, box, layOver(state, box, make(box), settings));
  }
  return added;
}
