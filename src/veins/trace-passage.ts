import type { Point } from '../core/point';
import type { NoiseFunction } from '../noise/noise-function';
import { growCenterline } from '../roads/grow-centerline';
import { growPinnedLine } from '../roads/grow-pinned-line';
import { joinTiles } from '../roads/join-tiles';
import type { PassageSpec } from './passage-spec';

/**
 * Works out the tiles along the middle of a winding passage, without carving
 * anything. They run from where the passage starts to where it ends, and each
 * one touches the one before it along an edge. The tiles are clamped to the
 * map.
 */
export function tracePassage(
  mapWidth: number,
  mapHeight: number,
  noise: NoiseFunction,
  spec: PassageSpec,
): Point[] {
  const { from, windiness, lane } = spec;
  const start = { x: from.x + 0.5, y: from.y + 0.5 };
  if ('to' in spec) {
    return joinTiles(
      growPinnedLine({
        mapWidth,
        mapHeight,
        from: start,
        to: { x: spec.to.x + 0.5, y: spec.to.y + 0.5 },
        windiness,
        noise,
        lane,
      }),
    );
  }
  const { directions = [1], angle, length } = spec;
  const grow = (direction: 1 | -1) =>
    growCenterline({
      mapWidth,
      mapHeight,
      origin: start,
      angle,
      windiness,
      noise,
      direction,
      lane,
      maxLength: length,
    });
  const backwards = directions.includes(-1) ? grow(-1).reverse() : [];
  const forwards = directions.includes(1) ? grow(1) : [];
  return joinTiles([...backwards, start, ...forwards]);
}
