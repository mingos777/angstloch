import {
  addRoads,
  addStreams,
  emptyMap,
  pipeline,
  placeClearings,
  plantTrees,
  pruneVerge,
  stampTile,
  step,
} from '../src';
import type {
  CrossingPlan,
  DistanceMetric,
  Grid,
  PlacedClearing,
  Point,
  Tile,
} from '../src';
import { mulberry32 } from '../src/test-helpers/mulberry32';
import { downloadCanvas } from './download-canvas';
import { Color, drawGrid } from './draw-grid';
import type { DisplayMode } from './draw-grid';

const form = document.querySelector<HTMLFormElement>('#controls');
const after = document.querySelector<HTMLSelectElement>('#after');
const display = document.querySelector<HTMLSelectElement>('#display');
const download = document.querySelector<HTMLButtonElement>('#download');
const canvas = document.querySelector<HTMLCanvasElement>('#map');
const error = document.querySelector<HTMLElement>('#error');
const stats = document.querySelector<HTMLElement>('#stats');
const failures = document.querySelector<HTMLElement>('#failures');
const context = canvas?.getContext('2d');

/** The maps after each step of the last run, in order, starting with the base. */
let snapshots: { name: string; grid: Grid }[] = [];

/** What `addRoads` traced in the last attempt: the roads as grown and how they cross the streams. */
let traced: { grown: Point[][]; plans: CrossingPlan[] } | undefined;

/** The clearings that `placeClearings` made in the last attempt. */
let placed: PlacedClearing[] = [];

/** Outlines a tile. */
function mark(
  context: CanvasRenderingContext2D,
  { x, y }: Point,
  color: string,
  tileSize: number,
): void {
  context.strokeStyle = color;
  context.lineWidth = Math.max(1, tileSize / 6);
  context.strokeRect(
    x * tileSize + 1,
    y * tileSize + 1,
    tileSize - 2,
    tileSize - 2,
  );
}

function paint(): void {
  if (!form || !after || !display || !canvas || !context) {
    return;
  }
  const shown = snapshots[Number(after.value)];
  if (shown) {
    const data = new FormData(form);
    const tileSize = Number(data.get('tileSize'));
    drawGrid(
      canvas,
      context,
      shown.grid,
      tileSize,
      display.value as DisplayMode,
    );
    // what addRoads traced belongs to the map from that step on
    const roadsAt = snapshots.findIndex(({ name }) => name === 'addRoads');
    const clearingsAt = snapshots.findIndex(
      ({ name }) => name === 'placeClearings',
    );
    if (
      data.has('showClearings') &&
      clearingsAt !== -1 &&
      Number(after.value) >= clearingsAt
    ) {
      // an outlined square on the center of every clearing
      for (const center of placed) {
        mark(context, center, Color.BrightYellow, tileSize);
      }
    }
    if (traced && roadsAt !== -1 && Number(after.value) >= roadsAt) {
      if (data.has('showGrown')) {
        // a small dot on every tile of a road as it was grown
        context.fillStyle = Color.BrightMagenta;
        for (const { x, y } of traced.grown.flat()) {
          context.fillRect(
            x * tileSize + tileSize / 3,
            y * tileSize + tileSize / 3,
            tileSize / 3,
            tileSize / 3,
          );
        }
      }
      if (data.has('showPlans')) {
        // outlined squares on the ends of the roads and where they cross water
        for (const { start, end, crossings } of traced.plans) {
          mark(context, start, Color.BrightCyan, tileSize);
          mark(context, end, Color.BrightCyan, tileSize);
          for (const { approach, entry, exit, departure } of crossings) {
            mark(context, approach, Color.BrightCyan, tileSize);
            mark(context, departure, Color.BrightCyan, tileSize);
            mark(context, entry, Color.BrightYellow, tileSize);
            mark(context, exit, Color.BrightYellow, tileSize);
          }
        }
      }
    }
  }
}

/** Shows how the steps API fits together: `plantTrees`, `addStreams`, then a step of its own that stamps a border and prunes its verge, then one that fails at random. */
function render(): void {
  if (!form || !after || !error || !stats || !failures) {
    return;
  }
  const data = new FormData(form);
  const value = (name: string): number => Number(data.get(name));
  const kept = after.value;

  let summary = '';
  let failed: { attempt: number; step: string; error: unknown }[] = [];
  snapshots = [];
  try {
    const makeBase = emptyMap({
      width: value('width'),
      height: value('height'),
      tile: value('baseTile') as Tile,
    });
    const border = step('border', {}, (state, { random }) => {
      const { grid } = state;
      const mask = new Uint8Array(grid.width * grid.height);
      for (let y = 0; y < grid.height; ++y) {
        for (let x = 0; x < grid.width; ++x) {
          if (
            x === 0 ||
            y === 0 ||
            x === grid.width - 1 ||
            y === grid.height - 1
          ) {
            stampTile(state, x, y, value('borderTile') as Tile);
            mask[y * grid.width + x] = 1;
          }
        }
      }
      pruneVerge(
        state,
        mask,
        {
          clearance: value('clearance'),
          falloff: value('falloff'),
          distance: data.get('distance') as DistanceMetric,
        },
        random,
      );
      return {};
    });
    const flaky = step('flaky', {}, (_state, { random }) => {
      if (random() < value('failureChance')) {
        throw new Error('bad luck');
      }
      return {};
    });

    try {
      const run = pipeline(
        () => {
          // a new attempt starts here, so keep the snapshots of the last one only
          const state = makeBase();
          traced = undefined;
          placed = [];
          snapshots = [{ name: 'base', grid: state.grid.clone() }];
          return state;
        },
        [
          plantTrees({
            scaleX: value('scale'),
            scaleY: value('scale'),
            density: { min: value('densityMin'), max: value('densityMax') },
            tile: value('plantedTile') as Tile,
          }),
          ...(data.get('stream')
            ? [
                addStreams({
                  angle: data.get('streamAngle')
                    ? value('streamAngle')
                    : 'random',
                  width: {
                    min: value('streamWidthMin'),
                    max: value('streamWidthMax'),
                  },
                  windiness: value('streamWindiness'),
                  tributaries: {
                    min: value('tributaries'),
                    max: value('tributaries'),
                  },
                  clearance: value('bankClearance'),
                  falloff: value('bankFalloff'),
                  distance: data.get('distance') as DistanceMetric,
                }),
              ]
            : []),
          ...(data.get('roads')
            ? [
                addRoads({
                  angle: data.get('roadAngle') ? value('roadAngle') : 'random',
                  width: {
                    min: value('roadWidthMin'),
                    max: value('roadWidthMax'),
                  },
                  windiness: value('roadWindiness'),
                  crossings: {
                    min: value('crossings'),
                    max: value('crossings'),
                  },
                  branches: { min: value('branches'), max: value('branches') },
                  branchLength: data.get('branchLength')
                    ? {
                        min: value('branchLength'),
                        max: value('branchLength'),
                      }
                    : undefined,
                  bridgeAngle: {
                    min: value('bridgeAngleMin'),
                    max: value('bridgeAngleMax'),
                  },
                  clearance: value('roadClearance'),
                  falloff: value('roadFalloff'),
                  distance: data.get('distance') as DistanceMetric,
                }),
              ]
            : []),
          ...(value('clearings') + value('branchEndClearings') > 0
            ? [
                placeClearings({
                  clearings: [
                    ...Array.from({ length: value('clearings') }, () => ({
                      radiusX: {
                        min: value('clearingRadiusMin'),
                        max: value('clearingRadiusMax'),
                      },
                      irregularity: value('clearingIrregularity'),
                    })),
                    ...Array.from(
                      { length: value('branchEndClearings') },
                      () => ({
                        at: 'branch-end' as const,
                        radiusX: {
                          min: value('clearingRadiusMin'),
                          max: value('clearingRadiusMax'),
                        },
                        irregularity: value('clearingIrregularity'),
                      }),
                    ),
                  ],
                  spacing: value('clearingSpacing'),
                  falloff: value('clearingFalloff'),
                  distance: data.get('distance') as DistanceMetric,
                }),
              ]
            : []),
          border,
          flaky,
        ],
        {
          trace: (_name, traceData) => {
            traced = traceData as { grown: Point[][]; plans: CrossingPlan[] };
          },
          random: mulberry32(value('seed')),
          attempts: value('attempts'),
          onStep: (name, state) => {
            snapshots.push({ name, grid: state.grid.clone() });
          },
        },
      );
      placed = (run as { clearings?: PlacedClearing[] }).clearings ?? [];
      const prunable = run.prunable.reduce((sum, byte) => sum + byte, 0);
      summary = `${String(run.attempts)} attempt(s), ${String(run.failures.length)} failure(s), ${String(prunable)} prunable tiles left after the border, ${String(placed.length)} clearing(s)`;
      failed = run.failures;
      error.textContent = '';
    } catch (e) {
      error.textContent = e instanceof Error ? e.message : String(e);
    }
  } catch (e) {
    error.textContent = e instanceof Error ? e.message : String(e);
  }

  after.replaceChildren(
    ...snapshots.map(({ name }, index) => {
      const option = document.createElement('option');
      option.value = String(index);
      option.textContent = `${String(index)}: ${name}`;
      return option;
    }),
  );
  after.value = snapshots[Number(kept)] ? kept : String(snapshots.length - 1);
  stats.textContent = summary;
  failures.textContent = failed
    .map(
      ({ attempt, step: name, error: e }) =>
        `attempt ${String(attempt)}: step "${name}" threw ${e instanceof Error ? e.message : String(e)}`,
    )
    .join('\n');
  paint();
}

form?.addEventListener('input', render);
// only the picture changes, so do not run the pipeline again
after?.addEventListener('input', paint);
display?.addEventListener('input', paint);
download?.addEventListener('click', () => {
  if (canvas) {
    downloadCanvas(canvas, 'angstloch-steps.png');
  }
});
render();
