import { generateMaze } from '../src';
import type { MazeSymmetry } from '../src';
import { downloadCanvas } from './download-canvas';
import { drawGrid } from './draw-grid';
import { drawTemplates } from './draw-templates';
import { createTemplateEditor } from './template-editor';
import type { DisplayMode } from './draw-grid';
import { mulberry32 } from '../src/test-helpers/mulberry32';

const form = document.querySelector<HTMLFormElement>('#controls');
const display = document.querySelector<HTMLSelectElement>('#display');
const download = document.querySelector<HTMLButtonElement>('#download');
const canvas = document.querySelector<HTMLCanvasElement>('#map');
const error = document.querySelector<HTMLElement>('#error');
const stats = document.querySelector<HTMLElement>('#stats');
const context = canvas?.getContext('2d');
const templatePanel = document.querySelector<HTMLElement>('#templates');
const editor = templatePanel
  ? createTemplateEditor(templatePanel, () => {
      render();
    })
  : undefined;

function render(): void {
  if (!form || !display || !canvas || !error || !stats || !context) {
    return;
  }
  const data = new FormData(form);
  const value = (name: string): number => Number(data.get(name));
  const tileSize = value('tileSize');

  try {
    const roomCountMax = value('roomCountMax');
    const { grid, start, rooms, roomExits } = generateMaze({
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
      rooms:
        roomCountMax > 0
          ? {
              count: { min: value('roomCountMin'), max: roomCountMax },
              width: {
                min: value('roomWidthMin'),
                max: value('roomWidthMax'),
              },
              height: {
                min: value('roomHeightMin'),
                max: value('roomHeightMax'),
              },
              sizeUniformity: value('sizeUniformity'),
            }
          : undefined,
      templates: data.get('useTemplates') ? editor?.templates() : undefined,
      exitsPerRoom: {
        min: value('exitsPerRoomMin'),
        max: value('exitsPerRoomMax'),
      },
      doorChance: value('doorChance'),
    });
    error.textContent = '';
    const doors = roomExits.filter((exit) => exit.door).length;
    const templated = rooms.filter((room) => room.template !== undefined);
    stats.textContent = `${String(rooms.length)} rooms (${String(templated.length)} templated), ${String(roomExits.length)} room exits (${String(doors)} with doors)`;
    const mode = display.value as DisplayMode;
    // room openings without a door are highlighted
    const gaps = data.get('showExits')
      ? roomExits.filter((exit) => !exit.door).map((exit) => exit.position)
      : [];
    drawGrid(canvas, context, grid, tileSize, mode, gaps);
    if (mode === 'simple') {
      context.fillStyle = '#4a8f5a';
      context.fillRect(
        start.x * tileSize + tileSize / 4,
        start.y * tileSize + tileSize / 4,
        tileSize / 2,
        tileSize / 2,
      );
    }
    if (data.get('showTemplates')) {
      drawTemplates(context, rooms, tileSize);
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
