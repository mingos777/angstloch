import type { Rotation } from './rotation';
import type { TemplateCell } from './template-cell';
import type { TemplateExit } from './template-exit';

/** A template variant put on the map. */
export interface TemplatePlacement {
  /** Column of the bounding box's left edge. */
  x: number;
  /** Row of the bounding box's top edge. */
  y: number;
  /** Width of the bounding box. */
  width: number;
  /** Height of the bounding box. */
  height: number;
  /** The cells as placed, rotated and mirrored. */
  cells: TemplateCell[][];
  /** Exit candidates, with positions relative to the bounding box. */
  exits: TemplateExit[];
  rotation: Rotation;
  mirrored: boolean;
}
