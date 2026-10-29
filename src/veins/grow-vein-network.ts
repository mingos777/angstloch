import { pickRandom } from '../core/pick-random';
import type { Point } from '../core/point';
import type { LayoutSymmetry } from '../core/layout-symmetry';
import type { Random } from '../core/random';
import { randomInt } from '../core/random-int';
import type { Range } from '../core/range';
import { Tile } from '../core/tile';
import type { NoiseFunction } from '../noise/noise-function';
import { createTransforms } from '../rooms/templates/create-transforms';
import type { MapState } from '../pipeline/map-state';
import { openReserved } from '../pipeline/open-reserved';
import { Reserve } from '../pipeline/reserve';
import { digRoutedVein } from './dig-routed-vein';
import { LANE_SPACING, MARGIN } from './dig-vein';
import { findNearestPair } from './find-nearest-pair';
import { findOutsideRock } from './find-outside-rock';
import { findReachableTargets } from './find-reachable-targets';
import { findPiecePorts } from './find-piece-ports';
import type { PiecePort } from './find-piece-ports';
import { findPieces } from './find-pieces';
import type { MineHallEntrances } from './mine-hall-entrances';
import type { MinePassage } from './mine-passage';
import { pickEntrance } from './pick-entrance';
import { scatterJunctions } from './scatter-junctions';
import { stampVeinTwins } from './stamp-vein-twins';

/** How many times a vein is tried between other tiles when it finds no route, before it is given up. */
const VEIN_ATTEMPTS = 10;
/** How many of those attempts keep to the side that faces the target, when that is what is asked for. The rest may use any side, so that a vein can go round a piece when the way between them is taken. */
const FACING_ATTEMPTS = 5;
/** How far a vein's end keeps from entrances and junctions that are there already, when it can. */
const JUNCTION_GAP = 3;
/** How many extra veins are tried for the loops, at most, whatever the density says. */
const LOOP_ATTEMPTS = 120;
/** The spacing below which no finer junctions are scattered. */
const MIN_SPACING = 6;
/** How much finer each scatter of junctions is than the one before it. */
const FINER = 0.6;
/** How far a junction keeps from floor and from reserved tiles, so that a vein of any width fits between. */
const JUNCTION_CLEARANCE = 2;

/** The passes of a join: first strict, then relaxed. */
const PASSES = [false, true] as const;

/** The settings of the network of veins. */
export interface VeinNetworkSettings {
  density: number;
  veinWidth: Range;
  veinWindiness: number;
  veinSpacing: number;
  hallEntrances: MineHallEntrances;
  /** The symmetry that every vein follows by getting twins. */
  symmetry: LayoutSymmetry;
  /** The chance that a vein gets its twins, rolled once for every vein. */
  symmetryChance: number;
  /** The lane of the noise for the first vein, and the lanes of the veins after it. Defaults to 0.5. */
  lane?: number;
}

/** A tile of a node where a new vein may end, and which node it is. */
interface Target extends PiecePort {
  node: number;
}

/** The nodes a vein joins, apart from the vein itself. */
interface VeinEnds {
  from: number;
  to: number;
}

/** The middle of the box around some tiles. */
function middleOf(tiles: readonly Point[]): Point {
  const xs = tiles.map(({ x }) => x);
  const ys = tiles.map(({ y }) => y);
  return {
    x: Math.floor((Math.min(...xs) + Math.max(...xs)) / 2),
    y: Math.floor((Math.min(...ys) + Math.max(...ys)) / 2),
  };
}

/**
 * Digs the veins of a network over the map as it is, and returns them. The
 * pieces of open ground are the nodes: the two nearest each other are joined
 * first, then the piece nearest the network to the nearest port of anything in
 * it, veins included, so a vein may end on another vein. A vein enters a room
 * through an `Openable` tile, which is opened. Every vein is routed through
 * free rock round the pieces and never across one, so nothing inside a piece,
 * such as a pillar, is dug.
 *
 * Then, while less than `density` of the rock that was free is dug, the
 * junctions of a web are joined the same way, the one nearest the network
 * first, and when none are left, extra veins make loops. A piece that no vein
 * can reach is left as it is.
 */
export function growVeinNetwork(
  state: Pick<MapState, 'grid' | 'reserved'>,
  random: Random,
  noise: NoiseFunction,
  settings: VeinNetworkSettings,
): MinePassage[] {
  const { grid, reserved } = state;
  const view = { grid, reserved };
  const images = createTransforms(
    settings.symmetry,
    grid.width,
    grid.height,
    false,
  );
  // the floor of each node: the pieces first, then the veins and junctions dug
  const nodes: Point[][] = findPieces(grid);
  const mandatory = nodes.length;
  const middles: Point[] = nodes.map(middleOf);
  const ends = new Map<number, VeinEnds>();
  const passages: MinePassage[] = [];
  // every entrance and end of a vein so far
  const junctions: Point[] = [];
  const joined = new Set<number>();
  let outside = findOutsideRock(grid);
  let stale = false;
  // the last resort of the joins: rock that floor shuts in counts too
  let anyRock = false;
  const everywhere = new Uint8Array(grid.width * grid.height).fill(1);
  let dug = 0;

  const free = (x: number, y: number) =>
    x >= MARGIN &&
    y >= MARGIN &&
    x < grid.width - MARGIN &&
    y < grid.height - MARGIN &&
    grid.get(x, y) === Tile.Wall &&
    reserved[y * grid.width + x] === Reserve.None;
  let diggable = 0;
  for (let y = 0; y < grid.height; ++y) {
    for (let x = 0; x < grid.width; ++x) {
      diggable += free(x, y) ? 1 : 0;
    }
  }

  const portsOf = (node: number): PiecePort[] => {
    if (anyRock) {
      return findPiecePorts(grid, reserved, nodes[node] ?? [], everywhere);
    }
    if (stale) {
      outside = findOutsideRock(grid);
      stale = false;
    }
    return findPiecePorts(grid, reserved, nodes[node] ?? [], outside);
  };
  const networkNodes = (): number[] => [...joined];
  /** The ports of the nodes, apart from the junctions that are there already, unless that leaves none. */
  const targetsOf = (list: readonly number[]): Target[] => {
    const targets: Target[] = list.flatMap((node) =>
      portsOf(node).map((port) => ({ ...port, node })),
    );
    const apart = targets.filter((target) =>
      junctions.every(
        (junction) =>
          Math.hypot(target.x - junction.x, target.y - junction.y) >=
          JUNCTION_GAP,
      ),
    );
    return apart.length > 0 && !anyRock ? apart : targets;
  };

  /** Opens the walls of rooms that are ports, and returns a function that closes them again. */
  const openDoors = (ports: readonly PiecePort[]): (() => void) => {
    const undo: (() => void)[] = [];
    for (const port of ports.filter(({ door }) => door)) {
      const saved: [number, number][] = [];
      for (let dy = -1; dy <= 1; ++dy) {
        for (let dx = -1; dx <= 1; ++dx) {
          if (grid.inBounds(port.x + dx, port.y + dy)) {
            const at = (port.y + dy) * grid.width + port.x + dx;
            saved.push([at, reserved[at] as number]);
          }
        }
      }
      grid.set(port.x, port.y, Tile.Floor);
      openReserved(view, port.x, port.y);
      undo.push(() => {
        grid.set(port.x, port.y, Tile.Wall);
        for (const [at, value] of saved) {
          reserved[at] = value;
        }
      });
    }
    return () => {
      undo.reverse().forEach((close) => {
        close();
      });
    };
  };

  /** Digs a vein from a node to the nearest of the targets. Returns whether it did. */
  const join = (
    node: number,
    targets: readonly Target[],
    relaxed: boolean,
  ): boolean => {
    const own = portsOf(node);
    const middle = middles[node];
    // an end that no route reaches is not tried again
    let candidates = anyRock
      ? findReachableTargets(grid, reserved, own, targets)
      : targets;
    const nearest = findNearestPair(own, candidates);
    if (!middle || !nearest) {
      return false;
    }
    const byTile = new Map(
      own.map((port) => [port.y * grid.width + port.x, port]),
    );
    // a port that no route leaves is not tried again either
    let starts = anyRock
      ? findReachableTargets(grid, reserved, candidates, own)
      : own;
    if (starts.length === 0) {
      return false;
    }
    for (let attempt = 0; attempt < VEIN_ATTEMPTS; ++attempt) {
      const facing =
        settings.hallEntrances === 'facing' && attempt < FACING_ATTEMPTS;
      const picked = pickEntrance(
        random,
        starts,
        middle,
        facing ? nearest.target : undefined,
        junctions,
      );
      const from = byTile.get(picked.y * grid.width + picked.x) as PiecePort;
      // from this very port, the flood tells which ends a route can reach
      const reachable = anyRock
        ? findReachableTargets(grid, reserved, [from], candidates)
        : candidates;
      const end = findNearestPair([from], reachable)?.target;
      if (!end) {
        if (anyRock) {
          continue;
        }
        return false;
      }
      const close = openDoors([from, end]);
      const vein = digRoutedVein(
        grid,
        noise,
        from,
        end,
        {
          width: randomInt(
            random,
            settings.veinWidth.min,
            settings.veinWidth.max,
          ),
          windiness: settings.veinWindiness,
          protect: reserved,
        },
        (settings.lane ?? 0.5) + passages.length * LANE_SPACING,
        relaxed,
      );
      if (!vein) {
        close();
        candidates = candidates.filter((target) => target !== end);
        if (starts.length > 1) {
          starts = starts.filter((port) => port !== from);
        }
        continue;
      }
      stale = true;
      dug += vein.carved.length;
      junctions.push(from, end);
      passages.push(vein.passage);
      if (images.length > 0 && random() < settings.symmetryChance) {
        const twins = stampVeinTwins(
          view,
          images,
          findOutsideRock(grid),
          vein,
          [from, end].filter(({ door }) => door),
        );
        dug += twins.dug;
        passages.push(...twins.passages);
        for (const { point } of images) {
          junctions.push(point(from), point(end));
        }
      }
      const created = nodes.length;
      nodes.push(
        vein.carved.map((tile) => ({
          x: tile % grid.width,
          y: Math.floor(tile / grid.width),
        })),
      );
      middles.push(middleOf(nodes[created] ?? []));
      ends.set(created, { from: node, to: end.node });
      joined.add(node);
      joined.add(created);
      return true;
    }
    return false;
  };

  /** Joins the two pieces that lie nearest each other, or the next nearest when they cannot be. */
  const startNetwork = (): void => {
    const pairs: { from: number; to: number; distance: number }[] = [];
    for (let from = 0; from < mandatory; ++from) {
      for (let to = from + 1; to < mandatory; ++to) {
        const nearest = findNearestPair(portsOf(from), portsOf(to));
        pairs.push({ from, to, distance: nearest?.distance ?? Infinity });
      }
    }
    pairs.sort((a, b) => a.distance - b.distance);
    for (const relaxed of PASSES) {
      for (const { from, to } of pairs) {
        if (join(from, targetsOf([to]), relaxed)) {
          joined.add(to);
          return;
        }
      }
    }
    // nothing can be joined, so the network is a piece of its own
    joined.add(0);
  };

  /** The nodes that are not in a piece of floor with the network already, which twins of veins can bring about. */
  const withoutConnected = (list: readonly number[]): number[] => {
    if (images.length === 0) {
      return [...list];
    }
    const piece = new Map<number, number>();
    findPieces(grid).forEach((tiles, index) => {
      for (const { x, y } of tiles) {
        piece.set(y * grid.width + x, index);
      }
    });
    const reached = new Set<number | undefined>(
      networkNodes().map((node) => {
        const first = nodes[node]?.[0];
        return first && piece.get(first.y * grid.width + first.x);
      }),
    );
    return list.filter((node) => {
      const first = nodes[node]?.[0];
      return !first || !reached.has(piece.get(first.y * grid.width + first.x));
    });
  };

  /**
   * The last resort for a piece boxed in by the others, which no vein of free
   * rock reaches: it digs through the rock that floor shuts in, to the nearest
   * piece it can reach, whether or not that is in the network yet. Whatever it
   * joins is brought along, since the pieces are told apart by the floor they
   * share.
   */
  const joinBoxedIn = (): void => {
    anyRock = true;
    // what is joined to these is in the network, once the floor of the veins joins it
    const network = networkNodes();
    for (let round = 0; round < mandatory; ++round) {
      const label = new Map<number, number>();
      findPieces(grid).forEach((tiles, index) => {
        for (const { x, y } of tiles) {
          label.set(y * grid.width + x, index);
        }
      });
      const labelOf = (node: number): number | undefined => {
        const first = nodes[node]?.[0];
        return first && label.get(first.y * grid.width + first.x);
      };
      const reached = new Set(network.map(labelOf));
      const pending = [...Array(mandatory).keys()].filter(
        (node) => !reached.has(labelOf(node)),
      );
      const progressed = pending.some((node) => {
        const own = labelOf(node);
        const targets = nodes
          .map((_, other) => other)
          .filter((other) => other !== node && labelOf(other) !== own)
          .flatMap((other) =>
            portsOf(other).map((port) => ({ ...port, node: other })),
          );
        return join(node, targets, true);
      });
      if (!progressed) {
        break;
      }
    }
    anyRock = false;
  };

  /** Joins the pieces that are left, the one nearest the network first. */
  const joinRest = (): void => {
    let pending = [...Array(mandatory).keys()].filter(
      (node) => !joined.has(node),
    );
    for (const relaxed of PASSES) {
      while (pending.length > 0) {
        pending = withoutConnected(pending);
        if (pending.length === 0) {
          break;
        }
        const targets = targetsOf(networkNodes());
        const byDistance = pending
          .map((node) => ({
            node,
            distance:
              findNearestPair(portsOf(node), targets)?.distance ?? Infinity,
          }))
          .sort((a, b) => a.distance - b.distance);
        const next = byDistance.find(({ node }) =>
          join(node, targets, relaxed),
        );
        if (!next) {
          break;
        }
        pending = pending.filter((node) => node !== next.node);
      }
    }
  };

  /** Whether a junction can be dug at a spot: free rock with room for a vein round it, that a vein can reach. */
  const fits = (spot: Point): boolean => {
    if (stale) {
      outside = findOutsideRock(grid);
      stale = false;
    }
    for (let dy = -JUNCTION_CLEARANCE; dy <= JUNCTION_CLEARANCE; ++dy) {
      for (let dx = -JUNCTION_CLEARANCE; dx <= JUNCTION_CLEARANCE; ++dx) {
        const [x, y] = [spot.x + dx, spot.y + dy];
        if (
          grid.inBounds(x, y) &&
          (grid.get(x, y) !== Tile.Wall ||
            reserved[y * grid.width + x] !== Reserve.None)
        ) {
          return false;
        }
      }
    }
    return free(spot.x, spot.y) && outside[spot.y * grid.width + spot.x] === 1;
  };

  /** Adds a junction as a node of its own: one tile of floor, to be joined. */
  const stampJunction = (spot: Point): number => {
    grid.set(spot.x, spot.y, Tile.Floor);
    stale = true;
    nodes.push([spot]);
    middles.push(spot);
    return nodes.length - 1;
  };
  const removeJunction = (spot: Point): void => {
    grid.set(spot.x, spot.y, Tile.Wall);
    stale = true;
    nodes.pop();
    middles.pop();
  };

  const wanted = settings.density * diggable;

  /** Joins the junctions of one scatter, the one nearest the network first, until the density is reached. */
  const joinJunctions = (spacing: number): void => {
    const spots = scatterJunctions(grid, random, spacing);
    if (joined.size === 0) {
      // an empty map: the first junction, nearest the middle, is the network
      const middle = { x: grid.width / 2, y: grid.height / 2 };
      const first = spots
        .filter(fits)
        .sort(
          (a, b) =>
            Math.hypot(a.x - middle.x, a.y - middle.y) -
            Math.hypot(b.x - middle.x, b.y - middle.y),
        )[0];
      if (!first) {
        return;
      }
      spots.splice(spots.indexOf(first), 1);
      joined.add(stampJunction(first));
      dug += 1;
    }
    while (dug < wanted && spots.length > 0) {
      const targets = targetsOf(networkNodes());
      const ranked = spots
        .filter(fits)
        .map((spot) => ({
          spot,
          distance: findNearestPair([spot], targets)?.distance ?? Infinity,
        }))
        .sort((a, b) => a.distance - b.distance);
      const next = ranked[0];
      if (!next || next.distance === Infinity) {
        return;
      }
      spots.splice(spots.indexOf(next.spot), 1);
      if (!join(stampJunction(next.spot), targets, false)) {
        removeJunction(next.spot);
      }
    }
  };

  /** Digs extra veins from random nodes to the nearest part of the network that does not leave that node, which makes loops. */
  const joinLoops = (): void => {
    for (let tries = 0; dug < wanted && tries < LOOP_ATTEMPTS; ++tries) {
      const own = networkNodes().filter((node) => !ends.has(node));
      if (own.length === 0) {
        return;
      }
      const node = pickRandom(random, own);
      // a vein that leaves the node already is not wanted as an end, as the first choice
      const others = networkNodes().filter((other) => {
        const vein = ends.get(other);
        return other !== node && vein?.from !== node && vein?.to !== node;
      });
      join(node, targetsOf(others), false);
    }
  };

  if (mandatory === 1) {
    joined.add(0);
  } else if (mandatory > 1) {
    startNetwork();
    joinRest();
    joinBoxedIn();
  }
  if (settings.density > 0) {
    // a web that is too sparse for the density gets finer junctions in between
    for (
      let spacing = settings.veinSpacing;
      dug < wanted && spacing >= MIN_SPACING;
      spacing = Math.floor(spacing * FINER)
    ) {
      joinJunctions(spacing);
    }
    joinLoops();
  }
  return passages;
}
