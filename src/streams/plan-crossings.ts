import type { Point } from '../core/point';
import type { Random } from '../core/random';
import { randomInt } from '../core/random-int';
import type { Range } from '../core/range';
import { traceTiles } from '../roads/trace-tiles';
import { clearRoadEnd } from './clear-road-end';
import type { CrossingPlan } from './crossing-plan';
import type { PlannedCrossing } from './planned-crossing';
import type { StreamTerrain } from './stream-terrain';

/** The smallest piece of land, in tiles, that a road crosses on its way: smaller ones are scraps between streams. */
const MIN_PIECE = 20;
/** The farthest a crossing walks out of the water, in tiles. */
const LONGEST = 40;
/** How far a crossing walks at a time, in tiles. */
const STEP = 0.5;
/** How many tiles straight the road runs before and after the bridge, the longest first: fewer near the edge of the map. */
const LEADS = [4, 2, 0];
/** How much longer than the stream across a bridge may be, in tiles, before it counts as running along the stream. */
const WET_SLACK = 2;
/** How close another stream may be to a crossing before the crossing counts as crowded, in tiles. */
const CROWD = 8;
/** The weights of the ranking of crossings: a turn of this many degrees per tile counts 1, as do a crossing this many tiles from the road as grown and a crowded one; every band of water past the first counts `RUN_COST`. */
const TURN_RATE = 3;
const DRIFT = 10;
const CROWD_COST = 0.5;
/** How far from the road as grown a crossing is looked for, in tiles, the nearest first: farther only when there is none nearer. */
const WINDOWS = [10, 20, Infinity];
/** How long a walk over land between two waypoints may be: this many times the straight way along edges, and this many tiles more. */
const DETOUR_FACTOR = 1.5;
const DETOUR_SLACK = 8;
/** How many of the best crossings are tried in turn for each band of water, when a crossing leaves no way on. */
const CHOICES = 5;
/** How far from the road as grown the crossings of the route with the fewest bands of water may be, in tiles: farther, and the road would go far out of its way to skip a bridge. */
const FEWEST_WINDOW = 20;
/** How far along the border an end of the road may slide to make its leg to the nearest crossing gentler, in tiles. */
const SLIDE = 30;
/** The shallowest angle at which a road leaves the border without the cost `SHALLOW_COST`, in radians: a shallower one runs along the edge of the map. */
const SHALLOW = Math.PI / 6;
const SHALLOW_COST = 1;
/** How many tiles an end slides along the border for a cost of 1. */
const SLIDE_COST = 30;
const RUN_COST = 3;
/** The sharpest a leg between waypoints may turn, in degrees per tile, unless no plan turns less. */
const HARD_RATE = 6;

/**
 * Plans how a road, its centerline as grown, gets across the streams. Its
 * ends are moved along the border out of the water and its verge (the
 * water grown by half the road's width and a tile), and an end that lies
 * inside the map, the start of a branch say, keeps the road as grown up to
 * its first tile clear of the verge. Then the road goes over the fewest
 * pieces of land that it ran over as grown, in order, without the scraps
 * between streams and without the loops of a road that wanders back, by
 * the fewest bands of water from one to the next. Each band gets the
 * crossing that asks the road to turn least, from the start or the last
 * crossing to it, heading the way it crossed, and from it towards the end, then that lies nearest the
 * road as grown, away from other streams and over a single band of water,
 * among those within 10 tiles of the road as grown, or else 20, or else
 * any.
 * A crossing is a straight line at an angle from `angle`, in degrees, to the
 * stream, no longer than the stream across allows, with a few tiles of
 * straight road before and after. Returns `undefined` when the road cannot
 * be planned, because it never leaves the verge or there is no way across.
 */
export function planCrossings(
  terrain: StreamTerrain,
  points: Point[],
  width: number,
  random: Random,
  angle: Range,
): CrossingPlan | undefined {
  const { mapWidth, mapHeight, pieces, sizes, neighbors, centers, water } =
    terrain;
  const key = ({ x, y }: Point) => y * mapWidth + x;
  const inside = ({ x, y }: Point) =>
    x >= 0 && y >= 0 && x < mapWidth && y < mapHeight;
  const onBorder = ({ x, y }: Point) =>
    x === 0 || y === 0 || x === mapWidth - 1 || y === mapHeight - 1;
  const gap = Math.floor(width / 2) + 1;
  const verge = terrain.verge(gap);
  const clear = (tile: Point) => inside(tile) && verge[key(tile)] !== 1;
  const pieceOf = (tile: Point) => pieces[key(tile)] ?? -1;

  /** Where the road starts, and the tiles as grown that are kept before it, for `tiles` running from that end. */
  const settle = (tiles: Point[]) => {
    const end = tiles[0];
    if (!end) {
      return undefined;
    }
    if (onBorder(end)) {
      const inland = tiles.find(clear);
      const moved = clearRoadEnd(
        terrain,
        end,
        inland && pieceOf(inland),
        verge,
      );
      return clear(moved) ? { at: 0, tile: moved } : undefined;
    }
    const at = tiles.findIndex(clear);
    const tile = tiles[at];
    return tile ? { at, tile } : undefined;
  };
  const first = settle(points);
  const last = settle([...points].reverse());
  if (!first || !last || first.at >= points.length - 1 - last.at) {
    return undefined;
  }
  const { tile: start } = first;
  const { tile: end } = last;

  // the land the road ran over as grown, in order, without the scraps
  // between streams, and without the loops of a road that wanders back
  const from = pieceOf(start);
  const to = pieceOf(end);
  const visits: number[] = [from];
  for (const piece of [
    ...points.slice(first.at, points.length - last.at).map(pieceOf),
    to,
  ]) {
    if (piece === -1 || ((sizes[piece] ?? 0) < MIN_PIECE && piece !== to)) {
      continue;
    }
    const seen = visits.indexOf(piece);
    if (seen === -1) {
      visits.push(piece);
    } else {
      visits.length = seen + 1;
    }
  }

  /** The fewest bands of water from one piece of land to another, as the pieces after the first, through large pieces only. */
  const hops = (one: number, other: number): number[] | undefined => {
    const came = new Map([[one, one]]);
    const queue = [one];
    for (let index = 0; index < queue.length && !came.has(other); ++index) {
      const piece = queue[index] ?? -1;
      for (const next of neighbors.get(piece) ?? []) {
        if (
          !came.has(next) &&
          (next === other || (sizes[next] ?? 0) >= MIN_PIECE)
        ) {
          came.set(next, piece);
          queue.push(next);
        }
      }
    }
    if (!came.has(other)) {
      return undefined;
    }
    const path: number[] = [];
    for (let piece = other; piece !== one; piece = came.get(piece) ?? one) {
      path.unshift(piece);
    }
    return path;
  };
  // the land the road as grown goes over, from each piece to the next
  // across a band of water, or by the fewest bands where it went round
  const grownRoute: number[] | undefined = [from];
  for (const piece of visits.slice(1)) {
    const previous = grownRoute[grownRoute.length - 1] ?? from;
    const path = neighbors.get(previous)?.has(piece)
      ? [piece]
      : hops(previous, piece);
    if (!path) {
      grownRoute.length = 0;
      break;
    }
    grownRoute.push(...path);
  }
  // and the fewest bands of water, which may skip a piece between a stream
  // and a tributary by crossing below where they meet
  const fewest = hops(from, to);
  const routes = [
    ...(grownRoute.length > 0 ? [{ route: grownRoute, widest: Infinity }] : []),
    ...(fewest ? [{ route: [from, ...fewest], widest: FEWEST_WINDOW }] : []),
  ];

  // how far each bit of a stream is from the road as grown, and whether
  // another stream is near it
  const drifts = centers.map((center) =>
    Math.min(
      ...points.map(({ x, y }) => Math.hypot(x - center.x, y - center.y)),
    ),
  );
  const crowded = centers.map((center) =>
    centers.some(
      (other) =>
        other.stream !== center.stream &&
        Math.hypot(other.x - center.x, other.y - center.y) <= CROWD,
    ),
  );

  /**
   * The degrees per tile that a road turns, in a smooth curve, to run from
   * one tile to another, leaving the first heading `leaving` and arriving
   * at the second heading `arriving`, either of which may be free: twice the
   * larger of the two turns off the straight line, over its length.
   */
  const rate = (
    one: Point,
    leaving: number | undefined,
    other: Point,
    arriving: number | undefined,
  ) => {
    const length = Math.hypot(other.x - one.x, other.y - one.y);
    if (length < 1) {
      return 0;
    }
    const chord = Math.atan2(other.y - one.y, other.x - one.x);
    const off = (heading: number | undefined) =>
      heading === undefined
        ? 0
        : Math.abs(
            Math.atan2(Math.sin(chord - heading), Math.cos(chord - heading)),
          );
    return (2 * Math.max(off(leaving), off(arriving)) * 180) / Math.PI / length;
  };

  /** How many tiles a road walks over land clear of the verge from a tile to every other, or -1 where it cannot get. */
  const reach = (from: Point) => {
    const steps = new Int32Array(water.length).fill(-1);
    steps[key(from)] = 0;
    const queue = [key(from)];
    for (let index = 0; index < queue.length; ++index) {
      const at = queue[index] ?? 0;
      const x = at % mapWidth;
      const y = Math.floor(at / mapWidth);
      for (const next of [
        { x: x - 1, y },
        { x: x + 1, y },
        { x, y: y - 1 },
        { x, y: y + 1 },
      ]) {
        if (clear(next) && steps[key(next)] === -1) {
          steps[key(next)] = (steps[at] ?? 0) + 1;
          queue.push(key(next));
        }
      }
    }
    return steps;
  };
  /** How many tiles longer than the straight way along edges a walk from one tile to another is, or `undefined` when it is too long a detour or no way at all. */
  const detour = (steps: Int32Array, one: Point, other: Point) => {
    const walked = steps[key(other)] ?? -1;
    const straight = Math.abs(other.x - one.x) + Math.abs(other.y - one.y);
    return walked === -1 || walked > DETOUR_FACTOR * straight + DETOUR_SLACK
      ? undefined
      : walked - straight;
  };
  const fromEnd = reach(end);

  /**
   * Where an end of the road is best put for its leg to the nearest
   * crossing, whose rate of turning `leg` gives: when the end is on the
   * border and the road as grown is kept no further, any tile on the same
   * side up to `SLIDE` tiles away that is clear of the verge, on the same
   * land and has a clear straight way to `other`. The best turns the road
   * least, leaves the border at no less than `SHALLOW`, and moves least.
   */
  const placeEnd = (
    tile: Point,
    movable: boolean,
    other: Point,
    leg: (end: Point) => number,
  ) => {
    const along =
      tile.y === 0 || tile.y === mapHeight - 1
        ? { x: 1, y: 0 }
        : { x: 0, y: 1 };
    const tiles =
      movable && onBorder(tile)
        ? Array.from({ length: 2 * SLIDE + 1 }, (_, index) => ({
            x: tile.x + (index - SLIDE) * along.x,
            y: tile.y + (index - SLIDE) * along.y,
          })).filter(
            (candidate) =>
              clear(candidate) &&
              pieceOf(candidate) === pieceOf(tile) &&
              traceTiles(candidate, other).every(clear),
          )
        : [];
    let best = { tile, rate: leg(tile), extra: 0 };
    let bestCost = best.rate / TURN_RATE;
    for (const candidate of tiles) {
      const chord = Math.atan2(other.y - candidate.y, other.x - candidate.x);
      // how squarely the road leaves the border
      const square = Math.abs(
        along.x === 1 ? Math.sin(chord) : Math.cos(chord),
      );
      const extra =
        (square < Math.sin(SHALLOW) ? SHALLOW_COST : 0) +
        (Math.abs(candidate.x - tile.x) + Math.abs(candidate.y - tile.y)) /
          SLIDE_COST;
      const rate = leg(candidate);
      if (rate / TURN_RATE + extra < bestCost) {
        best = { tile: candidate, rate, extra };
        bestCost = rate / TURN_RATE + extra;
      }
    }
    return best;
  };
  const startMovable = first.at === 0;
  const endMovable = last.at === 0;

  /** The crossings from one piece of land to the next, coming from `previous`, no farther from the road as grown than `widest`, the best first, with their scores. */
  const choose = (
    here: number,
    there: number,
    previous: Point,
    heading: number | undefined,
    turn: number,
    last: boolean,
    widest: number,
    strict: boolean,
  ): {
    score: number;
    crossing: PlannedCrossing;
    start: Point;
    end: Point;
  }[] => {
    const fromPrevious = reach(previous);
    const found: {
      window: number;
      score: number;
      crossing: PlannedCrossing;
      start: Point;
      end: Point;
    }[] = [];
    centers.forEach((center, index) => {
      const window = WINDOWS.findIndex(
        (limit) => (drifts[index] ?? 0) <= limit,
      );
      if ((drifts[index] ?? 0) > widest) {
        return;
      }
      for (const direction of [
        center.heading + turn,
        center.heading - turn,
        center.heading + Math.PI + turn,
        center.heading + Math.PI - turn,
      ]) {
        const dx = Math.cos(direction);
        const dy = Math.sin(direction);
        // walk out of the water and its verge on both sides
        const walk = (sign: number) => {
          for (let away = 0; away <= LONGEST; away += STEP) {
            const tile = {
              x: Math.round(center.x + sign * away * dx),
              y: Math.round(center.y + sign * away * dy),
            };
            if (!inside(tile)) {
              return undefined;
            }
            if (clear(tile)) {
              return tile;
            }
          }
          return undefined;
        };
        const entry = walk(-1);
        const exit = walk(1);
        if (
          !entry ||
          !exit ||
          pieceOf(entry) !== here ||
          pieceOf(exit) !== there
        ) {
          continue;
        }
        // a bridge goes across the water, not along it
        const line = traceTiles(entry, exit);
        const wet = line.filter((tile) => water[key(tile)] === 1);
        const runs = line.filter(
          (tile, at) =>
            water[key(tile)] === 1 && water[key(line[at - 1] ?? tile)] !== 1,
        ).length;
        const firstWet = wet[0];
        const lastWet = wet[wet.length - 1];
        const across =
          firstWet && lastWet
            ? Math.hypot(lastWet.x - firstWet.x, lastWet.y - firstWet.y) + 1
            : 0;
        // nor beside it: no more of the verge than its two banks
        const banks = line.length - 2 - wet.length;
        if (
          across > (center.width * Math.SQRT2) / Math.sin(turn) + WET_SLACK ||
          banks > (2 * gap * Math.SQRT2) / Math.sin(turn) + WET_SLACK
        ) {
          continue;
        }
        // straight road before and after the bridge
        const lead = LEADS.map((steps) => ({
          approach: {
            x: Math.round(entry.x - steps * dx),
            y: Math.round(entry.y - steps * dy),
          },
          departure: {
            x: Math.round(exit.x + steps * dx),
            y: Math.round(exit.y + steps * dy),
          },
        })).find(
          ({ approach, departure }) =>
            clear(approach) &&
            clear(departure) &&
            pieceOf(approach) === here &&
            pieceOf(departure) === there &&
            traceTiles(approach, entry).every(clear) &&
            traceTiles(exit, departure).every(clear) &&
            // a crossing never runs along the edge of the map
            !traceTiles(approach, departure).some(onBorder),
        );
        if (!lead) {
          continue;
        }
        // the road must be able to get to the bridge, and on to the end
        const before = detour(fromPrevious, previous, lead.approach);
        const after = last ? detour(fromEnd, end, lead.departure) : 0;
        if (before === undefined || after === undefined) {
          continue;
        }
        // the legs to the bridge and on, with the ends of the road put
        // where they suit the legs best
        const opening =
          previous === start
            ? placeEnd(start, startMovable, lead.approach, (tile) =>
                rate(tile, undefined, lead.approach, direction),
              )
            : {
                tile: previous,
                rate: rate(previous, heading, lead.approach, direction),
                extra: 0,
              };
        const closing = last
          ? placeEnd(end, endMovable, lead.departure, (tile) =>
              rate(lead.departure, direction, tile, undefined),
            )
          : {
              tile: end,
              rate: rate(lead.departure, direction, end, undefined),
              extra: 0,
            };
        if (strict && Math.max(opening.rate, closing.rate) > HARD_RATE) {
          continue;
        }
        found.push({
          window,
          score:
            Math.max(opening.rate, closing.rate) / TURN_RATE +
            opening.extra +
            closing.extra +
            ((drifts[index] ?? 0) + before + after) / DRIFT +
            (crowded[index] ? CROWD_COST : 0) +
            (runs - 1) * RUN_COST,
          crossing: { ...lead, entry, exit, direction },
          start: opening.tile,
          end: closing.tile,
        });
      }
    });
    return found
      .sort((a, b) => a.window - b.window || a.score - b.score)
      .slice(0, CHOICES);
  };

  // the crossings one after another, going back to the next best one
  // where a crossing leaves no way on
  const turns = Array.from(
    { length: Math.max(0, ...routes.map(({ route }) => route.length - 1)) },
    () => (randomInt(random, angle.min, angle.max) * Math.PI) / 180,
  );
  interface Way {
    crossings: PlannedCrossing[];
    cost: number;
    start: Point;
    end: Point;
  }
  const cross = (
    route: number[],
    widest: number,
    strict: boolean,
    hop: number,
    previous: Point,
    heading: number | undefined,
  ): Way | undefined => {
    for (const found of choose(
      route[hop - 1] ?? -1,
      route[hop] ?? -1,
      previous,
      heading,
      turns[hop - 1] ?? Math.PI / 2,
      hop === route.length - 1,
      widest,
      strict,
    )) {
      const { crossing, score } = found;
      const rest =
        hop === route.length - 1
          ? { crossings: [], cost: 0, start, end: found.end }
          : cross(
              route,
              widest,
              strict,
              hop + 1,
              crossing.departure,
              crossing.direction,
            );
      if (rest) {
        return {
          crossings: [crossing, ...rest.crossings],
          cost: score + rest.cost,
          start: hop === 1 ? found.start : start,
          end: rest.end,
        };
      }
    }
    return undefined;
  };
  // the cheaper of the two ways, with no leg sharper than `HARD_RATE` if
  // there is such a way
  const cheapest = (strict: boolean) =>
    routes
      .map(({ route, widest }) =>
        route.length === 1
          ? detour(fromEnd, end, start) === undefined
            ? undefined
            : { crossings: [], cost: 0, start, end }
          : cross(route, widest, strict, 1, start, undefined),
      )
      .reduce<Way | undefined>(
        (best, found) =>
          found && (!best || found.cost < best.cost) ? found : best,
        undefined,
      );
  const way = cheapest(true) ?? cheapest(false);
  if (!way) {
    return undefined;
  }

  return {
    width,
    head: points.slice(0, first.at),
    start: way.start,
    crossings: way.crossings,
    end: way.end,
    tail: points.slice(points.length - last.at),
  };
}
