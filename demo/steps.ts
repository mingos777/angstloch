import { Tile, emptyMap, pipeline } from '../src';
import type {
  CrossingPlan,
  ForestTemplate,
  Grid,
  PlacedClearing,
  Point,
} from '../src';
import { mulberry32 } from '../src/test-helpers/mulberry32';
import { downloadCanvas } from './download-canvas';
import { Color, drawGrid } from './draw-grid';
import type { DisplayMode } from './draw-grid';
import { STEP_DEFS } from './step-defs';
import type { StepDef } from './step-defs';
import { Values } from './step-fields';
import type { Field, FieldValue } from './step-fields';

const form = document.querySelector<HTMLFormElement>('#controls');
const overlays = document.querySelector<HTMLFormElement>('#overlays');
const list = document.querySelector<HTMLElement>('#steps');
const addKind = document.querySelector<HTMLSelectElement>('#add-kind');
const after = document.querySelector<HTMLSelectElement>('#after');
const display = document.querySelector<HTMLSelectElement>('#display');
const download = document.querySelector<HTMLButtonElement>('#download');
const canvas = document.querySelector<HTMLCanvasElement>('#map');
const error = document.querySelector<HTMLElement>('#error');
const stats = document.querySelector<HTMLElement>('#stats');
const failures = document.querySelector<HTMLElement>('#failures');
const context = canvas?.getContext('2d');

/** A step in the list, with what its controls hold. */
interface Card {
  def: StepDef;
  values: Record<string, FieldValue>;
}

/** What the steps have reported by the time a snapshot was taken. */
interface Extras {
  clearings: PlacedClearing[];
  templates: ForestTemplate[];
  junctions: Point[];
  exits: Point[];
}

/** The map after a step of the last attempt. */
interface Snapshot {
  name: string;
  grid: Grid;
  extras: Partial<Extras>;
}

/** The steps that were added, in order. */
let cards: Card[] = [];

/** The maps after each step of the last run, in order, starting with the base. */
let snapshots: Snapshot[] = [];

/** What `addRoads` traced in the last attempt: the roads as grown and how they cross the streams. */
let traced: { grown: Point[][]; plans: CrossingPlan[] } | undefined;

function newCard(name: string): Card | undefined {
  const def = STEP_DEFS.find((candidate) => candidate.name === name);
  return (
    def && {
      def,
      values: Object.fromEntries(
        def.fields.map(({ key, value }) => [key, value]),
      ),
    }
  );
}

/** The steps of a forest, to start from. */
const FOREST = [
  'plantTrees',
  'addStreams',
  'addRoads',
  'placeClearings',
  'addFootbridges',
];

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
  if (!form || !overlays || !after || !display || !canvas || !context) {
    return;
  }
  const at = Number(after.value);
  const shown = snapshots[at];
  if (!shown) {
    return;
  }
  const tileSize = Number(new FormData(form).get('tileSize'));
  const show = new FormData(overlays);
  const { extras } = shown;
  drawGrid(
    canvas,
    context,
    shown.grid,
    tileSize,
    display.value as DisplayMode,
    show.has('showExits') ? (extras.exits ?? []) : [],
  );
  if (show.has('showClearings')) {
    // an outlined square on the center of every clearing
    for (const center of extras.clearings ?? []) {
      mark(context, center, Color.BrightYellow, tileSize);
    }
  }
  if (show.has('showTemplates')) {
    // an outline round the box of every template
    context.strokeStyle = Color.BrightMagenta;
    context.lineWidth = Math.max(1, tileSize / 6);
    for (const { x, y, width, height } of extras.templates ?? []) {
      context.strokeRect(
        x * tileSize,
        y * tileSize,
        width * tileSize,
        height * tileSize,
      );
    }
  }
  if (show.has('showJunctions')) {
    // a red square on every junction
    context.fillStyle = '#d23c3c';
    for (const { x, y } of extras.junctions ?? []) {
      context.fillRect(
        x * tileSize + tileSize / 4,
        y * tileSize + tileSize / 4,
        tileSize / 2,
        tileSize / 2,
      );
    }
  }
  // what addRoads traced belongs to the map from that step on
  const roadsAt = snapshots.findIndex(({ name }) => name === 'addRoads');
  if (traced && roadsAt !== -1 && at >= roadsAt) {
    if (show.has('showGrown')) {
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
    if (show.has('showPlans')) {
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

/** Runs the steps in the list and shows the last attempt. */
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
  traced = undefined;
  try {
    // a bad option throws when its step is made
    const steps = cards.map(({ def, values }) => def.make(new Values(values)));
    const makeBase = emptyMap({
      width: value('width'),
      height: value('height'),
      tile: value('baseTile') as Tile,
    });
    const run = pipeline(
      () => {
        // a new attempt starts here, so keep the snapshots of the last one only
        const state = makeBase();
        traced = undefined;
        snapshots = [{ name: 'base', grid: state.grid.clone(), extras: {} }];
        return state;
      },
      steps,
      {
        random: mulberry32(value('seed')),
        attempts: value('attempts'),
        trace: (_name, traceData) => {
          traced = traceData as { grown: Point[][]; plans: CrossingPlan[] };
        },
        onStep: (name, state) => {
          const extras = state as unknown as Partial<Extras>;
          snapshots.push({
            name,
            grid: state.grid.clone(),
            extras: {
              clearings: extras.clearings,
              templates: extras.templates,
              junctions: extras.junctions,
              exits: extras.exits,
            },
          });
        },
      },
    );
    const done = run as unknown as Partial<Record<string, unknown[]>>;
    const counts = ['roads', 'streams', 'bridges', 'clearings', 'templates']
      .filter((name) => done[name])
      .map((name) => `${String(done[name]?.length)} ${name}`);
    summary = [
      `${String(run.attempts)} attempt(s), ${String(run.failures.length)} failure(s)`,
      ...counts,
    ].join(', ');
    failed = run.failures;
    error.textContent = '';
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

/** Makes the control of a field. */
function control(card: Card, field: Field): HTMLLabelElement {
  const label = document.createElement('label');
  label.append(field.label);
  const input =
    field.type === 'select'
      ? document.createElement('select')
      : field.type === 'json'
        ? document.createElement('textarea')
        : document.createElement('input');
  input.dataset.field = field.key;
  if (input instanceof HTMLSelectElement) {
    for (const [value, text] of field.options ?? []) {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = text;
      input.append(option);
    }
  } else if (input instanceof HTMLInputElement) {
    input.type = field.type;
    for (const [name, attribute] of Object.entries(field.attrs ?? {})) {
      input.setAttribute(name, attribute);
    }
  }
  const current = card.values[field.key] ?? field.value;
  if (input instanceof HTMLInputElement && field.type === 'checkbox') {
    input.checked = current === true;
  } else {
    input.value = String(current);
  }
  label.append(input);
  if (field.type === 'json') {
    label.classList.add('wide');
  }
  return label;
}

/** Draws the list of cards again, after a step was added, moved or removed. */
function renderCards(): void {
  list?.replaceChildren(
    ...cards.map((card, index) => {
      const box = document.createElement('section');
      box.className = 'step';
      box.dataset.index = String(index);
      const head = document.createElement('header');
      const title = document.createElement('strong');
      title.textContent = `${String(index + 1)}. ${card.def.name}`;
      const summary = document.createElement('span');
      summary.textContent = card.def.summary;
      head.append(title, summary);
      for (const [action, text] of [
        ['up', '↑'],
        ['down', '↓'],
        ['remove', '×'],
      ] as const) {
        const button = document.createElement('button');
        button.type = 'button';
        button.dataset.action = action;
        button.textContent = text;
        head.append(button);
      }
      const fields = document.createElement('div');
      fields.className = 'fields';
      fields.append(...card.def.fields.map((field) => control(card, field)));
      box.append(head, fields);
      return box;
    }),
  );
}

function setCards(names: string[]): void {
  cards = names.flatMap((name) => newCard(name) ?? []);
  renderCards();
  render();
}

addKind?.replaceChildren(
  ...STEP_DEFS.map(({ name }) => {
    const option = document.createElement('option');
    option.value = name;
    option.textContent = name;
    return option;
  }),
);
document.querySelector('#add-step')?.addEventListener('click', () => {
  const card = addKind && newCard(addKind.value);
  if (card) {
    cards.push(card);
    renderCards();
    render();
  }
});
document.querySelector('#load-forest')?.addEventListener('click', () => {
  setCards(FOREST);
});
document.querySelector('#clear-steps')?.addEventListener('click', () => {
  setCards([]);
});

list?.addEventListener('click', (event) => {
  const target = event.target;
  const box =
    target instanceof HTMLElement && target.closest<HTMLElement>('.step');
  const action = target instanceof HTMLElement && target.dataset.action;
  const index = Number(box && box.dataset.index);
  if (!box || !action) {
    return;
  }
  const card = cards[index];
  if (action === 'remove') {
    cards.splice(index, 1);
  } else if (card) {
    const to = action === 'up' ? index - 1 : index + 1;
    const other = cards[to];
    if (other) {
      cards[to] = card;
      cards[index] = other;
    }
  }
  renderCards();
  render();
});
list?.addEventListener('input', (event) => {
  const target = event.target;
  const box =
    target instanceof HTMLElement && target.closest<HTMLElement>('.step');
  const card = box && cards[Number(box.dataset.index)];
  if (
    card &&
    (target instanceof HTMLInputElement ||
      target instanceof HTMLSelectElement ||
      target instanceof HTMLTextAreaElement) &&
    target.dataset.field
  ) {
    card.values[target.dataset.field] =
      target instanceof HTMLInputElement && target.type === 'checkbox'
        ? target.checked
        : target.value;
    render();
  }
});
form?.addEventListener('input', render);
// only the picture changes, so do not run the pipeline again
after?.addEventListener('input', paint);
display?.addEventListener('input', paint);
overlays?.addEventListener('input', paint);
download?.addEventListener('click', () => {
  if (canvas) {
    downloadCanvas(canvas, 'angstloch-steps.png');
  }
});
setCards(FOREST);
