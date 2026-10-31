import type { Area } from '../core/area';
import { DIRECTIONS } from '../core/directions';
import type { Point } from '../core/point';
import { pickRandom } from '../core/pick-random';
import type { Random } from '../core/random';
import type { Range } from '../core/range';
import { Tile } from '../core/tile';
import type { MapState } from '../pipeline/map-state';
import { Reserve } from '../pipeline/reserve';
import { reserveTile } from '../pipeline/reserve-tile';
import { stampTile } from '../pipeline/stamp-tile';
import type { SewerCanal } from '../rooms/sewer-canal';
import type { SewerMouth } from '../rooms/sewer-mouth';
import type { SewerOutfall } from '../rooms/sewer-outfall';
import { layCistern } from './lay-cistern';
import type { CisternColumns } from './lay-cistern';
import { lineArea } from './line-area';
import { mouthRocks } from './mouth-rocks';
import type { SewerLine } from './sewer-line';
import { tunnelArea } from './tunnel-area';

/** A sewer as `laySewer` dug it, in the coordinates of the map it was given. */
export interface LaidSewer {
  /** Its chambers, cisterns and tunnels, every tile of each box a tile of the sewer, but the columns of a cistern. */
  rooms: { kind: 'sewerChamber' | 'sewerTunnel' | 'cistern'; box: Area }[];
  canals: SewerCanal[];
  mouths: SewerMouth[];
  outfalls: SewerOutfall[];
}

/** A line of water across a canal, where a bridge may go. */
interface Crossing {
  line: number;
  /** Where along the line it crosses. */
  along: number;
  /** The water it covers. */
  tiles: Point[];
  /** The walkway tiles at both ends. */
  ends: [Point, Point];
}

/**
 * Digs a planned sewer (see `planSewer`): the tunnels and chambers become
 * floor, the canals `ShallowWater` through them, and every branch gets a
 * `Bridge` where the walkway beside its parent's water crosses it. A chamber
 * that is a cistern gets its basin, ledges and columns (see `layCistern`). Then
 * bridges across the canals join the walkways that the water still splits,
 * and each tunnel gets one more with the chance `bridgeChance`, so every
 * walkway tile reaches every other without wading. The walls beside the water
 * and the rock behind each mouth are reserved `Solid`, and the border tile at
 * the end of the walkway beside each outfall `Openable`. Changes the map in
 * place.
 */
export function laySewer(
  state: MapState,
  random: Random,
  lines: readonly SewerLine[],
  bridgeChance: number,
  columns: CisternColumns,
): LaidSewer {
  const { grid } = state;
  const { width, height } = grid;
  const sewer = new Uint8Array(width * height);
  const fill = (box: Area, tile: Tile) => {
    for (let y = box.y; y < box.y + box.height; ++y) {
      for (let x = box.x; x < box.x + box.width; ++x) {
        stampTile(state, x, y, tile);
        sewer[y * width + x] = 1;
      }
    }
  };
  const at = (line: SewerLine, along: number, across: number): Point =>
    line.horizontal ? { x: along, y: across } : { x: across, y: along };
  const waterAcross = (line: SewerLine): Range => ({
    min: line.across,
    max: line.across + line.width - 1,
  });

  for (const line of lines) {
    fill(tunnelArea(line), Tile.Floor);
    for (const chamber of [line.junction, line.head]) {
      if (chamber) {
        fill(chamber, Tile.Floor);
      }
    }
  }
  for (const line of lines) {
    fill(
      lineArea(line.horizontal, line.water, waterAcross(line)),
      Tile.ShallowWater,
    );
  }
  for (const line of lines) {
    for (const [box, ledges] of [
      [line.junction, line.junctionLedges],
      [line.head, line.headLedges],
    ] as const) {
      if (box && ledges) {
        layCistern(state, random, box, ledges, columns);
      }
    }
  }
  // the walkway beside the parent's water, or the ledge of a junction
  // cistern, crosses a branch at its first row
  lines.forEach((line) => {
    if (line.level === 'branch') {
      const first = line.outward === 1 ? line.water.min : line.water.max;
      for (
        let across = line.across;
        across < line.across + line.width;
        ++across
      ) {
        const { x, y } = at(line, first, across);
        stampTile(state, x, y, Tile.Bridge);
      }
    }
  });
  // the lines and the spots along them that have a bridge: so far at the
  // junctions and on the ledges of cisterns
  const bridged = new Set<string>();
  const key = (line: number, along: number) =>
    `${String(line)}:${String(along)}`;
  lines.forEach((line, index) => {
    for (let along = line.water.min; along <= line.water.max; ++along) {
      const { x, y } = at(line, along, line.across);
      if (grid.get(x, y) === Tile.Bridge) {
        bridged.add(key(index, along));
      }
    }
  });

  // every line of water across a canal with a walkway at both ends, but at
  // the canal's ends
  const crossings: Crossing[] = lines.flatMap((line, index) => {
    const found: Crossing[] = [];
    for (let along = line.water.min + 1; along < line.water.max; ++along) {
      const tiles: Point[] = [];
      for (
        let across = line.across;
        across < line.across + line.width;
        ++across
      ) {
        tiles.push(at(line, along, across));
      }
      const ends: [Point, Point] = [
        at(line, along, line.across - 1),
        at(line, along, line.across + line.width),
      ];
      if (
        tiles.every(({ x, y }) => grid.get(x, y) === Tile.ShallowWater) &&
        ends.every(({ x, y }) => grid.get(x, y) === Tile.Floor)
      ) {
        found.push({ line: index, along, tiles, ends });
      }
    }
    return found;
  });
  const bridge = (crossing: Crossing) => {
    for (const { x, y } of crossing.tiles) {
      stampTile(state, x, y, Tile.Bridge);
    }
    bridged.add(key(crossing.line, crossing.along));
  };
  // bridges keep two tiles of water between them along a canal
  const open = (crossing: Crossing) =>
    [-2, -1, 0, 1, 2].every(
      (step) => !bridged.has(key(crossing.line, crossing.along + step)),
    );
  for (
    let label = labelWalkways(grid, sewer);
    label.pieces > 1;
    label = labelWalkways(grid, sewer)
  ) {
    const joining = crossings.filter(({ ends: [a, b] }) => {
      const pa = label.of[a.y * width + a.x];
      const pb = label.of[b.y * width + b.x];
      return pa !== pb;
    });
    if (joining.length === 0) {
      throw new Error(
        'digSewers found no place for a bridge to join the walkways of a sewer',
      );
    }
    const spaced = joining.filter(open);
    bridge(pickRandom(random, spaced.length > 0 ? spaced : joining));
  }

  const rooms: LaidSewer['rooms'] = [];
  lines.forEach((line, index) => {
    if (line.junction) {
      rooms.push({
        kind: line.junctionLedges ? 'cistern' : 'sewerChamber',
        box: line.junction,
      });
    }
    for (const stretch of stretchesOf(lines, index)) {
      rooms.push({
        kind: 'sewerTunnel',
        box: tunnelArea({ ...line, tunnel: stretch }),
      });
      const within = crossings.filter(
        (crossing) =>
          crossing.line === index &&
          crossing.along >= stretch.min &&
          crossing.along <= stretch.max &&
          open(crossing),
      );
      if (within.length > 0 && random() < bridgeChance) {
        bridge(pickRandom(random, within));
      }
    }
    if (line.head) {
      rooms.push({
        kind: line.headLedges ? 'cistern' : 'sewerChamber',
        box: line.head,
      });
    }
  });

  for (let y = 0; y < height; ++y) {
    for (let x = 0; x < width; ++x) {
      if (grid.get(x, y) === Tile.ShallowWater) {
        for (const step of DIRECTIONS) {
          const [nx, ny] = [x + step.x, y + step.y];
          if (grid.inBounds(nx, ny) && grid.get(nx, ny) === Tile.Wall) {
            reserveTile(state, nx, ny, Reserve.Solid);
          }
        }
      }
    }
  }
  for (const line of lines) {
    for (const rock of mouthRocks(line)) {
      for (let y = rock.y; y < rock.y + rock.height; ++y) {
        for (let x = rock.x; x < rock.x + rock.width; ++x) {
          reserveTile(state, x, y, Reserve.Solid);
        }
      }
    }
  }
  // the border tile beyond the end of the walkway, after the walls beside
  // water, since the water of a pierced border runs right beside it
  const wayOut = (line: SewerLine, end: 1 | -1, side: 1 | -1): Point =>
    at(
      line,
      end === 1 ? line.tunnel.max + 1 : line.tunnel.min - 1,
      side === 1 ? line.across + line.width : line.across - 1,
    );
  for (const line of lines) {
    for (const { end, side } of line.outfalls ?? []) {
      const { x, y } = wayOut(line, end, side);
      reserveTile(state, x, y, Reserve.Openable);
    }
  }

  const middle = (line: SewerLine) =>
    line.across + Math.floor((line.width - 1) / 2);
  const canals = lines.map((line): SewerCanal => {
    const centerline: Point[] = [];
    for (let along = line.water.min; along <= line.water.max; ++along) {
      centerline.push(at(line, along, middle(line)));
    }
    if (line.outward === -1) {
      centerline.reverse();
    }
    return {
      level: line.level,
      centerline,
      width: line.width,
      ...(line.parent !== undefined && { parent: line.parent }),
    };
  });
  const mouths = lines.flatMap((line, canal): SewerMouth[] =>
    (line.level === 'trunk' ? ([-1, 1] as const) : [line.outward]).map(
      (end) => {
        const along = end === 1 ? line.water.max : line.water.min;
        const wall = at(line, along + end, middle(line));
        return {
          position: at(line, along, middle(line)),
          // the water of a pierced border leaves the map, and that of a
          // branch runs on into its head cistern
          ...(grid.inBounds(wall.x, wall.y) &&
            grid.get(wall.x, wall.y) === Tile.Wall && { wall }),
          canal,
        };
      },
    ),
  );
  // the trunk is the first line, and its mouths the first two
  const outfalls = (lines[0]?.outfalls ?? []).map(
    ({ end, side }): SewerOutfall => ({
      position: wayOut(lines[0] as SewerLine, end, side),
      mouth: end === 1 ? 1 : 0,
    }),
  );
  return { rooms, canals, mouths, outfalls };
}

/** The stretches of a line's tunnel between the junction chambers of the branches off it, in order along it. */
function stretchesOf(lines: readonly SewerLine[], index: number): Range[] {
  const line = lines[index] as SewerLine;
  const chambers = lines
    .filter(({ parent }) => parent === index)
    .map(({ junction }) => {
      const box = junction as Area;
      return line.horizontal
        ? { min: box.x, max: box.x + box.width - 1 }
        : { min: box.y, max: box.y + box.height - 1 };
    })
    .sort((a, b) => a.min - b.min);
  const stretches: Range[] = [];
  let from = line.tunnel.min;
  for (const chamber of chambers) {
    if (chamber.min > from) {
      stretches.push({ min: from, max: chamber.min - 1 });
    }
    from = chamber.max + 1;
  }
  if (from <= line.tunnel.max) {
    stretches.push({ min: from, max: line.tunnel.max });
  }
  return stretches;
}

/** 1 + the index of the piece of walkway, floor and bridges joined along edges, that holds each tile of the sewer, 0 elsewhere, and how many pieces there are. */
function labelWalkways(
  grid: MapState['grid'],
  sewer: Uint8Array,
): { of: Int32Array; pieces: number } {
  const { width } = grid;
  const of = new Int32Array(sewer.length);
  const walkway = (x: number, y: number) =>
    grid.inBounds(x, y) &&
    sewer[y * width + x] === 1 &&
    (grid.get(x, y) === Tile.Floor || grid.get(x, y) === Tile.Bridge);
  let pieces = 0;
  for (let start = 0; start < sewer.length; ++start) {
    const sx = start % width;
    if (of[start] !== 0 || !walkway(sx, (start - sx) / width)) {
      continue;
    }
    of[start] = ++pieces;
    for (const queue = [start]; queue.length > 0;) {
      const tile = queue.pop() as number;
      const x = tile % width;
      const y = (tile - x) / width;
      for (const step of DIRECTIONS) {
        const [nx, ny] = [x + step.x, y + step.y];
        if (walkway(nx, ny) && of[ny * width + nx] === 0) {
          of[ny * width + nx] = pieces;
          queue.push(ny * width + nx);
        }
      }
    }
  }
  return { of, pieces };
}
