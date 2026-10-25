import { generateCave } from '../src';
import type { CaveConnect, CaveNeighborhood, CaveTunnelStyle } from '../src';
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
  // a blank limit means the default for the neighborhood
  const optional = (name: string): number | undefined =>
    data.get(name) === '' ? undefined : value(name);

  try {
    const { grid, regions, exits } = generateCave({
      width: value('width'),
      height: value('height'),
      random: mulberry32(value('seed')),
      fillChance: value('fillChance'),
      iterations: value('iterations'),
      birthLimit: optional('birthLimit'),
      survivalLimit: optional('survivalLimit'),
      neighborhood: data.get('neighborhood') as CaveNeighborhood,
      borderWalls: data.has('borderWalls'),
      minRegionSize: value('minRegionSize'),
      connect: data.get('connect') as CaveConnect,
      tunnelStyle: data.get('tunnelStyle') as CaveTunnelStyle,
      tunnelWidth: value('tunnelWidth'),
      tunnelWindiness: value('tunnelWindiness'),
      minExits: value('minExits'),
      maxExits: value('maxExits'),
    });
    error.textContent = '';
    const floors = grid
      .toString()
      .split('')
      .filter((c) => c === '.').length;
    const largest = regions[0]?.size ?? 0;
    stats.textContent = `${String(floors)} floor tiles of ${String(grid.width * grid.height)}, ${String(regions.length)} regions (largest: ${String(largest)} tiles), ${String(exits.length)} exits`;
    const centers = data.has('showCenters')
      ? regions.map((region) => region.center)
      : [];
    drawGrid(
      canvas,
      context,
      grid,
      value('tileSize'),
      display.value as DisplayMode,
      centers,
    );
  } catch (e) {
    error.textContent = e instanceof Error ? e.message : String(e);
  }
}

form?.addEventListener('input', render);
display?.addEventListener('input', render);
download?.addEventListener('click', () => {
  if (canvas) {
    downloadCanvas(canvas, 'angstloch-cave.png');
  }
});
render();
