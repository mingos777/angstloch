import type { Point } from '../core/point';
import type { Random } from '../core/random';
import { randomInt } from '../core/random-int';
import type { Range } from '../core/range';
import { traceTiles } from '../roads/trace-tiles';
import { dilateMask } from './dilate-mask';
import { curveTiles } from './curve-tiles';
import { findLandPath } from './find-land-path';
import type { LaidStreams } from './laid-streams';
import { smoothPath } from './smooth-path';

/** Tiles from the water within which a road counts as near a stream. */
const ZONE = 6;
/** Tiles of a road that a stretch near a stream may be joined to the next one across: a road never crosses the same stream twice within them. */
const MERGE = 20;
/** How far from the water, in tiles, the middle of a road keeps, the widest first: a road of 3 tiles that bends reaches 2 tiles from its middle. */
const VERGES = [3, 2, 1];
/** The longest straight crossing searched for, in tiles. */
const LONGEST = 40;
/** How many tiles of the road before and after a stretch tell which way the road is going. */
const LEAD = 4;
/** How far from the road a crossing may be placed, in tiles. */
const NEAR = 15;
/** How far along the edge of the map an end of a road is moved to keep to its own land, in tiles. */
const SLIDE = 30;
/** How many tiles in from its end the road is taken to be on the land that it keeps to. */
const SETTLE = 10;
/** How close another stream may be to a crossing before the crossing counts as crowded, in tiles. */
const CROWD = 8;

/**
 * Makes a function that keeps a road off the water of `streams`, except where
 * it crosses a stream. Where a road comes near a stream, the road is laid
 * again between the last tile before the stream and the first one after it,
 * over land only, and never touching the water. If the two tiles lie on
 * different sides of the water, so that the road must cross it, the new road
 * has one straight crossing at an angle from `angle`, in degrees, to the
 * stream, and joins it to both tiles over land. Stretches of a road that are
 * close together count as one, so a road that wanders back and forth over a
 * stream still crosses it only once. The ends of the road stay where they
 * are, even when they lie near the water, and a road that never comes near a
 * stream is left as it is.
 */
export function createSteerAcrossStreams(
  streams: LaidStreams,
  random: Random,
  angle: Range,
): (points: Point[]) => Point[] {
  const { mapWidth, mapHeight } = streams.map;
  const { water } = streams;
  const key = ({ x, y }: Point) => y * mapWidth + x;

  // every tile of a stream's centerline, with the heading there
  const centers: { x: number; y: number; heading: number; stream: number }[] =
    [];
  const seen = new Set<number>();
  for (const [stream, { points }] of streams.map.roads.entries()) {
    points.forEach((tile, index) => {
      if (!seen.has(key(tile))) {
        seen.add(key(tile));
        const before = points[Math.max(0, index - 3)] ?? tile;
        const after = points[Math.min(points.length - 1, index + 3)] ?? tile;
        centers.push({
          x: tile.x,
          y: tile.y,
          heading: Math.atan2(after.y - before.y, after.x - before.x),
          stream,
        });
      }
    });
  }
  const widest = Math.max(...streams.map.roads.map(({ width }) => width));
  const zone = dilateMask(water, mapWidth, mapHeight, ZONE);
  const verges = VERGES.map((radius) =>
    dilateMask(water, mapWidth, mapHeight, radius),
  );

  // the pieces of land the water cuts the map into
  const pieces = new Int32Array(water.length).fill(-1);
  let count = 0;
  for (let start = 0; start < water.length; ++start) {
    if (pieces[start] !== -1 || water[start] === 1) {
      continue;
    }
    pieces[start] = count;
    const pending = [start];
    for (let at = pending.pop(); at !== undefined; at = pending.pop()) {
      const x = at % mapWidth;
      const y = Math.floor(at / mapWidth);
      for (const [nx, ny] of [
        [x - 1, y],
        [x + 1, y],
        [x, y - 1],
        [x, y + 1],
      ] as const) {
        const next = ny * mapWidth + nx;
        if (
          nx >= 0 &&
          ny >= 0 &&
          nx < mapWidth &&
          ny < mapHeight &&
          pieces[next] === -1 &&
          water[next] !== 1
        ) {
          pieces[next] = count;
          pending.push(next);
        }
      }
    }
    ++count;
  }

  /**
   * A path over land from one tile to another, leaving in the direction
   * `startAngle` and arriving in the direction `endAngle`: a smooth curve when
   * one keeps off the water, otherwise a path round the water, pulled taut.
   */
  const around = (
    from: Point,
    to: Point,
    startAngle: number,
    endAngle: number,
  ): Point[] => {
    const curve = curveTiles(from, to, startAngle, endAngle);
    for (const verge of verges) {
      if (
        curve.every(
          ({ x, y }, index) =>
            index === 0 ||
            index === curve.length - 1 ||
            (x >= 0 &&
              y >= 0 &&
              x < mapWidth &&
              y < mapHeight &&
              verge[y * mapWidth + x] !== 1),
        )
      ) {
        return curve;
      }
      const path = findLandPath(from, to, verge, mapWidth, mapHeight);
      if (path) {
        return smoothPath(path, verge, mapWidth, mapHeight);
      }
    }
    return traceTiles(from, to);
  };

  /** The bit of a stream nearest to a tile. */
  const nearestCenter = ({ x, y }: Point) => {
    let nearest = centers[0];
    let distance = Infinity;
    for (const center of centers) {
      const away = Math.hypot(x - center.x, y - center.y);
      if (away < distance) {
        distance = away;
        nearest = center;
      }
    }
    return nearest;
  };

  // which pieces of land lie across a band of water from which
  const neighbors = new Map<number, Set<number>>();
  for (let at = 0; at < water.length; ++at) {
    const here = pieces[at] ?? -1;
    if (here === -1) {
      continue;
    }
    const x = at % mapWidth;
    const y = Math.floor(at / mapWidth);
    for (const [dx, dy] of [
      [1, 0],
      [0, 1],
    ] as const) {
      for (let step = 1; step <= widest + 2; ++step) {
        const nx = x + dx * step;
        const ny = y + dy * step;
        if (nx >= mapWidth || ny >= mapHeight) {
          break;
        }
        const next = ny * mapWidth + nx;
        if (water[next] === 1) {
          continue;
        }
        const there = pieces[next] ?? -1;
        if (step > 1 && there !== here) {
          neighbors.set(here, (neighbors.get(here) ?? new Set()).add(there));
          neighbors.set(there, (neighbors.get(there) ?? new Set()).add(here));
        }
        break;
      }
    }
  }

  /** The number of crossings from each piece of land to another, for the pieces that can be reached. */
  const hopsFrom = (target: number) => {
    const hops = new Map<number, number>([[target, 0]]);
    const queue = [target];
    for (let head = 0; head < queue.length; ++head) {
      const piece = queue[head] as number;
      for (const next of neighbors.get(piece) ?? []) {
        if (!hops.has(next)) {
          hops.set(next, (hops.get(piece) ?? 0) + 1);
          queue.push(next);
        }
      }
    }
    return hops;
  };

  /** Lays the road across the stretch, as the shortest straight crossing there is, or gives up. */
  const cross = (
    stretch: Point[],
    before: Point,
    after: Point,
    arriving: number,
    leaving: number,
  ): Point[] | undefined => {
    const turn = (randomInt(random, angle.min, angle.max) * Math.PI) / 180;
    // how many crossings away from the land of the end of the stretch each piece of land is
    const here = pieces[key(before)] ?? -1;
    const target = pieces[key(after)] ?? -1;
    const hops = hopsFrom(target);
    // the crossing may be at the stretch, or at any bit of a stream near it
    const candidates = [
      ...stretch,
      ...centers.filter((center) =>
        stretch.some(
          (tile) => Math.hypot(tile.x - center.x, tile.y - center.y) <= NEAR,
        ),
      ),
    ];
    for (const verge of verges) {
      let best:
        | {
            long: number;
            crowded: number;
            runs: number;
            cost: number;
            entry: Point;
            exit: Point;
            direction: number;
          }
        | undefined;
      for (const center of candidates) {
        const nearest = nearestCenter(center);
        const heading = nearest?.heading ?? 0;
        // a crossing near where another stream joins is a poor one
        const crowded = centers.some(
          (other) =>
            other.stream !== nearest?.stream &&
            Math.hypot(other.x - center.x, other.y - center.y) <= CROWD,
        )
          ? 1
          : 0;
        // the four lines at the angle to the stream, each tried with the road going one way along it
        for (const direction of [
          heading + turn,
          heading - turn,
          heading + Math.PI + turn,
          heading + Math.PI - turn,
        ]) {
          // walk out of the water and its verge on both sides
          const ends = [-1, 1].map((sign) => {
            for (let step = 0; step <= LONGEST; ++step) {
              const tile = {
                x: Math.round(center.x + sign * step * Math.cos(direction)),
                y: Math.round(center.y + sign * step * Math.sin(direction)),
              };
              if (
                tile.x < 0 ||
                tile.y < 0 ||
                tile.x >= mapWidth ||
                tile.y >= mapHeight
              ) {
                return undefined;
              }
              if (verge[key(tile)] !== 1) {
                return tile;
              }
            }
            return undefined;
          });
          const [entry, exit] = ends;
          if (
            !entry ||
            !exit ||
            pieces[key(entry)] !== here ||
            (hops.get(pieces[key(exit)] ?? -1) ?? Infinity) >=
              (hops.get(here) ?? Infinity)
          ) {
            continue;
          }
          const cost =
            Math.abs(entry.x - before.x) +
            Math.abs(entry.y - before.y) +
            Math.abs(exit.x - after.x) +
            Math.abs(exit.y - after.y);
          // the fewer the bands of water the line crosses the better, then the shorter the road
          let runs = 0;
          let wet = 0;
          traceTiles(entry, exit).forEach((tile, index, line) => {
            const previous = line[index - 1];
            wet += water[key(tile)] ?? 0;
            if (
              water[key(tile)] === 1 &&
              (!previous || water[key(previous)] !== 1)
            ) {
              ++runs;
            }
          });
          // a crossing no longer than the widest stream is best, or it runs along one
          const long = wet > widest + 2 ? 1 : 0;
          if (
            !best ||
            long < best.long ||
            (long === best.long &&
              (runs < best.runs ||
                (runs === best.runs &&
                  (crowded < best.crowded ||
                    (crowded === best.crowded && cost < best.cost)))))
          ) {
            best = { long, crowded, runs, cost, entry, exit, direction };
          }
        }
      }
      if (best) {
        const across = [
          ...around(before, best.entry, arriving, best.direction).slice(1),
          ...traceTiles(best.entry, best.exit).slice(1),
        ];
        // on the land the road is going to, or on land from which it crosses again
        const rest =
          pieces[key(best.exit)] === target
            ? around(best.exit, after, best.direction, leaving).slice(1, -1)
            : cross(stretch, best.exit, after, best.direction, leaving);
        if (rest) {
          return [...across, ...rest];
        }
      }
    }
    return undefined;
  };

  // the tiles along the edge of the map, clockwise
  const ring: Point[] = [];
  for (let x = 0; x < mapWidth; ++x) {
    ring.push({ x, y: 0 });
  }
  for (let y = 1; y < mapHeight; ++y) {
    ring.push({ x: mapWidth - 1, y });
  }
  for (let x = mapWidth - 2; x >= 0 && mapHeight > 1; --x) {
    ring.push({ x, y: mapHeight - 1 });
  }
  for (let y = mapHeight - 2; y >= 1 && mapWidth > 1; --y) {
    ring.push({ x: 0, y });
  }

  /** Moves an end of a road that lies on the edge of the map, and in or near the water, along the edge to the nearest tile that is clear of it. */
  const clearEnd = (tile: Point, piece: number | undefined): Point => {
    const free = (other: Point) => verges[0]?.[key(other)] !== 1;
    const at = ring.findIndex(({ x, y }) => x === tile.x && y === tile.y);
    // an end that is clear of the water but on other land than the road is on would have to cross at once
    const apart = piece !== undefined && pieces[key(tile)] !== piece;
    if (at === -1 || (free(tile) && !apart)) {
      return tile;
    }
    const edge = (other: Point) =>
      (other.x === tile.x && (tile.x === 0 || tile.x === mapWidth - 1)) ||
      (other.y === tile.y && (tile.y === 0 || tile.y === mapHeight - 1));
    // preferably on the land that the rest of the road is on and the same edge, then on the same edge, then anywhere
    for (const [onEdge, onLand] of free(tile)
      ? [[true, true]]
      : [
          [true, true],
          [true, false],
          [false, false],
        ]) {
      for (let away = 1; away < (onLand ? SLIDE : ring.length); ++away) {
        for (const other of [
          ring[(at + away) % ring.length],
          ring[(at - away + ring.length) % ring.length],
        ]) {
          if (
            other &&
            free(other) &&
            (!onEdge || edge(other)) &&
            (!onLand || piece === undefined || pieces[key(other)] === piece)
          ) {
            return other;
          }
        }
      }
    }
    return tile;
  };

  return (original) => {
    if (centers.length === 0) {
      return original;
    }
    // a road that starts or ends in the water starts or ends beside it instead
    const first = original[0];
    const last = original[original.length - 1];
    const points = [...original];
    if (first && last && points.length > 1) {
      // the land that the road is on a little way in from the end
      const outside = (tiles: Point[]) =>
        tiles.slice(SETTLE).find((tile) => water[key(tile)] !== 1);
      const startPiece = outside(points);
      const endPiece = outside([...points].reverse());
      points[0] = clearEnd(first, startPiece && pieces[key(startPiece)]);
      points[points.length - 1] = clearEnd(
        last,
        endPiece && pieces[key(endPiece)],
      );
    }

    // the runs of the road that come near a stream
    const runs: { first: number; last: number }[] = [];
    points.forEach((tile, at) => {
      if (zone[key(tile)] !== 1) {
        return;
      }
      const previous = runs[runs.length - 1];
      if (previous && previous.last === at - 1) {
        previous.last = at;
      } else {
        runs.push({ first: at, last: at });
      }
    });
    // near runs close together make one stretch
    const stretches: { first: number; last: number; runs: typeof runs }[] = [];
    for (const run of runs) {
      const previous = stretches[stretches.length - 1];
      if (previous && run.first - previous.last - 1 <= MERGE) {
        previous.last = run.last;
        previous.runs.push(run);
      } else {
        stretches.push({ ...run, runs: [run] });
      }
    }

    /** Lays the road again in place of the tiles from `first` to `last`, or gives up when it has to cross the water and cannot. */
    const lay = (first: number, last: number): Point[] | undefined => {
      // an end of the road stays where it is, so it is where the stretch starts or ends
      const before = points[first - 1] ?? points[0];
      const after = points[last + 1] ?? points[points.length - 1];
      const stretch = points.slice(first === 0 ? 1 : first, last + 1);
      if (
        !before ||
        !after ||
        before === after ||
        water[key(before)] === 1 ||
        water[key(after)] === 1
      ) {
        return points.slice(first, last + 1);
      }
      // the direction the road is going in at both ends of the stretch
      const behind = points[Math.max(0, first - 1 - LEAD)] ?? before;
      const ahead =
        points[Math.min(points.length - 1, last + 1 + LEAD)] ?? after;
      const arriving = Math.atan2(before.y - behind.y, before.x - behind.x);
      const leaving = Math.atan2(ahead.y - after.y, ahead.x - after.x);
      const body =
        pieces[key(before)] === pieces[key(after)]
          ? around(before, after, arriving, leaving).slice(1, -1)
          : cross(stretch, before, after, arriving, leaving);
      return (
        body && [
          ...(first === 0 ? [before] : []),
          ...body,
          ...(last === points.length - 1 ? [after] : []),
        ]
      );
    };

    const result: Point[] = [];
    let at = 0;
    for (const stretch of stretches) {
      // when the road cannot cross the whole stretch at once, it crosses each run in turn
      const whole = lay(stretch.first, stretch.last);
      const parts = whole ? [{ ...stretch, laid: whole }] : stretch.runs;
      for (const part of parts) {
        result.push(...points.slice(at, part.first));
        result.push(
          ...(('laid' in part ? part.laid : lay(part.first, part.last)) ??
            points.slice(part.first, part.last + 1)),
        );
        at = part.last + 1;
      }
    }
    result.push(...points.slice(at));
    return result;
  };
}
