import { generateForest, Tile } from '../src';
import type { ClearingSpec, DistanceMetric, RoadEntry } from '../src';
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

function blank(entry: string): number | undefined {
  return entry === '' ? undefined : Number(entry);
}

/** Reads the clearing rows of the form, which can be added and removed, so each row is read on its own. */
function readClearings(root: HTMLFormElement): ClearingSpec[] {
  return [...root.querySelectorAll('.clearing')].map((row) => {
    const input = (name: string): HTMLInputElement =>
      row.querySelector<HTMLInputElement>(`[name="${name}"]`) ??
      document.createElement('input');
    const number = (name: string): number => Number(input(name).value);
    return {
      // a blank position means a random one
      x: blank(input('clearingX').value),
      y: blank(input('clearingY').value),
      radiusX: number('clearingRadiusX'),
      radiusY: number('clearingRadiusY'),
      angle: number('clearingAngle'),
      irregularity: number('clearingIrregularity'),
      roadDistance: {
        min: number('clearingRoadDistanceMin'),
        max: number('clearingRoadDistanceMax'),
      },
      path: input('clearingPath').checked
        ? {
            width: number('clearingPathWidth'),
            windiness: number('clearingPathWindiness'),
          }
        : undefined,
    };
  });
}

function render(): void {
  if (!form || !display || !canvas || !error || !stats || !context) {
    return;
  }
  const data = new FormData(form);
  const value = (name: string): number => Number(data.get(name));
  const plain = data.get('tiles') === 'plain';

  try {
    const { grid, density, roads, junctions, exits } = generateForest({
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
      clearance: value('clearance'),
      falloff: value('falloff'),
      clearingSpacing: value('clearingSpacing'),
      distance: data.get('distance') as DistanceMetric,
      clearings: readClearings(form),
      roads: data.has('road')
        ? {
            // a blank angle means a random one
            angle: data.get('roadAngle') === '' ? 'random' : value('roadAngle'),
            width: { min: value('roadWidthMin'), max: value('roadWidthMax') },
            windiness: value('roadWindiness'),
            crossings: {
              min: value('crossingsMin'),
              max: value('crossingsMax'),
            },
            crossingAngle: {
              min: value('crossingAngleMin'),
              max: value('crossingAngleMax'),
            },
            branches: {
              min: value('branchesMin'),
              max: value('branchesMax'),
            },
            branchWidth: {
              min: value('branchWidthMin'),
              max: value('branchWidthMax'),
            },
            branchAngle: {
              min: value('branchAngleMin'),
              max: value('branchAngleMax'),
            },
            branchLength: data.has('limitBranches')
              ? {
                  min: value('branchLengthMin'),
                  max: value('branchLengthMax'),
                }
              : undefined,
            // exact roads replace the generated network, as the library says
            specs: data.has('exactRoads')
              ? (JSON.parse(data.get('roadSpecs') as string) as RoadEntry[])
              : undefined,
          }
        : undefined,
    });
    error.textContent = '';
    const trees = grid
      .toString()
      .split('')
      .filter((c) => c === 'T' || c === '#').length;
    const roadTiles = grid
      .toString()
      .split('')
      .filter((c) => c === '=').length;
    stats.textContent = `${String(roads.length)} roads (${String(roadTiles)} tiles, ${String(junctions.length)} junctions), ${String(trees)} trees of ${String(grid.width * grid.height)} tiles (${((100 * trees) / (grid.width * grid.height)).toFixed(1)}%)`;

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
      drawGrid(
        canvas,
        context,
        grid,
        tileSize,
        display.value as DisplayMode,
        data.has('showExits') ? exits : [],
      );
      if (data.has('showJunctions')) {
        // a red square on every junction, in both displays
        context.fillStyle = '#d23c3c';
        for (const { x, y } of junctions) {
          context.fillRect(
            x * tileSize + tileSize / 4,
            y * tileSize + tileSize / 4,
            tileSize / 2,
            tileSize / 2,
          );
        }
      }
    }
  } catch (e) {
    error.textContent = e instanceof Error ? e.message : String(e);
  }
}

const clearings = document.querySelector<HTMLElement>('#clearings');
const clearingRow =
  document.querySelector<HTMLTemplateElement>('#clearing-row');

document
  .querySelector<HTMLButtonElement>('#add-clearing')
  ?.addEventListener('click', () => {
    const row = clearingRow?.content.cloneNode(true);
    if (row && clearings) {
      clearings.append(row);
      render();
    }
  });
clearings?.addEventListener('click', (event) => {
  const target = event.target;
  if (target instanceof HTMLElement && target.matches('.remove-clearing')) {
    target.closest('.clearing')?.remove();
    render();
  }
});

form?.addEventListener('input', render);
display?.addEventListener('input', render);
download?.addEventListener('click', () => {
  if (canvas) {
    downloadCanvas(canvas, 'angstloch-forest.png');
  }
});
render();
