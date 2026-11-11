import { TemplateCell, Tile } from '../src';

const WIDTH = 80;
const IDENTIFIER = /^[A-Za-z_$][\w$]*$/;

/** The name of a tile, as in `Tile.Grass`. */
function tileName(tile: number): string | undefined {
  return Object.entries(Tile).find(([, value]) => value === tile)?.[0];
}

/** The short names of the template cells, as the docs write templates. */
export const CELL_ALIASES: Record<TemplateCell, string> = {
  [TemplateCell.Unused]: '_',
  [TemplateCell.Floor]: 'F',
  [TemplateCell.Wall]: 'W',
  [TemplateCell.Exit]: 'E',
  [TemplateCell.Door]: 'D',
  [TemplateCell.OptionalExit]: 'O',
};

/** Whether a value is the `cells` of a template: rows of cell values. */
function isCells(value: unknown): value is TemplateCell[][] {
  return (
    Array.isArray(value) &&
    value.every(
      (row) =>
        Array.isArray(row) &&
        row.every((cell) => typeof cell === 'number' && cell in CELL_ALIASES),
    )
  );
}

/** The cells of a template, one row per line, with the aliases of `CELL_ALIASES`; notes the cells used. */
function cellsLiteral(
  rows: TemplateCell[][],
  depth: number,
  used: Set<TemplateCell>,
): string {
  const pad = '  '.repeat(depth + 1);
  const lines = rows.map((row) => {
    for (const cell of row) {
      used.add(cell);
    }
    return `${pad}[${row.map((cell) => CELL_ALIASES[cell]).join(', ')}],\n`;
  });
  return `[\n${lines.join('')}${'  '.repeat(depth)}]`;
}

/**
 * A value as a JS literal, on one line when it fits, indented by `depth`
 * levels. The cells of templates are written with aliases, and the cell kinds
 * they use are added to `used`.
 */
export function codeLiteral(
  value: unknown,
  depth: number,
  used: Set<TemplateCell>,
  key?: string,
): string {
  if (key === 'cells' && isCells(value)) {
    return cellsLiteral(value, depth, used);
  }
  if (typeof value === 'string') {
    return `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
  }
  if (typeof value === 'number') {
    const name = key === 'tile' ? tileName(value) : undefined;
    return name ? `Tile.${name}` : String(value);
  }
  if (typeof value !== 'object' || value === null) {
    return String(value);
  }
  const entries = Array.isArray(value)
    ? value.map((item) => codeLiteral(item, depth + 1, used))
    : Object.entries(value)
        .filter(([, item]) => item !== undefined)
        .map(
          ([name, item]) =>
            `${IDENTIFIER.test(name) ? name : `'${name}'`}: ${codeLiteral(item, depth + 1, used, name)}`,
        );
  const [open, close] = Array.isArray(value) ? ['[', ']'] : ['{ ', ' }'];
  if (entries.length === 0) {
    return Array.isArray(value) ? '[]' : '{}';
  }
  const inline = `${open}${entries.join(', ')}${close}`;
  if (!inline.includes('\n') && depth * 2 + inline.length <= WIDTH) {
    return inline;
  }
  const pad = '  '.repeat(depth + 1);
  return `${open.trim()}\n${entries.map((entry) => `${pad}${entry},\n`).join('')}${'  '.repeat(depth)}${close.trim()}`;
}
