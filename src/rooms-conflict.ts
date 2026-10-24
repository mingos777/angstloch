import type { Room } from './room';

type Bounds = Pick<Room, 'x' | 'y' | 'width' | 'height'>;

/** Whether two rooms have fewer than `spacing` wall tiles between their floors. */
export function roomsConflict(a: Bounds, b: Bounds, spacing: number): boolean {
  return !(
    a.x >= b.x + b.width + spacing ||
    b.x >= a.x + a.width + spacing ||
    a.y >= b.y + b.height + spacing ||
    b.y >= a.y + a.height + spacing
  );
}
