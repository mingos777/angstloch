import { DIRECTIONS } from '../core/directions';
import type { Grid } from '../core/grid';
import type { LayoutSymmetry } from '../core/layout-symmetry';
import type { Point } from '../core/point';
import type { Random } from '../core/random';
import { Tile } from '../core/tile';
import { findNearestOpenable } from '../pipeline/find-nearest-openable';
import type { MapState } from '../pipeline/map-state';
import { openReserved } from '../pipeline/open-reserved';
import { Reserve } from '../pipeline/reserve';
import { createTransforms } from '../rooms/templates/create-transforms';
import { carveDirectTunnel } from './carve-direct-tunnel';
import { carveWindingTunnel } from './carve-winding-tunnel';
import { stampCaveTwins } from './stamp-cave-twins';
import type { TunnelOptions } from './tunnel-options';

/** Where a tunnel may start: a free tile, and the `Openable` tile it opens when it starts outside a room. */
interface Source {
  tile: Point;
  through?: Point;
}

/**
 * Joins the pieces of open ground that only a room's potential exits can
 * reach, after the caverns are joined, by digging tunnels on `grid` in place.
 * A piece is any set of tiles that are not wall, joined along edges, so a
 * room, the rooms its doors join, or the caverns with the rooms their tunnels
 * reach. The largest piece digs to the nearest `Openable` tile of another
 * piece, from its free floor or out through one of its own `Openable` tiles,
 * and the group keeps growing that way. Every `Openable` tile a tunnel goes
 * through becomes floor and is opened with `openReserved` on `state`. With a
 * symmetry, every tunnel gets twins with the chance `symmetryChance`, and so
 * do its openings where their images are `Openable`.
 *
 * A piece that reaches no `Openable` tile of another is left as it is, and
 * the next largest carries on. Tunnels never dig a tile that `blocked`
 * marks or that is reserved.
 */
export function joinCaveRooms(
  state: Pick<MapState, 'reserved'>,
  grid: Grid,
  random: Random,
  {
    tunnel,
    symmetry,
    symmetryChance,
  }: {
    tunnel: TunnelOptions;
    symmetry: LayoutSymmetry;
    symmetryChance: number;
  },
): void {
  const { width, height } = grid;
  const { reserved } = state;
  const view = { grid, reserved };
  const carve =
    tunnel.style === 'direct' ? carveDirectTunnel : carveWindingTunnel;
  const images = createTransforms(symmetry, width, height, false);
  // the tiles of groups that reach no other piece
  const stranded = new Uint8Array(width * height);
  const open = (tile: Point): void => {
    grid.set(tile.x, tile.y, Tile.Floor);
    openReserved(view, tile.x, tile.y);
  };

  for (;;) {
    const piece = labelPieces(grid);
    const sizes = new Map<number, number>();
    const strandedTiles = new Map<number, number>();
    for (let at = 0; at < width * height; ++at) {
      const id = piece[at] as number;
      if (id > 0) {
        sizes.set(id, (sizes.get(id) ?? 0) + 1);
        strandedTiles.set(
          id,
          (strandedTiles.get(id) ?? 0) + (stranded[at] ?? 0),
        );
      }
    }
    const [group] = [...sizes.entries()]
      .filter(([id, size]) => strandedTiles.get(id) !== size)
      .sort((p, q) => q[1] - p[1] || p[0] - q[0]);
    if (!group || sizes.size < 2) {
      break;
    }
    const [id] = group;
    const inGroup = (x: number, y: number): boolean =>
      grid.inBounds(x, y) && piece[y * width + x] === id;

    const sources: Source[] = [];
    for (let at = 0; at < width * height; ++at) {
      if (piece[at] !== id) {
        continue;
      }
      const x = at % width;
      const y = (at - x) / width;
      if (reserved[at] === Reserve.None) {
        sources.push({ tile: { x, y } });
        continue;
      }
      // out through an `Openable` tile of the group's rooms
      for (const step of DIRECTIONS) {
        const through = { x: x + step.x, y: y + step.y };
        const tile = { x: through.x + step.x, y: through.y + step.y };
        if (
          grid.inBounds(tile.x, tile.y) &&
          reserved[through.y * width + through.x] === Reserve.Openable &&
          reserved[tile.y * width + tile.x] === Reserve.None &&
          !tunnel.blocked?.[tile.y * width + tile.x]
        ) {
          sources.push({ tile, through });
        }
      }
    }

    const found = findNearestOpenable(
      view,
      sources.map(({ tile }) => tile),
      {
        blocked: tunnel.blocked,
        // an exit into a room of another piece, not back into the group
        accepts: (openable, direction) => {
          const step = DIRECTIONS[(direction + 2) % 4] as Point;
          const [x, y] = [openable.x + step.x, openable.y + step.y];
          return (
            grid.inBounds(x, y) &&
            grid.get(x, y) !== Tile.Wall &&
            !inGroup(x, y)
          );
        },
      },
    );
    if (!found) {
      for (let at = 0; at < width * height; ++at) {
        if (piece[at] === id) {
          stranded[at] = 1;
        }
      }
      continue;
    }
    const source = sources[found.start] as Source;
    const before = images.length > 0 ? grid.clone() : undefined;
    carve(grid, random, source.tile, found.outside, tunnel);
    const openings = [
      found.openable,
      ...(source.through ? [source.through] : []),
    ];
    for (const tile of openings) {
      open(tile);
    }
    if (before && random() < symmetryChance) {
      stampCaveTwins(grid, before, images, tunnel.blocked);
      for (const { point } of images) {
        for (const tile of openings.map(point)) {
          if (reserved[tile.y * width + tile.x] === Reserve.Openable) {
            open(tile);
          }
        }
      }
    }
  }
}

/** Numbers the pieces of tiles that are not wall, joined along edges, from 1; 0 for wall. */
function labelPieces(grid: Grid): Int32Array {
  const { width, height } = grid;
  const piece = new Int32Array(width * height);
  let count = 0;
  for (let start = 0; start < width * height; ++start) {
    const sx = start % width;
    if (
      piece[start] !== 0 ||
      grid.get(sx, (start - sx) / width) === Tile.Wall
    ) {
      continue;
    }
    piece[start] = ++count;
    for (const queue = [start]; queue.length > 0;) {
      const at = queue.pop() as number;
      const x = at % width;
      const y = (at - x) / width;
      for (const step of DIRECTIONS) {
        const [nx, ny] = [x + step.x, y + step.y];
        const next = ny * width + nx;
        if (
          grid.inBounds(nx, ny) &&
          piece[next] === 0 &&
          grid.get(nx, ny) !== Tile.Wall
        ) {
          piece[next] = count;
          queue.push(next);
        }
      }
    }
  }
  return piece;
}
