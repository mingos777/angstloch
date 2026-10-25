import { generateDigDungeon, generateRoomDungeon } from '../src';
import type {
  CorridorSymmetry,
  LayoutSymmetry,
  Placement,
  RoomPartition,
} from '../src';
import { mulberry32 } from '../src/test-helpers/mulberry32';
import { downloadCanvas } from './download-canvas';
import { drawGrid } from './draw-grid';
import { drawTemplates } from './draw-templates';
import { createTemplateEditor } from './template-editor';
import type { DisplayMode } from './draw-grid';

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
  const roomCountMax = data.get('roomCountMax') as string;

  try {
    const shared = {
      width: value('width'),
      height: value('height'),
      random: mulberry32(value('seed')),
      placement: data.get('placement') as Placement,
      roomWidth: { min: value('roomWidthMin'), max: value('roomWidthMax') },
      roomHeight: { min: value('roomHeightMin'), max: value('roomHeightMax') },
      sizeUniformity: value('sizeUniformity'),
      roomCount: {
        min: value('roomCountMin'),
        max:
          roomCountMax === '' ? Number.MAX_SAFE_INTEGER : Number(roomCountMax),
      },
      roomSpacing: value('roomSpacing'),
      fill: value('fill'),
      exitsPerRoom: {
        min: value('exitsPerRoomMin'),
        max: value('exitsPerRoomMax'),
      },
      loopChance: value('loopChance'),
      deadEndChance: value('deadEndChance'),
      doorChance: value('doorChance'),
      straight: value('straight'),
      horizontalBias: value('horizontalBias'),
      verticalBias: value('verticalBias'),
      layoutSymmetry: data.get('layoutSymmetry') as LayoutSymmetry,
      layoutSymmetryChance: value('layoutSymmetryChance'),
      corridorSymmetry: data.get('corridorSymmetry') as CorridorSymmetry,
      corridorSymmetryChance: value('corridorSymmetryChance'),
      templates: editor?.templates() ?? [],
      templateSymmetry: data.get('templateSymmetry') === 'on',
    };
    const { grid, rooms, exits, fill } =
      data.get('generator') === 'dig'
        ? generateDigDungeon({
            ...shared,
            corridorLength: {
              min: value('corridorLengthMin'),
              max: value('corridorLengthMax'),
            },
            branchChance: value('branchChance'),
          })
        : generateRoomDungeon({
            ...shared,
            partition: data.get('partition') as RoomPartition,
            spacingUniformity: value('spacingUniformity'),
          });
    error.textContent = '';
    const doors = exits.filter((exit) => exit.door).length;
    const templated = rooms.filter((room) => room.template !== undefined);
    stats.textContent = `${String(rooms.length)} rooms (${String(templated.length)} templated), ${String(exits.length)} exits (${String(doors)} with doors), fill ${fill.toFixed(3)}`;
    // open exits, which have no door, are highlighted
    const openExits = data.get('showExits')
      ? exits.filter((exit) => !exit.door).map((exit) => exit.position)
      : [];
    drawGrid(
      canvas,
      context,
      grid,
      tileSize,
      display.value as DisplayMode,
      openExits,
    );
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
    downloadCanvas(canvas, 'angstloch-dungeon.png');
  }
});
render();
