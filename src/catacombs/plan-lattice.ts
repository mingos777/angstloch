import type { Area } from '../core/area';
import { pickRandom } from '../core/pick-random';
import type { Random } from '../core/random';
import { randomInt } from '../core/random-int';
import type { Range } from '../core/range';
import { shuffle } from '../core/shuffle';
import type { CatacombSettings } from './catacomb-settings';
import type { GalleryLine, Lattice } from './lattice';
import { sideRoom } from './side-room';

/** The galleries of one way of the lattice, before they are placed: their widths, the rock between them and what is left over. */
interface Axis {
  widths: number[];
  /** The rock after each gallery but the last. */
  gaps: number[];
  mains: boolean[];
  slack: number;
}

/** Lays side galleries along a length, as many as fit, with the rock between them drawn from `spacing`. A gallery that does not fit is tried once more at the narrowest width and the narrowest gap. */
function spaceAxis(
  random: Random,
  length: number,
  sideWidth: Range,
  spacing: Range,
): Axis {
  // narrow enough for a second one
  const first = Math.max(
    sideWidth.min,
    Math.min(
      randomInt(random, sideWidth.min, sideWidth.max),
      length - spacing.min - sideWidth.min,
    ),
  );
  const axis: Axis = { widths: [first], gaps: [], mains: [false], slack: 0 };
  let end = first;
  for (;;) {
    let gap = randomInt(random, spacing.min, spacing.max);
    let width = randomInt(random, sideWidth.min, sideWidth.max);
    if (end + gap + width > length) {
      gap = spacing.min;
      width = sideWidth.min;
    }
    if (end + gap + width > length) {
      break;
    }
    axis.gaps.push(gap);
    axis.widths.push(width);
    axis.mains.push(false);
    end += gap + width;
  }
  axis.slack = length - end;
  return axis;
}

/**
 * Lays side galleries along a length symmetric about its middle, as many as
 * fit, from the middle outwards: a gallery or a gap in the middle, of a size
 * that leaves as much room on each side, then pairs of galleries with the
 * rock between them drawn from `spacing`, the slack split between the two
 * ends. Both middles are tried, and the one that fits more galleries is
 * kept, either at random when they fit as many. A gallery or a gap in the
 * middle with no size of `sideWidth` or `spacing` that centers it is one tile
 * wider than its `max`.
 */
function spaceMirroredAxis(
  random: Random,
  length: number,
  sideWidth: Range,
  spacing: Range,
): Axis {
  const draw = ({ min, max }: Range) => randomInt(random, min, max);
  /** A size of a range drawn among those with as much room on each side, if any. */
  const drawCentered = ({ min, max }: Range): number | undefined => {
    const centered = Array.from({ length: max - min + 1 }, (_, i) => min + i);
    const fitting = centered.filter((size) => (length - size) % 2 === 0);
    return fitting.length > 0 ? pickRandom(random, fitting) : undefined;
  };
  const build = (galleryInMiddle: boolean): Axis => {
    const middle =
      drawCentered(galleryInMiddle ? sideWidth : spacing) ??
      (galleryInMiddle ? sideWidth : spacing).max + 1;
    if (middle > length) {
      return { widths: [], gaps: [], mains: [], slack: length };
    }
    // one half, from the middle outwards: each gallery and the rock inside it, none for the first one round a gap
    const widths: number[] = [];
    const gaps: number[] = [];
    let used = middle;
    for (;;) {
      const inside = galleryInMiddle || widths.length > 0;
      let gap = inside ? draw(spacing) : 0;
      let width = draw(sideWidth);
      if (used + 2 * (gap + width) > length) {
        gap = inside ? spacing.min : 0;
        width = sideWidth.min;
      }
      if (used + 2 * (gap + width) > length) {
        break;
      }
      widths.push(width);
      gaps.push(gap);
      used += 2 * (gap + width);
    }
    const all = [
      ...widths.slice().reverse(),
      ...(galleryInMiddle ? [middle] : []),
      ...widths,
    ];
    const outer = gaps.slice(1);
    return {
      widths: all,
      gaps: [
        ...outer.slice().reverse(),
        ...(galleryInMiddle
          ? widths.length > 0
            ? [gaps[0] as number, gaps[0] as number]
            : []
          : [middle]),
        ...outer,
      ].slice(0, Math.max(0, all.length - 1)),
      mains: all.map(() => false),
      slack: length - used,
    };
  };
  const [gallery, gap] = [build(true), build(false)];
  const more = gallery.widths.length - gap.widths.length;
  return more > 0 || (more === 0 && random() < 0.5) ? gallery : gap;
}

/** Makes a gallery of an axis a main one as wide as `target`, or as wide as the slack and the rock above `spacingMin` allow. */
function widen(
  random: Random,
  axis: Axis,
  index: number,
  target: number,
  spacingMin: number,
): void {
  const width = axis.widths[index] as number;
  axis.mains[index] = true;
  let extra = target - width;
  const fromSlack = Math.min(extra, axis.slack);
  axis.slack -= fromSlack;
  let taken = fromSlack;
  extra -= fromSlack;
  for (; extra > 0; --extra, ++taken) {
    const wide = axis.gaps.flatMap((gap, at) => (gap > spacingMin ? [at] : []));
    if (wide.length === 0) {
      break;
    }
    const at = wide[randomInt(random, 0, wide.length - 1)] as number;
    axis.gaps[at] = (axis.gaps[at] as number) - 1;
  }
  axis.widths[index] = width + taken;
}

/**
 * Makes a gallery of a mirrored axis and its twin main galleries as wide as
 * `target`, or as wide as the slack and the rock above `spacingMin` allow,
 * taking as much from both ends or from both sides. The gallery in the middle
 * widens two tiles at a time, so it stays centered.
 */
function widenMirrored(
  random: Random,
  axis: Axis,
  index: number,
  target: number,
  spacingMin: number,
): void {
  const last = axis.widths.length - 1;
  const twin = last - index;
  const middle = twin === index;
  const step = middle ? 2 : 1;
  axis.mains[index] = true;
  axis.mains[twin] = true;
  for (
    let extra = target - (axis.widths[index] as number);
    extra >= step;
    extra -= step
  ) {
    // two tiles of rock: one from each end, or from each of two twin gaps, or two from the middle gap
    if (axis.slack >= 2) {
      axis.slack -= 2;
    } else {
      const wide = axis.gaps.flatMap((gap, at) => {
        const other = last - 1 - at;
        return at < other
          ? gap > spacingMin
            ? [at]
            : []
          : at === other && gap >= spacingMin + 2
            ? [at]
            : [];
      });
      if (wide.length === 0) {
        break;
      }
      const at = pickRandom(random, wide);
      const other = last - 1 - at;
      axis.gaps[at] = (axis.gaps[at] as number) - (at === other ? 2 : 1);
      if (at !== other) {
        axis.gaps[other] = (axis.gaps[other] as number) - 1;
      }
    }
    axis.widths[index] = (axis.widths[index] as number) + step;
    if (!middle) {
      axis.widths[twin] = (axis.widths[twin] as number) + step;
    }
  }
}

/** Places the galleries of an axis from `origin`, shifted by a random part of the slack, or by half of it when the axis is mirrored. */
function placeAxis(
  random: Random,
  axis: Axis,
  origin: number,
  mirrored: boolean,
): GalleryLine[] {
  let start =
    origin + (mirrored ? axis.slack / 2 : randomInt(random, 0, axis.slack));
  return axis.widths.map((width, index) => {
    const line = { start, width, main: axis.mains[index] as boolean };
    start += width + (axis.gaps[index] ?? 0);
    return line;
  });
}

/**
 * Plans the lattice of a catacomb in a box: rows and columns of side galleries
 * as many as fit, the rock between two of them drawn from `spacing` and
 * widened by the room for niches and chambers on both sides (see
 * `sideRoom`), which is also kept clear between the galleries and the edges
 * of the box, then
 * `mainGalleries` of them, inner ones first, widened to main galleries, from
 * the room left over and the rock wider than the narrowest gap. The box must
 * hold two side galleries of the narrowest width each way, and the rock for
 * niches and chambers.
 *
 * The `mirrored` axes are symmetric about the middle of the box (see
 * `spaceMirroredAxis`), and a main gallery on them brings its twin along,
 * counting as one.
 */
export function planLattice(
  random: Random,
  box: Area,
  settings: CatacombSettings,
  mirrored: { columns: boolean; rows: boolean } = {
    columns: false,
    rows: false,
  },
): Lattice {
  const { sideWidth, spacing, mainWidth, mainGalleries } = settings;
  // the rock for niches and chambers, between the galleries and round them
  const room = sideRoom(settings);
  const gaps = { min: spacing.min + 2 * room, max: spacing.max + 2 * room };
  const space = (length: number, mirror: boolean) =>
    (mirror ? spaceMirroredAxis : spaceAxis)(random, length, sideWidth, gaps);
  const columns = space(box.width - 2 * room, mirrored.columns);
  const rows = space(box.height - 2 * room, mirrored.rows);
  const lines = (
    [
      [columns, mirrored.columns],
      [rows, mirrored.rows],
    ] as const
  ).flatMap(([axis, mirror]) =>
    axis.widths.flatMap((_, index) => {
      const last = axis.widths.length - 1;
      // a twin stands for the pair
      return mirror && index > last - index
        ? []
        : [{ axis, mirror, index, inner: index > 0 && index < last }];
    }),
  );
  const picked = [
    ...shuffle(
      random,
      lines.filter(({ inner }) => inner),
    ),
    ...shuffle(
      random,
      lines.filter(({ inner }) => !inner),
    ),
  ].slice(0, randomInt(random, mainGalleries.min, mainGalleries.max));
  for (const { axis, mirror, index } of picked) {
    (mirror ? widenMirrored : widen)(
      random,
      axis,
      index,
      randomInt(random, mainWidth.min, mainWidth.max),
      gaps.min,
    );
  }
  return {
    columns: placeAxis(random, columns, box.x + room, mirrored.columns),
    rows: placeAxis(random, rows, box.y + room, mirrored.rows),
  };
}
