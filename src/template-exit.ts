import type { TemplateCell } from './template-cell';

/** An exit candidate of a template: where corridors may start. */
export interface TemplateExit {
  /** Column of the cell in the template. */
  x: number;
  /** Row of the cell in the template. */
  y: number;
  /** `Exit` and `Door` cells are always connected; `OptionalExit` cells only as needed. */
  kind:
    | typeof TemplateCell.Exit
    | typeof TemplateCell.Door
    | typeof TemplateCell.OptionalExit;
  /** Indices into `DIRECTIONS` of the neighbors outside the footprint, i.e. unused or beyond the edge. */
  directions: number[];
}
