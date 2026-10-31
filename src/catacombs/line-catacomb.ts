import type { Area } from '../core/area';
import type { Point } from '../core/point';
import type { Random } from '../core/random';
import { randomInt } from '../core/random-int';
import { shuffle } from '../core/shuffle';
import { Tile } from '../core/tile';
import type { MapState } from '../pipeline/map-state';
import type { CatacombNiche } from '../rooms/catacomb-niche';
import type { CatacombSegment } from '../rooms/catacomb-segment';
import type { CatacombSide } from '../rooms/catacomb-side';
import { carveChamber } from './carve-chamber';
import { carveNiche } from './carve-niche';
import { OUTWARD } from './outward';
import type { CatacombSettings } from './catacomb-settings';
import type { CatacombMirror } from './create-catacomb-mirrors';
import type { DeadEnd } from './list-dead-ends';
import { spreadAlong } from './spread-along';

/** The sides of a gallery that runs each way. */
const SIDES = {
  horizontal: ['top', 'bottom'],
  vertical: ['left', 'right'],
} as const;

/** The walls of a chamber that are not its door's, by the side it lies on. */
const CHAMBER_WALLS: Record<CatacombSide, readonly CatacombSide[]> = {
  top: ['top', 'left', 'right'],
  right: ['right', 'top', 'bottom'],
  bottom: ['bottom', 'left', 'right'],
  left: ['left', 'top', 'bottom'],
};

/** A burial chamber that `lineCatacomb` dug, in the coordinates of its state. */
export interface LinedChamber {
  floor: Area;
  door: Point;
  side: CatacombSide;
  segment: number;
  deadEnd: boolean;
}

/** What `lineCatacomb` made of the segments of a catacomb. */
export interface LinedCatacomb {
  segments: CatacombSegment[];
  /** In the order of their segments, those inside a chamber pointing into `chambers`. */
  niches: CatacombNiche[];
  /** In the order of their segments. */
  chambers: LinedChamber[];
}

/** A chamber or a niche to dig: its door or mouth in the wall on a side, its width along the wall, and how many of those tiles lie before the door (left of it, or above it). */
interface Opening {
  door: Point;
  side: CatacombSide;
  width: number;
  left: number;
}

/** Where a twin goes: the mirroring, and the segment and the chamber it lands in. */
interface Twin {
  mirror: CatacombMirror;
  segment: number;
  chamber?: number;
}

/** The image of an opening under a mirroring. */
function mirrorOpening(opening: Opening, mirror: CatacombMirror): Opening {
  const { door, side, width, left } = opening;
  return {
    door: mirror.point(door),
    side: mirror.side(side),
    width,
    left: mirror.flipsAlong(side) ? width - 1 - left : left,
  };
}

/** Whether two openings are the same. */
function sameOpening(p: Opening, q: Opening): boolean {
  return (
    p.door.x === q.door.x &&
    p.door.y === q.door.y &&
    p.side === q.side &&
    p.left === q.left
  );
}

/** The door of an opening and the tiles beyond it, one deep. */
function frontOf({ door, side, width, left }: Opening): string[] {
  const out = OUTWARD[side];
  const along = { x: Math.abs(out.y), y: Math.abs(out.x) };
  return [
    door,
    ...Array.from({ length: width }, (_, i) => ({
      x: door.x + out.x + (i - left) * along.x,
      y: door.y + out.y + (i - left) * along.y,
    })),
  ].map(({ x, y }) => `${String(x)},${String(y)}`);
}

/**
 * The one of an opening and its images under `selves`, mirrorings that map
 * the segment or the chamber it opens off onto itself, to dig, so that its
 * twins make up the rest: the first by its door, row by row. `undefined` when
 * the opening overlaps an image that is not itself, so they cannot all be dug.
 */
function canonicalOpening(
  opening: Opening,
  selves: readonly CatacombMirror[],
): Opening | undefined {
  const images = selves.map((mirror) => mirrorOpening(opening, mirror));
  const front = new Set(frontOf(opening));
  if (
    images.some(
      (image) =>
        !sameOpening(image, opening) &&
        frontOf(image).some((tile) => front.has(tile)),
    )
  ) {
    return undefined;
  }
  return [opening, ...images].reduce((first, image) =>
    image.door.y < first.door.y ||
    (image.door.y === first.door.y && image.door.x < first.door.x)
      ? image
      : first,
  );
}

/** The tile of the wall on a side of a stretch of floor, at a coordinate along it. */
function wallTile(floor: Area, side: CatacombSide, along: number): Point {
  switch (side) {
    case 'top':
      return { x: along, y: floor.y - 1 };
    case 'bottom':
      return { x: along, y: floor.y + floor.height };
    case 'left':
      return { x: floor.x - 1, y: along };
    case 'right':
      return { x: floor.x + floor.width, y: along };
  }
}

/**
 * Lines the walls of a catacomb. First every dead end is closed by a burial
 * chamber by `deadEndChamberChance`, where one fits (see `carveChamber`).
 * Then every segment gets a character drawn by the weights of `segments`, and
 * the segments drawn with chambers or niches are lined in a random order, so
 * where the rock of two galleries meets, in the corners between them, neither
 * way is favored.
 *
 * A segment with chambers gets them on `chamberSides` sides, the side drawn
 * when it is one: chambers as wide as drawn from `chamberSize.width` for the
 * segment, at a spacing drawn from `chamberSpacing`, as many as fit and
 * centered a tile clear of each end, those on both sides facing each other.
 * When not one fits, the segment gets niches instead. A segment with niches
 * gets them likewise, one tile wide, on `nicheSides` sides at a spacing drawn
 * from `nicheSpacing` (see `carveNiche`). A chamber's walls but its door's are
 * lined with niches by `chamberNicheChance`, a tile clear of its corners.
 *
 * With `mirrors`, a segment and its twins, the segments its images land on,
 * get twins by `symmetryChance`, rolled once for them all, and so do a dead
 * end and its twins: the twins take the character of the first, and every
 * chamber and niche dug off it is dug at its images too, as deep as it is or
 * as deep as fits, and a chamber's niches with it. A segment that is its own
 * image is lined on one side of its mirror, and its twins line the rest; an
 * opening that would overlap its own image is left out. A twin that does not
 * fit is left out.
 *
 * A segment is `'chambers'` with a chamber beside it, `'niches'` with a niche
 * off it, and `'bare'` otherwise; a chamber at its dead end does not count.
 */
export function lineCatacomb(
  state: MapState,
  random: Random,
  segments: readonly Omit<CatacombSegment, 'character'>[],
  deadEnds: readonly DeadEnd[],
  settings: CatacombSettings,
  mirrors: readonly CatacombMirror[] = [],
): LinedCatacomb {
  const { grid } = state;
  const blocked = new Uint8Array(grid.width * grid.height);
  const niches: CatacombNiche[] = [];
  const chambers: LinedChamber[] = [];
  const draw = ({ min, max }: { min: number; max: number }) =>
    randomInt(random, min, max);
  const sameArea = (p: Area, q: Area) =>
    p.x === q.x && p.y === q.y && p.width === q.width && p.height === q.height;
  // where each mirroring takes each segment, -1 where no segment is
  const imageOf = mirrors.map((mirror) =>
    segments.map(({ floor, orientation }) => {
      const image = mirror.area(floor);
      return segments.findIndex(
        (other) =>
          other.orientation === orientation && sameArea(other.floor, image),
      );
    }),
  );
  /** The mirrorings of `twins` that land on a segment itself. */
  const selvesOf = (twins: readonly Twin[], segment: number) =>
    twins.flatMap((twin) => (twin.segment === segment ? [twin.mirror] : []));
  /** Whether a set of twins is rolled to be dug. */
  const rollTwins = (twins: readonly unknown[]) =>
    twins.length > 0 && random() < settings.symmetryChance;

  /** The twins of an opening but those that are the opening itself. */
  const othersOf = (opening: Opening, twins: readonly Twin[]) =>
    twins.filter(
      ({ mirror }) => !sameOpening(mirrorOpening(opening, mirror), opening),
    );

  /**
   * Digs a niche with all its twins, those of a chamber's niches inside the
   * twins of the chamber, as deep as all of them fit, or none of them.
   */
  const addNiche = (
    opening: Opening,
    segment: number,
    chamber: number | undefined,
    twins: readonly Twin[],
  ): void => {
    const inChamber = chamber !== undefined;
    const others = othersOf(opening, twins);
    for (let depth = draw(settings.nicheDepth); depth > 0;) {
      const tiles = carveNiche(
        state,
        blocked,
        opening.door,
        opening.side,
        depth,
        inChamber,
      );
      if (!tiles) {
        return;
      }
      depth = tiles.length;
      const dug: CatacombNiche[] = [
        { tiles, side: opening.side, segment, chamber },
      ];
      let shortest = depth;
      for (const twin of others) {
        const image = mirrorOpening(opening, twin.mirror);
        const imageTiles = carveNiche(
          state,
          blocked,
          image.door,
          image.side,
          depth,
          inChamber,
        );
        shortest = Math.min(shortest, imageTiles?.length ?? 0);
        if (imageTiles) {
          dug.push({
            tiles: imageTiles,
            side: image.side,
            segment: twin.segment,
            chamber: twin.chamber,
          });
        }
      }
      if (shortest === depth) {
        niches.push(...dug);
        return;
      }
      for (const { x, y } of dug.flatMap((niche) => niche.tiles)) {
        grid.set(x, y, Tile.Wall);
      }
      depth = shortest;
    }
  };

  /**
   * Digs a chamber with all its twins, as deep as all of them fit, or none of
   * them, and maybe its niches and theirs, and tells whether it fit.
   */
  const addChamber = (
    opening: Opening,
    segment: number,
    deadEnd: boolean,
    twins: readonly Twin[],
  ): boolean => {
    const { door, side, width, left } = opening;
    const others = othersOf(opening, twins);
    let dug: LinedChamber[] = [];
    for (
      let depth = draw(settings.chamberDepth);
      depth >= settings.chamberDepth.min && dug.length === 0;
      --depth
    ) {
      const before = blocked.slice();
      const floor = carveChamber(
        state,
        blocked,
        door,
        side,
        width,
        left,
        depth,
        settings.chamberDepth.min,
      );
      if (!floor) {
        return false;
      }
      depth = side === 'top' || side === 'bottom' ? floor.height : floor.width;
      dug = [{ floor, door, side, segment, deadEnd }];
      for (const twin of others) {
        const image = mirrorOpening(opening, twin.mirror);
        const imageFloor = carveChamber(
          state,
          blocked,
          image.door,
          image.side,
          width,
          image.left,
          depth,
          depth,
        );
        if (!imageFloor) {
          break;
        }
        dug.push({
          floor: imageFloor,
          door: image.door,
          side: image.side,
          segment: twin.segment,
          deadEnd,
        });
      }
      if (dug.length <= others.length) {
        for (const chamber of dug) {
          const { x, y, width: across, height: down } = chamber.floor;
          for (let row = y; row < y + down; ++row) {
            for (let column = x; column < x + across; ++column) {
              grid.set(column, row, Tile.Wall);
            }
          }
          grid.set(chamber.door.x, chamber.door.y, Tile.Wall);
        }
        blocked.set(before);
        dug = [];
      }
    }
    const [first] = dug;
    if (!first) {
      return false;
    }
    const { floor } = first;
    const chamber = chambers.length;
    chambers.push(...dug);
    // every twin's chamber, for the twins of its niches
    const nicheTwins = twins.map((twin) => {
      const at = others.indexOf(twin);
      return { ...twin, chamber: at < 0 ? chamber : chamber + 1 + at };
    });
    if (random() < settings.chamberNicheChance) {
      const spacing = draw(settings.nicheSpacing);
      const selves = nicheTwins.flatMap((twin) =>
        twin.chamber === chamber ? [twin.mirror] : [],
      );
      for (const wall of CHAMBER_WALLS[side]) {
        const across = wall === 'top' || wall === 'bottom';
        const positions = spreadAlong(
          (across ? floor.x : floor.y) + 1,
          (across ? floor.width : floor.height) - 2,
          1,
          spacing,
        );
        for (const position of positions) {
          const niche = canonicalOpening(
            {
              door: wallTile(floor, wall, position),
              side: wall,
              width: 1,
              left: 0,
            },
            selves,
          );
          if (niche) {
            addNiche(niche, segment, chamber, nicheTwins);
          }
        }
      }
    }
    return true;
  };

  /** The sides of a segment to line, `count` of them drawn. */
  const pickSides = (
    orientation: CatacombSegment['orientation'],
    count: number,
  ): CatacombSide[] => {
    const [first, second] = SIDES[orientation];
    return count > 1 ? [first, second] : [random() < 0.5 ? first : second];
  };

  /** Lines a segment with chambers, and their twins, and tells whether any fit. */
  const lineWithChambers = (index: number, twins: readonly Twin[]): boolean => {
    const { floor, orientation } = segments[index] as CatacombSegment;
    const horizontal = orientation === 'horizontal';
    const sides = pickSides(orientation, draw(settings.chamberSides));
    const spacing = draw(settings.chamberSpacing);
    const [start, length] = horizontal
      ? [floor.x + 1, floor.width - 2]
      : [floor.y + 1, floor.height - 2];
    let width = draw(settings.chamberWidth);
    let positions = spreadAlong(start, length, width, spacing);
    if (positions.length === 0) {
      width = settings.chamberWidth.min;
      positions = spreadAlong(start, length, width, spacing);
    }
    const left = Math.floor((width - 1) / 2);
    const selves = selvesOf(twins, index);
    let placed = false;
    for (const position of positions) {
      for (const side of sides) {
        const opening = canonicalOpening(
          { door: wallTile(floor, side, position + left), side, width, left },
          selves,
        );
        if (opening) {
          placed = addChamber(opening, index, false, twins) || placed;
        }
      }
    }
    return placed;
  };

  /** Lines a segment with niches, and their twins. */
  const lineWithNiches = (index: number, twins: readonly Twin[]): void => {
    const { floor, orientation } = segments[index] as CatacombSegment;
    const horizontal = orientation === 'horizontal';
    const sides = pickSides(orientation, draw(settings.nicheSides));
    const positions = spreadAlong(
      (horizontal ? floor.x : floor.y) + 1,
      (horizontal ? floor.width : floor.height) - 2,
      1,
      draw(settings.nicheSpacing),
    );
    const selves = selvesOf(twins, index);
    for (const position of positions) {
      for (const side of sides) {
        const opening = canonicalOpening(
          { door: wallTile(floor, side, position), side, width: 1, left: 0 },
          selves,
        );
        if (opening) {
          addNiche(opening, index, undefined, twins);
        }
      }
    }
  };

  // a dead end's twins: those at the images of its segment, closed on the image of its side
  const settled = new Set<number>();
  const alone = new Set<number>();
  deadEnds.forEach(({ door, side, segment }, index) => {
    if (settled.has(index)) {
      return;
    }
    settled.add(index);
    const twins = alone.has(index)
      ? []
      : mirrors.flatMap((mirror, at): (Twin & { end: number })[] => {
          const image = imageOf[at]?.[segment] ?? -1;
          const end = deadEnds.findIndex(
            (other) =>
              other.segment === image && other.side === mirror.side(side),
          );
          return end >= 0
            ? [{ mirror, segment: (deadEnds[end] as DeadEnd).segment, end }]
            : [];
        });
    const twinned = rollTwins(twins);
    for (const { end } of twins) {
      (twinned ? settled : alone).add(end);
    }
    if (random() < settings.deadEndChamberChance) {
      const width = draw(settings.chamberWidth);
      const opening = canonicalOpening(
        { door, side, width, left: Math.floor((width - 1) / 2) },
        twinned
          ? twins.flatMap((twin) => (twin.end === index ? [twin.mirror] : []))
          : [],
      );
      if (opening) {
        addChamber(opening, segment, true, twinned ? twins : []);
      }
    }
  });

  const { niches: nichesWeight, chambers: chambersWeight } = settings.segments;
  const total = nichesWeight + chambersWeight + settings.segments.bare;
  const drawn = segments.map(() => {
    const roll = random() * total;
    return roll < nichesWeight
      ? 'niches'
      : roll < nichesWeight + chambersWeight
        ? 'chambers'
        : 'bare';
  });
  // the twins of the segments whose twins were rolled, and the twins they line
  const twinsOf = new Map<number, Twin[]>();
  const lined = new Set<number>();
  const decided = new Set<number>();
  segments.forEach((_, index) => {
    if (decided.has(index)) {
      return;
    }
    const twins = mirrors.flatMap((mirror, at): Twin[] => {
      const image = imageOf[at]?.[index] ?? -1;
      return image >= 0 ? [{ mirror, segment: image }] : [];
    });
    decided.add(index);
    for (const { segment } of twins) {
      decided.add(segment);
    }
    if (rollTwins(twins)) {
      twinsOf.set(index, twins);
      for (const { segment } of twins) {
        if (segment !== index) {
          lined.add(segment);
          drawn[segment] = drawn[index] as (typeof drawn)[number];
        }
      }
    }
  });
  const order = shuffle(
    random,
    segments.flatMap((_, index) =>
      drawn[index] === 'bare' || lined.has(index) ? [] : [index],
    ),
  );
  for (const index of order) {
    const twins = twinsOf.get(index) ?? [];
    if (drawn[index] === 'niches' || !lineWithChambers(index, twins)) {
      lineWithNiches(index, twins);
    }
  }

  // in the order of their segments, the niches pointing to the chambers' new places
  const sorted = chambers
    .map((chamber, index) => ({ chamber, index }))
    .sort((p, q) => p.chamber.segment - q.chamber.segment);
  const moved = new Map(sorted.map(({ index }, at) => [index, at]));
  return {
    segments: segments.map((segment, index) => ({
      ...segment,
      character: chambers.some(
        (chamber) => chamber.segment === index && !chamber.deadEnd,
      )
        ? 'chambers'
        : niches.some(
              (niche) => niche.segment === index && niche.chamber === undefined,
            )
          ? 'niches'
          : 'bare',
    })),
    niches: niches
      .map((niche) =>
        niche.chamber === undefined
          ? niche
          : { ...niche, chamber: moved.get(niche.chamber) },
      )
      .sort((p, q) => p.segment - q.segment),
    chambers: sorted.map(({ chamber }) => chamber),
  };
}
