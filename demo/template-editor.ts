import { TemplateCell } from '../src';
import type { Anchor, Area, Position, RoomTemplate, Rotation } from '../src';
import { CELL_STYLES } from './template-cell-styles';

const STORAGE_KEY = 'angstloch.templates';
const ROTATIONS: Rotation[] = [0, 90, 180, 270];
const ANCHORS: Anchor[] = [
  'center',
  'top',
  'bottom',
  'left',
  'right',
  'top-left',
  'top-right',
  'bottom-left',
  'bottom-right',
];
const CELL_KINDS = Object.values(TemplateCell);
const MAX_SIZE = 41;
const DEBOUNCE_MS = 120;

/** A template as the editor holds it: every setting is there, even the defaults. */
interface Model {
  name: string;
  cells: TemplateCell[][];
  countMin: number;
  countMax: number;
  rotate: Rotation[];
  mirror: boolean;
  accuracy: number;
  positions: { x: number; y: number; anchor: Anchor; rotations: Rotation[] }[];
  areas: Area[];
}

export interface TemplateEditor {
  /** The templates as the generators take them. */
  templates: () => RoomTemplate[];
}

const EXAMPLES: RoomTemplate[] = [
  {
    name: 'closet',
    count: { min: 3, max: 3 },
    cells: [
      [TemplateCell.Wall, TemplateCell.Exit, TemplateCell.Wall],
      [TemplateCell.Wall, TemplateCell.Floor, TemplateCell.Wall],
      [TemplateCell.Wall, TemplateCell.Wall, TemplateCell.Wall],
    ],
  },
  {
    name: 'hall',
    cells: [
      '#########',
      '#.......#',
      '#.......#',
      '#.......#',
      '###E#o#o#',
    ].map((row) =>
      Array.from(row, (char) =>
        char === '.'
          ? TemplateCell.Floor
          : char === 'E'
            ? TemplateCell.Exit
            : char === 'o'
              ? TemplateCell.OptionalExit
              : TemplateCell.Wall,
      ),
    ),
  },
];

function toModel(template: RoomTemplate): Model {
  return {
    name: template.name ?? '',
    cells: template.cells.map((row) => [...row]),
    countMin: template.count?.min ?? 1,
    countMax: template.count?.max ?? 1,
    rotate: [...(template.rotate ?? [0])],
    mirror: template.mirror ?? false,
    accuracy: template.positionAccuracy ?? 1,
    positions: (template.positions ?? []).map((position) => ({
      x: position.coords.x,
      y: position.coords.y,
      anchor: position.anchor,
      rotations: [...(position.rotations ?? [])],
    })),
    areas: (template.areas ?? []).map((area) => ({ ...area })),
  };
}

function toTemplate(model: Model): RoomTemplate {
  const positions: Position[] = model.positions.map((position) => ({
    coords: { x: position.x, y: position.y },
    anchor: position.anchor,
    ...(position.rotations.length > 0 ? { rotations: position.rotations } : {}),
  }));
  return {
    ...(model.name === '' ? {} : { name: model.name }),
    cells: model.cells,
    count: { min: model.countMin, max: model.countMax },
    rotate: model.rotate,
    mirror: model.mirror,
    positionAccuracy: model.accuracy,
    ...(positions.length > 0 ? { positions } : {}),
    ...(model.areas.length > 0
      ? { areas: model.areas.map((area) => ({ ...area })) }
      : {}),
  };
}

function blankCells(width: number, height: number): TemplateCell[][] {
  return Array.from({ length: height }, () =>
    Array<TemplateCell>(width).fill(TemplateCell.Unused),
  );
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Partial<HTMLElementTagNameMap[K]> = {},
  ...children: (Node | string)[]
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  Object.assign(node, props);
  node.append(...children);
  return node;
}

function labeled(text: string, input: HTMLElement): HTMLLabelElement {
  return el('label', {}, text, input);
}

function numberInput(
  value: number,
  attributes: { min?: number; max?: number; step?: number },
  onInput: (value: number) => void,
): HTMLInputElement {
  const input = el('input', { type: 'number', value: String(value) });
  for (const [name, attribute] of Object.entries(attributes)) {
    input.setAttribute(name, String(attribute));
  }
  input.addEventListener('input', () => {
    if (input.value !== '') {
      onInput(Number(input.value));
    }
  });
  return input;
}

function checkboxes<T extends number>(
  values: readonly T[],
  selected: T[],
  onChange: () => void,
): HTMLSpanElement {
  const group = el('span', { className: 'checks' });
  for (const value of values) {
    const box = el('input', {
      type: 'checkbox',
      checked: selected.includes(value),
    });
    box.addEventListener('change', () => {
      const at = selected.indexOf(value);
      if (box.checked && at < 0) {
        selected.push(value);
      } else if (!box.checked && at >= 0) {
        selected.splice(at, 1);
      }
      onChange();
    });
    group.append(el('label', { className: 'inline' }, box, String(value)));
  }
  return group;
}

/**
 * Builds the templates panel in the container: one card per template with its
 * settings, positions and a grid to paint cells on, JSON import and export,
 * and persistence in the browser. `onChange` is called, after a short pause,
 * whenever a template changes.
 */
export function createTemplateEditor(
  container: HTMLElement,
  onChange: () => void,
): TemplateEditor {
  let models: Model[] = [];
  let brush: TemplateCell = TemplateCell.Floor;
  let painting = false;
  let timer: number | undefined;

  const persist = (): void => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(models.map((model) => toTemplate(model))),
      );
    } catch {
      // storage can be blocked, and the editor works without it
    }
  };
  const changed = (): void => {
    persist();
    window.clearTimeout(timer);
    timer = window.setTimeout(onChange, DEBOUNCE_MS);
  };

  const palette = el('div', { className: 'palette' }, 'Brush: ');
  for (const kind of CELL_KINDS) {
    const style = CELL_STYLES[kind];
    const radio = el('input', {
      type: 'radio',
      name: 'brush',
      checked: kind === brush,
    });
    radio.addEventListener('change', () => {
      brush = kind;
    });
    const swatch = el('span', {
      className: 'swatch',
      textContent: style.glyph,
    });
    swatch.style.background = style.color;
    palette.append(
      el('label', { className: 'inline' }, radio, swatch, style.label),
    );
  }
  window.addEventListener('pointerup', () => {
    painting = false;
  });

  const cardsHost = el('div', { className: 'cards' });
  const status = el('p', { className: 'status' });
  const json = el('textarea', { rows: 6, spellcheck: false });
  const add = (template: RoomTemplate): void => {
    models.push(toModel(template));
    renderAll();
    changed();
  };

  const buttons = el('div', { className: 'buttons' });
  const button = (text: string, action: () => void): void => {
    const node = el('button', { type: 'button', textContent: text });
    node.addEventListener('click', action);
    buttons.append(node);
  };
  button('Add template', () => {
    add({
      name: `template ${String(models.length + 1)}`,
      cells: blankCells(5, 5),
    });
  });
  button('Add examples', () => {
    EXAMPLES.forEach(add);
  });
  button('Export JSON', () => {
    json.value = JSON.stringify(
      models.map((model) => toTemplate(model)),
      null,
      2,
    );
    status.textContent = 'Exported.';
  });
  button('Import JSON', () => {
    try {
      const parsed: unknown = JSON.parse(json.value);
      if (!Array.isArray(parsed)) {
        throw new TypeError('expected a list of templates');
      }
      models = (parsed as RoomTemplate[]).map(toModel);
      renderAll();
      changed();
      status.textContent = `Imported ${String(models.length)} templates.`;
    } catch (e) {
      status.textContent = `Import failed: ${e instanceof Error ? e.message : String(e)}`;
    }
  });

  const renderCard = (model: Model): HTMLElement => {
    const card = el('fieldset', { className: 'card' });
    const name = el('input', {
      type: 'text',
      value: model.name,
      placeholder: 'name',
    });
    name.addEventListener('input', () => {
      model.name = name.value;
      changed();
    });
    const index = models.indexOf(model);
    const remove = el('button', { type: 'button', textContent: 'Remove' });
    remove.addEventListener('click', () => {
      models.splice(models.indexOf(model), 1);
      renderAll();
      changed();
    });
    const duplicate = el('button', {
      type: 'button',
      textContent: 'Duplicate',
    });
    duplicate.addEventListener('click', () => {
      models.splice(models.indexOf(model) + 1, 0, {
        ...toModel(toTemplate(model)),
        name: model.name === '' ? '' : `${model.name} copy`,
      });
      renderAll();
      changed();
    });
    card.append(
      el('legend', {}, `#${String(index)} `, name, duplicate, remove),
    );

    const settings = el('div', { className: 'settings' });
    settings.append(
      labeled(
        'Count min',
        numberInput(model.countMin, { min: 0 }, (value) => {
          model.countMin = value;
          changed();
        }),
      ),
      labeled(
        'Count max',
        numberInput(model.countMax, { min: 0 }, (value) => {
          model.countMax = value;
          changed();
        }),
      ),
      labeled(
        'Accuracy',
        numberInput(model.accuracy, { min: 0, max: 1, step: 0.05 }, (value) => {
          model.accuracy = value;
          changed();
        }),
      ),
      labeled('Rotate', checkboxes(ROTATIONS, model.rotate, changed)),
    );
    const mirror = el('input', { type: 'checkbox', checked: model.mirror });
    mirror.addEventListener('change', () => {
      model.mirror = mirror.checked;
      changed();
    });
    settings.append(labeled('Mirror', mirror));
    card.append(settings);

    // positions
    const positions = el('div', { className: 'positions' });
    const renderPositions = (): void => {
      positions.replaceChildren(el('strong', {}, 'Positions'));
      for (const position of model.positions) {
        const row = el('div', { className: 'position' });
        const anchor = el('select');
        for (const value of ANCHORS) {
          anchor.append(el('option', { value, textContent: value }));
        }
        anchor.value = position.anchor;
        anchor.addEventListener('input', () => {
          position.anchor = anchor.value as Anchor;
          changed();
        });
        const drop = el('button', { type: 'button', textContent: 'x' });
        drop.addEventListener('click', () => {
          model.positions.splice(model.positions.indexOf(position), 1);
          renderPositions();
          changed();
        });
        row.append(
          labeled(
            'x',
            numberInput(position.x, {}, (value) => {
              position.x = value;
              changed();
            }),
          ),
          labeled(
            'y',
            numberInput(position.y, {}, (value) => {
              position.y = value;
              changed();
            }),
          ),
          labeled('anchor', anchor),
          labeled(
            "rotations (none: the template's)",
            checkboxes(ROTATIONS, position.rotations, changed),
          ),
          drop,
        );
        positions.append(row);
      }
      const addPosition = el('button', {
        type: 'button',
        textContent: 'Add position',
      });
      addPosition.addEventListener('click', () => {
        model.positions.push({ x: 0, y: 0, anchor: 'center', rotations: [] });
        renderPositions();
        changed();
      });
      positions.append(addPosition);
    };
    renderPositions();
    card.append(positions);

    // areas
    const areas = el('div', { className: 'positions' });
    const renderAreas = (): void => {
      areas.replaceChildren(
        el('strong', {}, 'Areas (for copies without a position)'),
      );
      for (const area of model.areas) {
        const row = el('div', { className: 'position' });
        const drop = el('button', { type: 'button', textContent: 'x' });
        drop.addEventListener('click', () => {
          model.areas.splice(model.areas.indexOf(area), 1);
          renderAreas();
          changed();
        });
        for (const field of ['x', 'y', 'width', 'height'] as const) {
          row.append(
            labeled(
              field,
              numberInput(
                area[field],
                { min: field === 'width' || field === 'height' ? 1 : 0 },
                (value) => {
                  area[field] = value;
                  changed();
                },
              ),
            ),
          );
        }
        row.append(drop);
        areas.append(row);
      }
      const addArea = el('button', { type: 'button', textContent: 'Add area' });
      addArea.addEventListener('click', () => {
        model.areas.push({ x: 0, y: 0, width: 10, height: 10 });
        renderAreas();
        changed();
      });
      areas.append(addArea);
    };
    renderAreas();
    card.append(areas);

    // the cell painter
    const painter = el('div', { className: 'painter' });
    const sizeRow = el('div', { className: 'settings' });
    const grid = el('div', { className: 'grid' });
    const renderGrid = (): void => {
      const width = model.cells[0]?.length ?? 0;
      grid.style.gridTemplateColumns = `repeat(${String(width)}, 1.5rem)`;
      grid.replaceChildren();
      model.cells.forEach((row, y) => {
        row.forEach((cell, x) => {
          const node = el('div', { className: 'cell' });
          const paint = (): void => {
            const target = model.cells[y];
            if (target) {
              target[x] = brush;
            }
            show(node, brush);
            changed();
          };
          show(node, cell);
          node.addEventListener('pointerdown', (event) => {
            event.preventDefault();
            painting = true;
            paint();
          });
          node.addEventListener('pointerenter', () => {
            if (painting) {
              paint();
            }
          });
          grid.append(node);
        });
      });
    };
    const resize = (width: number, height: number): void => {
      model.cells = blankCells(width, height).map((row, y) =>
        row.map((_, x) => model.cells[y]?.[x] ?? TemplateCell.Unused),
      );
      renderGrid();
      changed();
    };
    sizeRow.append(
      labeled(
        'Width',
        numberInput(
          model.cells[0]?.length ?? 1,
          { min: 1, max: MAX_SIZE },
          (value) => {
            resize(Math.min(MAX_SIZE, Math.max(1, value)), model.cells.length);
          },
        ),
      ),
      labeled(
        'Height',
        numberInput(model.cells.length, { min: 1, max: MAX_SIZE }, (value) => {
          resize(
            model.cells[0]?.length ?? 1,
            Math.min(MAX_SIZE, Math.max(1, value)),
          );
        }),
      ),
    );
    renderGrid();
    painter.append(sizeRow, grid);
    card.append(painter);
    return card;
  };

  const show = (node: HTMLElement, cell: TemplateCell): void => {
    const style = CELL_STYLES[cell];
    node.style.background = style.color;
    node.textContent = style.glyph;
    node.title = style.label;
  };

  const renderAll = (): void => {
    cardsHost.replaceChildren(...models.map(renderCard));
  };

  try {
    const stored: unknown = JSON.parse(
      localStorage.getItem(STORAGE_KEY) ?? '[]',
    );
    if (Array.isArray(stored)) {
      models = (stored as RoomTemplate[]).map(toModel);
    }
  } catch {
    models = [];
  }
  renderAll();
  container.append(
    el('h2', {}, 'Templates'),
    palette,
    buttons,
    cardsHost,
    json,
    status,
  );

  return { templates: () => models.map((model) => toTemplate(model)) };
}
