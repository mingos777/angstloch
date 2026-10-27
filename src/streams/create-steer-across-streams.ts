import type { Point } from '../core/point';
import type { Random } from '../core/random';
import type { Range } from '../core/range';
import type { NoiseFunction } from '../noise/noise-function';
import { sharpestTurn } from '../roads/sharpest-turn';
import { traceTiles } from '../roads/trace-tiles';
import { createStreamTerrain } from './create-stream-terrain';
import type { CrossingPlan } from './crossing-plan';
import { curveTiles } from './curve-tiles';
import { findLandPath } from './find-land-path';
import type { LaidStreams } from './laid-streams';
import { planCrossings } from './plan-crossings';
import { smoothPath } from './smooth-path';
import { splineTiles } from './spline-tiles';

/** How many tiles of the road before and after a stretch tell which way the road is going. */
const LEAD = 4;
/** Tiles along the road from one bend to the next, as for roads as grown. */
const WAVELENGTH = 30;
/** The farthest in tiles that a road with a windiness of 1 strays from its curve, as for roads as grown. */
const MAX_OFFSET = 12;
/** A short leg strays at most this share of its length, so that it never loops about. */
const MAX_SHARE = 0.25;
/** How much of the windiness a leg tries in turn, when a windier one breaks a rule. */
const SWAYS = [1, 0.5, 0];
/** How far a leg keeps to its headings, as `curveTiles` takes it, tried in turn when a curve breaks a rule. */
const TENSIONS = [1, 0.6, 1.5];
/** How many tiles of a path round the water lie between the points that a rounded path is laid through, tried in turn. */
const SPACINGS = [8, 5, 3];
/** The sharpest turn a leg may take, in degrees as `sharpestTurn` measures it, unless no curve turns less. */
const TURN_LIMIT = 45;
/** How many tiles in a row a leg may run within a tile of the border of the map: more, and it runs along the edge. */
const EDGE_RUN = 6;
/** How far a leg may stray from the straight line between its ends: this share of its length, and this many tiles more. A curve that swings wider goes round the water a long way. */
const STRAY = 0.25;
const STRAY_SLACK = 3;

/** How the roads wind between their waypoints. */
export interface Winding {
  /** The noise of the road map, which bends the roads. */
  noise: NoiseFunction;
  /** How much the roads wind, from 0 (straight) to 1. */
  windiness: number;
}

/**
 * Makes a function that keeps a road off the water of `streams`, except
 * where it crosses a stream, given its centerline as grown and its width. A
 * road that keeps clear of the water and its verge (the water grown by half
 * the road's width and a tile) is left as it is. Any other is planned by
 * `planCrossings` and laid again through its plan: from its start, which
 * may move along the border, over each crossing in a straight line at an
 * angle from `angle`, in degrees, to the stream, to its end. Between the
 * waypoints a leg is a smooth curve that winds by `winding`, less where it
 * touches the bank, and the winding fades out at every waypoint. No leg
 * comes onto the verge, comes back within the road's width of itself,
 * runs along the edge of the map or strays far from its straight line, or turns more sharply than `TURN_LIMIT`
 * when a gentler curve keeps the other rules; where none does, the leg goes round the water by a path pulled
 * taut. A road that needs no crossing is laid again only where it came near
 * the water. `onPlan` is told every plan, for the playground. A road that
 * cannot be planned is left as it is.
 */
export function createSteerAcrossStreams(
  streams: LaidStreams,
  random: Random,
  angle: Range,
  winding?: Winding,
  onPlan?: (plan: CrossingPlan) => void,
): (points: Point[], width: number) => Point[] {
  const terrain = createStreamTerrain(streams);
  const { mapWidth, mapHeight } = terrain;
  const key = ({ x, y }: Point) => y * mapWidth + x;
  const inside = ({ x, y }: Point) =>
    x >= 0 && y >= 0 && x < mapWidth && y < mapHeight;
  const heading = (one: Point, other: Point) =>
    Math.atan2(other.y - one.y, other.x - one.x);
  let roads = 0;

  /** Whether a path comes back within `width` of a part of itself it has passed. */
  const doublesBack = (tiles: Point[], width: number) =>
    tiles.some((tile, at) =>
      tiles
        .slice(at + 2 * width + 1)
        .some(
          (other) => Math.hypot(other.x - tile.x, other.y - tile.y) <= width,
        ),
    );

  /** Whether a path runs within a tile of the border of the map for `EDGE_RUN` tiles in a row. */
  const alongEdge = (tiles: Point[]) => {
    let run = 0;
    for (const { x, y } of tiles) {
      run =
        Math.min(x, y, mapWidth - 1 - x, mapHeight - 1 - y) <= 1 ? run + 1 : 0;
      if (run >= EDGE_RUN) {
        return true;
      }
    }
    return false;
  };

  /**
   * A leg of the road over land from one tile to another, leaving heading
   * `leaving` and arriving heading `arriving`; a free heading mirrors the
   * other one about the straight line, so that the leg is an even arc.
   * `along` is how far along the road the leg starts, for the bends.
   */
  const leg = (
    from: Point,
    to: Point,
    leaving: number | undefined,
    arriving: number | undefined,
    verge: Uint8Array,
    width: number,
    lane: number,
    along: number,
  ): Point[] => {
    const chord = heading(from, to);
    const length = Math.hypot(to.x - from.x, to.y - from.y);
    /** How far a tile is from the straight line between the ends of the leg. */
    const astray = ({ x, y }: Point) => {
      const along = Math.max(
        0,
        Math.min(
          1,
          ((x - from.x) * (to.x - from.x) + (y - from.y) * (to.y - from.y)) /
            (length * length || 1),
        ),
      );
      return Math.hypot(
        x - from.x - along * (to.x - from.x),
        y - from.y - along * (to.y - from.y),
      );
    };
    const reach =
      (winding?.windiness ?? 0) * Math.min(MAX_OFFSET, MAX_SHARE * length);
    const fits = (tiles: Point[]) =>
      tiles.every(
        (tile, index) =>
          index === 0 ||
          index === tiles.length - 1 ||
          (inside(tile) && verge[key(tile)] !== 1),
      ) &&
      !doublesBack(tiles, width) &&
      !alongEdge(tiles) &&
      tiles.every((tile) => astray(tile) <= STRAY * length + STRAY_SLACK);
    // a free heading mirrors the other one, or else follows the straight line
    const headings = [
      [
        leaving ?? (arriving === undefined ? chord : 2 * chord - arriving),
        arriving ?? (leaving === undefined ? chord : 2 * chord - leaving),
      ],
      [leaving ?? chord, arriving ?? chord],
    ] as const;
    const curves = headings.flatMap(([starts, ends]) =>
      TENSIONS.flatMap((tension) =>
        SWAYS.map((share) =>
          curveTiles(
            from,
            to,
            starts,
            ends,
            (t) =>
              winding
                ? share *
                  reach *
                  Math.sin(Math.PI * t) *
                  winding.noise((along + t * length) / WAVELENGTH, lane)
                : 0,
            tension,
          ),
        ),
      ),
    );
    const curve =
      curves.find(
        (tiles) => fits(tiles) && sharpestTurn(tiles) <= TURN_LIMIT,
      ) ?? curves.find(fits);
    if (curve) {
      return curve;
    }
    // round the water by a path pulled taut, rounded where it can be, and
    // off the edge of the map but near its own ends, if there is such a way
    const offEdge = Uint8Array.from(verge, (tile, at) => {
      const x = at % mapWidth;
      const y = Math.floor(at / mapWidth);
      const nearEnd = [from, to].some(
        (end) => Math.max(Math.abs(end.x - x), Math.abs(end.y - y)) <= 3,
      );
      return tile === 1 ||
        (!nearEnd && Math.min(x, y, mapWidth - 1 - x, mapHeight - 1 - y) <= 1)
        ? 1
        : 0;
    });
    const [blocked, path] = [offEdge, verge]
      .map(
        (mask) =>
          [mask, findLandPath(from, to, mask, mapWidth, mapHeight)] as const,
      )
      .find(([, found]) => found) ?? [verge, undefined];
    if (!path) {
      return traceTiles(from, to);
    }
    const taut = smoothPath(path, blocked, mapWidth, mapHeight);
    const [starts, ends] = headings[1];
    const rounded = SPACINGS.map((spacing) =>
      splineTiles(
        taut.filter(
          (_, index) => index % spacing === 0 || index === taut.length - 1,
        ),
        starts,
        ends,
      ),
    );
    return (
      rounded.find(
        (tiles) => fits(tiles) && sharpestTurn(tiles) <= TURN_LIMIT,
      ) ??
      rounded.find(fits) ??
      taut
    );
  };

  /** The road through its plan, from its start to its end. */
  const lay = (
    plan: CrossingPlan,
    points: Point[],
    verge: Uint8Array,
    width: number,
    lane: number,
  ) => {
    const { start, end, crossings } = plan;
    const laid: Point[] = [start];
    const extend = (tiles: Point[]) => laid.push(...tiles.slice(1));
    const go = (
      to: Point,
      leaving: number | undefined,
      arriving: number | undefined,
    ) =>
      extend(
        leg(
          laid[laid.length - 1] ?? start,
          to,
          leaving,
          arriving,
          verge,
          width,
          lane,
          laid.length,
        ),
      );
    if (crossings.length === 0) {
      // the road as grown, laid again only where it comes near the water
      const body = [
        start,
        ...points.slice(
          plan.head.length + 1,
          points.length - plan.tail.length - 1,
        ),
        end,
      ];
      let at = 1;
      while (at < body.length) {
        const tile = body[at] as Point;
        if (verge[key(tile)] !== 1) {
          // next to the last tile, unless the start moved along the border
          extend(traceTiles(laid[laid.length - 1] as Point, tile));
          ++at;
          continue;
        }
        let after = at;
        while (
          verge[key(body[after] ?? end)] === 1 &&
          after < body.length - 1
        ) {
          ++after;
        }
        const before = laid[laid.length - 1] as Point;
        const target = body[after] ?? end;
        const behind = body[Math.max(0, at - 1 - LEAD)] ?? before;
        const ahead = body[Math.min(body.length - 1, after + LEAD)] ?? target;
        // free where the stretch reaches an end of the road
        go(
          target,
          behind === before ? undefined : heading(behind, before),
          ahead === target ? undefined : heading(target, ahead),
        );
        at = after + 1;
      }
      // a road that keeps to the water for long is better laid anew
      return sharpestTurn(laid) > TURN_LIMIT || doublesBack(laid, width)
        ? leg(start, end, undefined, undefined, verge, width, lane, 0)
        : laid;
    }
    let leaving: number | undefined;
    for (const crossing of crossings) {
      go(crossing.approach, leaving, crossing.direction);
      extend(traceTiles(crossing.approach, crossing.departure));
      leaving = crossing.direction;
    }
    go(end, leaving, undefined);
    return laid;
  };

  return (points, width) => {
    // a lane of the noise for every road, apart from those it was grown on
    const lane = 100.5 + roads * 7.31;
    ++roads;
    const verge = terrain.verge(Math.floor(width / 2) + 1);
    if (
      terrain.centers.length === 0 ||
      points.every((tile) => verge[key(tile)] !== 1)
    ) {
      return points;
    }
    const plan = planCrossings(terrain, points, width, random, angle);
    if (!plan) {
      return points;
    }
    onPlan?.(plan);
    return [
      ...plan.head,
      ...lay(plan, points, verge, width, lane),
      ...plan.tail,
    ];
  };
}
