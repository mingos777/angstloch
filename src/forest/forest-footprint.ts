import type { TemplateCell } from '../rooms/templates/template-cell';
import type { ForestTemplate } from './forest-template';

/** A template placed in the forest, with the cells as placed. */
export interface ForestFootprint {
  placed: ForestTemplate;
  cells: TemplateCell[][];
  /** How many tiles the trees take to thicken beyond the box, for a template with a clearing of its own. */
  margin: number;
}
