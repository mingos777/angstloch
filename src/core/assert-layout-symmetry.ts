import type { LayoutSymmetry } from './layout-symmetry';

const LAYOUTS: readonly LayoutSymmetry[] = [
  'none',
  'horizontal',
  'vertical',
  'both',
  'rotational',
];

/** Throws a `RangeError` unless the value is one of the layout symmetries. */
export function assertLayoutSymmetry(name: string, value: string): void {
  if (!LAYOUTS.includes(value as LayoutSymmetry)) {
    throw new RangeError(
      `${name} must be one of ${LAYOUTS.join(', ')}, got ${value}`,
    );
  }
}
