import { Tile } from '../src';
import type { Grid, Point } from '../src';

export type DisplayMode = 'simple' | 'roguelike';

const Color = {
  Black: '#000000',
  Red: '#aa0000',
  Green: '#00aa00',
  Yellow: '#aa5500',
  Blue: '#0000aa',
  Magenta: '#aa00aa',
  Cyan: '#00aaaa',
  White: '#aaaaaa',
  BrightBlack: '#555555',
  BrightRed: '#ff5555',
  BrightGreen: '#55ff55',
  BrightYellow: '#ffff55',
  BrightBlue: '#5555ff',
  BrightMagenta: '#ff55ff',
  BrightCyan: '#55ffff',
  BrightWhite: '#ffffff',
};

const COLORS = {
  [Tile.Wall]: '#26262c',
  [Tile.Floor]: '#d8d2c4',
  [Tile.Door]: '#c8783c',
  [Tile.Grass]: '#00aa00',
  [Tile.Tree]: '#2f5d34',
  [Tile.Road]: '#b48a5a',
};

const SIMPLE_EXIT_COLOR = '#4a7fc8';

const GLYPHS = {
  [Tile.Wall]: { glyph: '#', color: Color.BrightBlack },
  [Tile.Floor]: { glyph: '.', color: Color.White },
  [Tile.Door]: { glyph: '+', color: Color.Yellow },
  [Tile.Grass]: { glyph: '.', color: Color.Green },
  [Tile.Tree]: { glyph: 'T', color: Color.BrightGreen },
  [Tile.Road]: { glyph: '.', color: Color.Yellow },
};

const EXIT_GLYPH = { glyph: '.', color: Color.BrightBlue };

/** Whether all eight neighbors are walls (out of bounds counts as wall). */
function isBuried(grid: Grid, x: number, y: number): boolean {
  for (let dy = -1; dy <= 1; ++dy) {
    for (let dx = -1; dx <= 1; ++dx) {
      if (grid.get(x + dx, y + dy) !== Tile.Wall) {
        return false;
      }
    }
  }
  return true;
}

/**
 * Resizes the canvas to fit the grid and paints every tile, either as plain
 * colored squares or as colored ASCII glyphs on black. `exits` are floor
 * tiles that get highlighted.
 */
export function drawGrid(
  canvas: HTMLCanvasElement,
  context: CanvasRenderingContext2D,
  grid: Grid,
  tileSize: number,
  mode: DisplayMode,
  exits: Point[] = [],
): void {
  canvas.width = grid.width * tileSize;
  canvas.height = grid.height * tileSize;

  if (mode === 'simple') {
    for (let y = 0; y < grid.height; ++y) {
      for (let x = 0; x < grid.width; ++x) {
        context.fillStyle = COLORS[grid.get(x, y)];
        context.fillRect(x * tileSize, y * tileSize, tileSize, tileSize);
      }
    }
    context.fillStyle = SIMPLE_EXIT_COLOR;
    for (const { x, y } of exits) {
      context.fillRect(
        x * tileSize + tileSize / 4,
        y * tileSize + tileSize / 4,
        tileSize / 2,
        tileSize / 2,
      );
    }
    return;
  }

  context.fillStyle = '#000000';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.font = `${String(tileSize)}px monospace`;
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  const glyphAt = (
    x: number,
    y: number,
    glyph: string,
    color: string,
  ): void => {
    context.fillStyle = color;
    context.fillText(glyph, (x + 0.5) * tileSize, (y + 0.5) * tileSize);
  };
  for (let y = 0; y < grid.height; ++y) {
    for (let x = 0; x < grid.width; ++x) {
      const tile = grid.get(x, y);
      if (tile === Tile.Wall && isBuried(grid, x, y)) {
        continue;
      }
      const { glyph, color } = GLYPHS[tile];
      glyphAt(x, y, glyph, color);
    }
  }
  for (const { x, y } of exits) {
    // repaint the cell so the glyph underneath doesn't show through
    context.fillStyle = '#000000';
    context.fillRect(x * tileSize, y * tileSize, tileSize, tileSize);
    glyphAt(x, y, EXIT_GLYPH.glyph, EXIT_GLYPH.color);
  }
}
