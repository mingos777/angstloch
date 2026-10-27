import type { Rotation } from '../core/rotation';

/** A template that was placed in the forest. */
export interface ForestTemplate {
  /** Position of the template in the `templates` option. */
  template: number;
  /** Column of the bounding box's left edge. */
  x: number;
  /** Row of the bounding box's top edge. */
  y: number;
  /** Width of the bounding box. */
  width: number;
  /** Height of the bounding box. */
  height: number;
  /** Clockwise rotation the template was placed in. */
  rotation: Rotation;
  /** Whether the template was placed mirrored left to right. */
  mirrored: boolean;
  /** Position of the clearing the template stands on in the `clearings` result, or nothing for a template placed anywhere. */
  clearing?: number;
  /** Whether the template got a clearing of its own: its box is free of trees, with the template's `margin` of thinning trees beyond it. That clearing is not in the `clearings` result. */
  ownClearing: boolean;
}
