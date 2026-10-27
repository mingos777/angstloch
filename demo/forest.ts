import { Tile } from '../src';
import type {
  ClearingSpec,
  DistanceMetric,
  Point,
  Range,
  RoadEntry,
} from '../src';
import { buildForest } from '../src/forest/build-forest';
import type { CrossingPlan } from '../src/streams/crossing-plan';
import { mulberry32 } from '../src/test-helpers/mulberry32';
import { FOREST_TEMPLATES } from './forest-templates';
import { downloadCanvas } from './download-canvas';
import { Color, drawGrid } from './draw-grid';
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
    const radiusY = (): Range | undefined => {
      const min = blank(input('clearingRadiusYMin').value);
      const max = blank(input('clearingRadiusYMax').value);
      return min === undefined && max === undefined
        ? undefined
        : { min: min ?? max ?? 0, max: max ?? min ?? 0 };
    };
    const at = row.querySelector<HTMLSelectElement>('[name="clearingAt"]')
      ?.value as '' | 'branch-end' | 'stream' | undefined;
    return {
      // a blank position means a random one, and a branch end or a stream has none
      at: at || undefined,
      x: at ? undefined : blank(input('clearingX').value),
      y: at ? undefined : blank(input('clearingY').value),
      radiusX: {
        min: number('clearingRadiusXMin'),
        max: number('clearingRadiusXMax'),
      },
      // blank radii for y mean the same as x
      radiusY: radiusY(),
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
    // the roads as they were grown, before the streams bent them
    const grown: Point[][] = [];
    // how they cross the streams
    const plans: CrossingPlan[] = [];
    const {
      grid,
      density,
      roads,
      junctions,
      exits,
      streams,
      bridges,
      templates,
    } = buildForest(
      {
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
        // in the plain display the deep water is the wall that needs swimming
        shallowTile: plain ? Tile.Floor : Tile.ShallowWater,
        deepTile: plain ? Tile.Wall : Tile.DeepWater,
        bridgeTile: plain ? Tile.Floor : Tile.Bridge,
        streams: data.has('stream')
          ? {
              // a blank angle means a random one
              angle:
                data.get('streamAngle') === ''
                  ? 'random'
                  : value('streamAngle'),
              width: {
                min: value('streamWidthMin'),
                max: value('streamWidthMax'),
              },
              windiness: value('streamWindiness'),
              shoreWidth: value('shoreWidth'),
              spring: data.has('spring'),
              bridges: value('streamBridges'),
              tributaries: {
                min: value('tributariesMin'),
                max: value('tributariesMax'),
              },
              tributaryWidth: {
                min: value('tributaryWidthMin'),
                max: value('tributaryWidthMax'),
              },
              tributaryAngle: {
                min: value('tributaryAngleMin'),
                max: value('tributaryAngleMax'),
              },
              tributaryLength: data.has('limitTributaries')
                ? {
                    min: value('tributaryLengthMin'),
                    max: value('tributaryLengthMax'),
                  }
                : undefined,
              bridgeAngle: {
                min: value('bridgeAngleMin'),
                max: value('bridgeAngleMax'),
              },
            }
          : undefined,
        clearance: value('clearance'),
        falloff: value('falloff'),
        bankClearance: value('bankClearance'),
        bankFalloff: value('bankFalloff'),
        clearingSpacing: value('clearingSpacing'),
        distance: data.get('distance') as DistanceMetric,
        clearings: readClearings(form),
        templates: data.has('useTemplates')
          ? [
              {
                ...(FOREST_TEMPLATES[data.get('templateKind') as string] ?? {
                  cells: [],
                }),
                count: {
                  min: value('templateCountMin'),
                  max: value('templateCountMax'),
                },
                chance: value('templateChance'),
                clearing: data.has('templateClearing'),
              },
            ]
          : undefined,
        roads: data.has('road')
          ? {
              // a blank angle means a random one
              angle:
                data.get('roadAngle') === '' ? 'random' : value('roadAngle'),
              width: {
                min: value('roadWidthMin'),
                max: value('roadWidthMax'),
              },
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
      },
      {
        grown: (points) => grown.push(points),
        planned: (plan) => plans.push(plan),
      },
    );
    error.textContent = '';
    const trees = grid
      .toString()
      .split('')
      .filter((c) => c === 'T' || c === '#').length;
    const roadTiles = grid
      .toString()
      .split('')
      .filter((c) => c === '=').length;
    stats.textContent = `${String(streams.length)} streams, ${String(bridges.length)} bridges, ${String(templates.length)} templates, ${String(roads.length)} roads (${String(roadTiles)} tiles, ${String(junctions.length)} junctions), ${String(trees)} trees of ${String(grid.width * grid.height)} tiles (${((100 * trees) / (grid.width * grid.height)).toFixed(1)}%)`;

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
      if (data.has('showTemplates')) {
        // an outline round the box of every template
        context.strokeStyle = Color.BrightMagenta;
        context.lineWidth = Math.max(1, tileSize / 6);
        for (const { x, y, width, height } of templates) {
          context.strokeRect(
            x * tileSize,
            y * tileSize,
            width * tileSize,
            height * tileSize,
          );
        }
      }
      if (data.has('showGrown')) {
        // a small dot on every tile of a road as it was grown
        context.fillStyle = Color.BrightMagenta;
        for (const { x, y } of grown.flat()) {
          context.fillRect(
            x * tileSize + tileSize / 3,
            y * tileSize + tileSize / 3,
            tileSize / 3,
            tileSize / 3,
          );
        }
      }
      if (data.has('showPlans')) {
        // an outlined square on the ends and on every tile where a road
        // turns onto a bridge, and where it reaches and leaves the water
        const mark = ({ x, y }: Point, color: string) => {
          context.strokeStyle = color;
          context.lineWidth = Math.max(1, tileSize / 6);
          context.strokeRect(
            x * tileSize + 1,
            y * tileSize + 1,
            tileSize - 2,
            tileSize - 2,
          );
        };
        for (const { start, end, crossings } of plans) {
          mark(start, Color.BrightCyan);
          mark(end, Color.BrightCyan);
          for (const { approach, entry, exit, departure } of crossings) {
            mark(approach, Color.BrightCyan);
            mark(departure, Color.BrightCyan);
            mark(entry, Color.BrightYellow);
            mark(exit, Color.BrightYellow);
          }
        }
      }
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
