import type { Area } from '../core/area';
import type { Grid } from '../core/grid';
import { pickRandom } from '../core/pick-random';
import type { Point } from '../core/point';
import type { Random } from '../core/random';
import { randomInt } from '../core/random-int';
import type { Range } from '../core/range';
import type { NoiseFunction } from '../noise/noise-function';
import { digRoutedVein } from './dig-routed-vein';
import { LANE_SPACING } from './dig-vein';
import { findHallBoundary } from './find-hall-boundary';
import { findNearestPair } from './find-nearest-pair';
import type { MineHallEntrances } from './mine-hall-entrances';
import type { MinePassage } from './mine-passage';
import { pickEntrance } from './pick-entrance';

/** How many times a vein is tried between other tiles when it finds no route, before it is given up. */
const VEIN_ATTEMPTS = 10;
/** How many of those attempts keep to the side that faces the target, when that is what is asked for. The rest may use any side, so that a vein can go round a hall when the way between them is taken. */
const FACING_ATTEMPTS = 5;
/** How far a vein's end keeps from entrances and junctions that are there already, when it can. */
const JUNCTION_GAP = 3;

/** The settings of the network of veins that joins the halls. */
export interface HallNetworkSettings {
  hallVeins: Range;
  hallEntrances: MineHallEntrances;
  veinWidth: Range;
  veinWindiness: number;
}

/** A tile on the boundary of a hall or a vein, where a new vein may end, and which of them it is. */
interface Target extends Point {
  node: number;
}

/** A vein that was dug: where it started and what it ended on. Halls and veins are nodes, halls first. */
interface DugVein {
  passage: MinePassage;
  floor: Point[];
  from: number;
  to: number;
}

/**
 * Digs the veins that join the halls into one network, and returns them with
 * the halls that are in it. The two halls nearest each other are joined first.
 * Then the hall nearest the network is joined to the nearest tile of any hall
 * or vein in it, until all are, so a vein may end on another vein. Last, extra
 * veins are dug from random halls to the nearest part of the network that
 * does not leave that hall, so they make loops, until `hallVeins` says there
 * are enough. Every vein is routed around the halls and kept clear of them.
 * A hall that finds no route is tried again once the others are in, and then
 * with the rules relaxed, so a hall that is boxed in joins what it is boxed in
 * by. A vein is dug into the grid as soon as it is routed.
 */
export function growHallNetwork(
  grid: Grid,
  random: Random,
  noise: NoiseFunction,
  halls: readonly Area[],
  floors: readonly Point[][],
  settings: HallNetworkSettings,
): { passages: MinePassage[]; joined: Set<number> } {
  const middles: Point[] = halls.map((hall) => ({
    x: hall.x + Math.floor(hall.width / 2),
    y: hall.y + Math.floor(hall.height / 2),
  }));
  const veins: DugVein[] = [];
  // every entrance and end of a vein so far
  const junctions: Point[] = [];
  const joined = new Set<number>();

  const floorOf = (node: number): readonly Point[] =>
    node < halls.length
      ? (floors[node] ?? [])
      : (veins[node - halls.length]?.floor ?? []);
  const networkNodes = (): number[] => [
    ...joined,
    ...veins.map((_, index) => halls.length + index),
  ];
  /** The tiles of the boundaries of the nodes, apart from the junctions that are there already, unless that leaves none. */
  const targetsOf = (nodes: readonly number[]): Target[] => {
    const targets: Target[] = [];
    for (const node of nodes) {
      for (const { x, y } of findHallBoundary(grid, floorOf(node))) {
        targets.push({ x, y, node });
      }
    }
    const apart = targets.filter((target) =>
      junctions.every(
        (junction) =>
          Math.hypot(target.x - junction.x, target.y - junction.y) >=
          JUNCTION_GAP,
      ),
    );
    return apart.length > 0 ? apart : targets;
  };

  /** Digs a vein from a hall to the nearest of the targets. Returns whether it did. */
  const join = (
    hall: number,
    targets: readonly Target[],
    relaxed: boolean,
  ): boolean => {
    const middle = middles[hall];
    const boundary = findHallBoundary(grid, floors[hall] ?? []);
    const nearest = findNearestPair(boundary, targets);
    if (!middle || !nearest) {
      return false;
    }
    for (let attempt = 0; attempt < VEIN_ATTEMPTS; ++attempt) {
      const facing =
        settings.hallEntrances === 'facing' && attempt < FACING_ATTEMPTS;
      const from = pickEntrance(
        random,
        boundary,
        middle,
        facing ? nearest.target : undefined,
        junctions,
      );
      const end = findNearestPair([from], targets)?.target;
      if (!end) {
        return false;
      }
      const to = { x: end.x, y: end.y };
      const vein = digRoutedVein(
        grid,
        noise,
        from,
        to,
        {
          width: randomInt(
            random,
            settings.veinWidth.min,
            settings.veinWidth.max,
          ),
          windiness: settings.veinWindiness,
        },
        0.5 + veins.length * LANE_SPACING,
        relaxed,
      );
      if (vein) {
        junctions.push(from, to);
        veins.push({
          passage: vein.passage,
          floor: vein.carved.map((tile) => ({
            x: tile % grid.width,
            y: Math.floor(tile / grid.width),
          })),
          from: hall,
          to: end.node,
        });
        joined.add(hall);
        return true;
      }
    }
    return false;
  };

  /** Joins the two halls that lie nearest each other, or the next nearest when they cannot be. */
  const startNetwork = (): void => {
    const pairs: { from: number; to: number; distance: number }[] = [];
    for (let from = 0; from < halls.length; ++from) {
      for (let to = from + 1; to < halls.length; ++to) {
        const nearest = findNearestPair(
          findHallBoundary(grid, floors[from] ?? []),
          findHallBoundary(grid, floors[to] ?? []),
        );
        pairs.push({ from, to, distance: nearest?.distance ?? Infinity });
      }
    }
    pairs.sort((a, b) => a.distance - b.distance);
    for (const relaxed of [false, true]) {
      for (const { from, to } of pairs) {
        if (join(from, targetsOf([to]), relaxed)) {
          joined.add(to);
          return;
        }
      }
    }
    // nothing can be joined, so the network is a hall of its own
    joined.add(0);
  };

  /** Joins the halls that are left, the one nearest the network first. */
  const joinRest = (): void => {
    let pending = [...halls.keys()].filter((hall) => !joined.has(hall));
    for (const relaxed of [false, true]) {
      while (pending.length > 0) {
        const targets = targetsOf(networkNodes());
        const byDistance = pending
          .map((hall) => ({
            hall,
            distance:
              findNearestPair(
                findHallBoundary(grid, floors[hall] ?? []),
                targets,
              )?.distance ?? Infinity,
          }))
          .sort((a, b) => a.distance - b.distance);
        const next = byDistance.find(({ hall }) =>
          join(hall, targets, relaxed),
        );
        if (!next) {
          break;
        }
        pending = pending.filter((hall) => hall !== next.hall);
      }
    }
  };

  /** Digs the veins that `hallVeins` asks for beyond the ones that join the halls. */
  const digExtras = (): void => {
    const wanted = randomInt(
      random,
      settings.hallVeins.min,
      settings.hallVeins.max,
    );
    const extras = wanted - veins.length;
    for (let n = 0; n < extras; ++n) {
      const hall = pickRandom(random, [...joined]);
      // a vein that leaves the hall already is not wanted as an end, as the first choice
      const nodes = networkNodes().filter(
        (node) =>
          node !== hall &&
          (node < halls.length ||
            (veins[node - halls.length]?.from !== hall &&
              veins[node - halls.length]?.to !== hall)),
      );
      join(hall, targetsOf(nodes), false);
    }
  };

  if (halls.length === 1) {
    joined.add(0);
  } else if (halls.length > 1) {
    startNetwork();
    joinRest();
    digExtras();
  }
  return { passages: veins.map(({ passage }) => passage), joined };
}
