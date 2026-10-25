import { TemplateCell } from '../src';

/** How the editor shows each kind of template cell. */
export const CELL_STYLES: Record<
  TemplateCell,
  { label: string; color: string; glyph: string }
> = {
  [TemplateCell.Unused]: { label: 'unused', color: '#101014', glyph: '' },
  [TemplateCell.Floor]: { label: 'floor', color: '#d8d2c4', glyph: '.' },
  [TemplateCell.Wall]: { label: 'wall', color: '#555560', glyph: '#' },
  [TemplateCell.Exit]: { label: 'exit', color: '#4a7fc8', glyph: 'E' },
  [TemplateCell.Door]: { label: 'door', color: '#c8783c', glyph: '+' },
  [TemplateCell.OptionalExit]: {
    label: 'optional exit',
    color: '#8a5ac8',
    glyph: 'o',
  },
};
