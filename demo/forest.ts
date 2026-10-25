import { generateForest, Tile } from '../src';
import { mulberry32 } from '../src/test-helpers/mulberry32';
import { downloadCanvas } from './download-canvas';
import { drawGrid } from './draw-grid';
import type { DisplayMode } from './draw-grid';

const form = document.querySelector<HTMLFormElement>('#controls');
const display = document.querySelector<HTMLSelectElement>('#display');
const download = document.querySelector<HTMLButtonElement>('#download');
const canvas = document.querySelector<HTMLCanvasElement>('#map');
const error = document.querySelector<HTMLElement>('#error');
const stats = document.querySelector<HTMLElement>('#stats');
const context = canvas?.getContext('2d');

function render(): void {
  if (!form || !display || !canvas || !error || !stats || !context) {
    return;
  }
  const data = new FormData(form);
  const value = (name: string): number => Number(data.get(name));
  const plain = data.get('tiles') === 'plain';

  try {
    const { grid, density } = generateForest({
      width: value('width'),
      height: value('height'),
      random: mulberry32(value('seed')),
      minDensity: value('minDensity'),
      maxDensity: value('maxDensity'),
      scaleX: value('scaleX'),
      scaleY: value('scaleY'),
      rotation: value('rotation'),
      octaves: value('octaves'),
      persistence: value('persistence'),
      lacunarity: value('lacunarity'),
      groundTile: plain ? Tile.Floor : Tile.Grass,
      treeTile: plain ? Tile.Wall : Tile.Tree,
    });
    error.textContent = '';
    const trees = grid
      .toString()
      .split('')
      .filter((c) => c === 'T' || c === '#').length;
    stats.textContent = `${String(trees)} trees of ${String(grid.width * grid.height)} tiles (${((100 * trees) / (grid.width * grid.height)).toFixed(1)}%)`;

    const tileSize = value('tileSize');
    if (display.value === 'density') {
      // the chance of a tree on every tile, stretched over the range between the
      // two densities: white is where the noise is highest, black where it is lowest
      const low = value('minDensity');
      const span = value('maxDensity') - low;
      canvas.width = grid.width * tileSize;
      canvas.height = grid.height * tileSize;
      for (let y = 0; y < grid.height; ++y) {
        for (let x = 0; x < grid.width; ++x) {
          const level =
            span === 0
              ? 0.5
              : ((density[y * grid.width + x] ?? 0) - low) / span;
          const gray = Math.round(255 * level);
          context.fillStyle = `rgb(${String(gray)} ${String(gray)} ${String(gray)})`;
          context.fillRect(x * tileSize, y * tileSize, tileSize, tileSize);
        }
      }
    } else {
      drawGrid(canvas, context, grid, tileSize, display.value as DisplayMode);
    }
  } catch (e) {
    error.textContent = e instanceof Error ? e.message : String(e);
  }
}

form?.addEventListener('input', render);
display?.addEventListener('input', render);
download?.addEventListener('click', () => {
  if (canvas) {
    downloadCanvas(canvas, 'angstloch-forest.png');
  }
});
render();
