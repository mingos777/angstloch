import { generateMaze, Tile } from '../src';
import type { MazeSymmetry } from '../src';
import { mulberry32 } from '../src/test-helpers/mulberry32';

const COLOURS = {
  [Tile.Wall]: '#26262c',
  [Tile.Floor]: '#d8d2c4',
  [Tile.Door]: '#c8783c',
};

const form = document.querySelector<HTMLFormElement>('#controls');
const canvas = document.querySelector<HTMLCanvasElement>('#map');
const error = document.querySelector<HTMLElement>('#error');
const context = canvas?.getContext('2d');

function render(): void {
  if (!form || !canvas || !error || !context) {
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
    canvas.width = grid.width * tileSize;
    canvas.height = grid.height * tileSize;
    for (let y = 0; y < grid.height; ++y) {
      for (let x = 0; x < grid.width; ++x) {
        context.fillStyle = COLOURS[grid.get(x, y)];
        context.fillRect(x * tileSize, y * tileSize, tileSize, tileSize);
      }
    }
    context.fillStyle = '#4a8f5a';
    context.fillRect(
      start.x * tileSize + tileSize / 4,
      start.y * tileSize + tileSize / 4,
      tileSize / 2,
      tileSize / 2,
    );
  } catch (e) {
    error.textContent = e instanceof Error ? e.message : String(e);
  }
}

form?.addEventListener('input', render);
render();
