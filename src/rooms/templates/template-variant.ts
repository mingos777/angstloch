import type { Rotation } from '../../core/rotation';
import type { TemplateCell } from './template-cell';

/** A template as it is placed: rotated and possibly mirrored. */
export interface TemplateVariant {
  cells: TemplateCell[][];
  width: number;
  height: number;
  rotation: Rotation;
  mirrored: boolean;
}
