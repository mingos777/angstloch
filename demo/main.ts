import { generateMaze } from '../src';
import type { MazeSymmetry } from '../src';
import { downloadCanvas } from './download-canvas';
import { drawGrid } from './draw-grid';
import type { DisplayMode } from './draw-grid';
import { mulberry32 } from '../src/test-helpers/mulberry32';

const form = document.querySelector<HTMLFormElement>('#controls');
const display = document.querySelector<HTMLSelectElement>('#display');
const download = document.querySelector<HTMLButtonElement>('#download');
const canvas = document.querySelector<HTMLCanvasElement>('#map');
const error = document.querySelector<HTMLElement>('#error');
const context = canvas?.getContext('2d');

function render(): void {
  if (!form || !display || !canvas || !error || !context) {
    return;
  }
  const data = new FormData(form);
  const value = (name: string): number => Number(data.get(name));
  const tileSize = value('tileSize');

  try {
    const { grid, start } = generateMaze({
      width: value('width'),
      height: value('height'),
      random: mulberry32(value('seed')),
      horizontalBias: value('horizontalBias'),
      verticalBias: value('verticalBias'),
      loopChance: value('loopChance'),
      fill: value('fill'),
      straight: value('straight'),
      symmetry: data.get('symmetry') as MazeSymmetry,
      symmetryChance: value('symmetryChance'),
      minExits: value('exits'),
    });
    error.textContent = '';
    const mode = display.value as DisplayMode;
    drawGrid(canvas, context, grid, tileSize, mode);
    if (mode === 'simple') {
      context.fillStyle = '#4a8f5a';
      context.fillRect(
        start.x * tileSize + tileSize / 4,
        start.y * tileSize + tileSize / 4,
        tileSize / 2,
        tileSize / 2,
      );
    }
  } catch (e) {
    error.textContent = e instanceof Error ? e.message : String(e);
  }
}

form?.addEventListener('input', render);
display?.addEventListener('input', render);
download?.addEventListener('click', () => {
  if (canvas) {
    downloadCanvas(canvas, 'angstloch-maze.png');
  }
});
render();
