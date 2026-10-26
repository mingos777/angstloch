import type { NoiseFunction } from '../noise/noise-function';
import type { Clearing } from './clearing';

/** How far the edge can wander, as a share of the radius, at an irregularity of 1. */
const WANDER = 0.6;
/** The size of a bulge of the edge, as a share of the radius. */
const BULGE = 0.8;
/** Moves the noise that shifts y away from the noise that shifts x. */
const SHIFT = 37.7;

/**
 * Marks the tiles of a clearing in `covered`. The oval is made ragged by
 * domain warping: each tile center is shifted by a vector from `warp`
 * (a noise function) before its distance to the center is measured, so the
 * edge bulges and pinches in and out. A tile is only marked when it joins the
 * center through other marked tiles, so the clearing is a single piece
 * without detached specks, and the center is always marked. Tiles beyond
 * the map are left out.
 */
export function stampClearing(
  covered: Uint8Array,
  mapWidth: number,
  mapHeight: number,
  clearing: Clearing,
  irregularity: number,
  warp: NoiseFunction,
): void {
  const { x: centerX, y: centerY, radiusX, radiusY, angle } = clearing;
  const mean = Math.sqrt(radiusX * radiusY);
  const wander = irregularity * WANDER * mean;
  const size = BULGE * mean;
  const cos = Math.cos((angle * Math.PI) / 180);
  const sin = Math.sin((angle * Math.PI) / 180);

  const isInside = (x: number, y: number): boolean => {
    const px = x + 0.5;
    const py = y + 0.5;
    const dx = px + wander * warp(px / size, py / size) - centerX - 0.5;
    const dy =
      py + wander * warp(px / size + SHIFT, py / size + SHIFT) - centerY - 0.5;
    // the offset in the frame of the oval, whose axes are turned by the angle
    const along = (dx * cos + dy * sin) / radiusX;
    const across = (dy * cos - dx * sin) / radiusY;
    return Math.hypot(along, across) <= 1 + 1e-9;
  };

  const seen = new Uint8Array(mapWidth * mapHeight);
  const start = centerY * mapWidth + centerX;
  seen[start] = 1;
  covered[start] = 1;
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
      if (nx < 0 || ny < 0 || nx >= mapWidth || ny >= mapHeight) {
        continue;
      }
      const next = ny * mapWidth + nx;
      if (seen[next]) {
        continue;
      }
      seen[next] = 1;
      if (isInside(nx, ny)) {
        covered[next] = 1;
        pending.push(next);
      }
    }
  }
}
