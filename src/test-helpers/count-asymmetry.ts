import type { Grid } from '../core/grid';
import type { LayoutSymmetry } from '../core/layout-symmetry';

/** How many tiles differ from the tile at one of their mirror images under a symmetry, counted without the code of the generators. */
export function countAsymmetry(grid: Grid, symmetry: LayoutSymmetry): number {
  const { width, height } = grid;
  const flips: [boolean, boolean][] = [];
  if (symmetry === 'horizontal' || symmetry === 'both') {
    flips.push([true, false]);
  }
  if (symmetry === 'vertical' || symmetry === 'both') {
    flips.push([false, true]);
  }
  if (symmetry === 'rotational') {
    flips.push([true, true]);
  }
  let differing = 0;
  for (let y = 0; y < height; ++y) {
    for (let x = 0; x < width; ++x) {
      differing += flips.some(
        ([flipX, flipY]) =>
          grid.get(x, y) !==
          grid.get(flipX ? width - 1 - x : x, flipY ? height - 1 - y : y),
      )
        ? 1
        : 0;
    }
  }
  return differing;
}
