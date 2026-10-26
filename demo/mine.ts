import { generateMine } from '../src';
import type { Area, MineLayout, MineRingShape } from '../src';
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

const SHAFT_MARK = 'rgba(200, 40, 40, 0.8)';
const HALL_MARK = 'rgba(40, 160, 80, 0.9)';
const CAVERN_MARK = 'rgba(200, 120, 20, 0.9)';
const ADIT_MARK = 'rgba(40, 90, 200, 0.8)';

function render(): void {
  if (!form || !display || !canvas || !error || !stats || !context) {
    return;
  }
  const data = new FormData(form);
  const value = (name: string): number => Number(data.get(name));
  // a blank count of rings means one that follows from the density
  const rings =
    data.get('ringsMin') === '' || data.get('ringsMax') === ''
      ? undefined
      : { min: value('ringsMin'), max: value('ringsMax') };
  // a blank size means one that follows from the density
  const hallSize =
    data.get('hallSizeMin') === '' || data.get('hallSizeMax') === ''
      ? undefined
      : { min: value('hallSizeMin'), max: value('hallSizeMax') };

  try {
    const roomCountMax = value('roomCountMax');
    const { grid, passages, halls, caverns, rooms, roomExits, exits } =
      generateMine({
        width: value('width'),
        height: value('height'),
        random: mulberry32(value('seed')),
        layout: data.get('layout') as MineLayout,
        // a blank density means the default of the layout
        density: data.get('density') === '' ? undefined : value('density'),
        shaftWidth: {
          min: value('shaftWidthMin'),
          max: value('shaftWidthMax'),
        },
        shaftWindiness: value('shaftWindiness'),
        // a blank angle means a random one
        angle: data.get('angle') === '' ? 'random' : value('angle'),
        aditWidth: { min: value('aditWidthMin'), max: value('aditWidthMax') },
        aditWindiness: value('aditWindiness'),
        aditLength: {
          min: value('aditLengthMin'),
          max: value('aditLengthMax'),
        },
        branchAngle: {
          min: value('branchAngleMin'),
          max: value('branchAngleMax'),
        },
        loops: value('loops'),
        halls: { min: value('hallsMin'), max: value('hallsMax') },
        hallVeins: { min: value('hallVeinsMin'), max: value('hallVeinsMax') },
        hallSize,
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
        caverns: { min: value('cavernsMin'), max: value('cavernsMax') },
        cavernSize: {
          min: value('cavernSizeMin'),
          max: value('cavernSizeMax'),
        },
        cavernFill: value('cavernFill'),
        rings,
        ringShape: data.get('ringShape') as MineRingShape,
        ringWidth: { min: value('ringWidthMin'), max: value('ringWidthMax') },
        ringWobble: value('ringWobble'),
        spokes: { min: value('spokesMin'), max: value('spokesMax') },
        hallRagged: value('hallRagged'),
        pillarSize: {
          min: value('pillarSizeMin'),
          max: value('pillarSizeMax'),
        },
        pillarSpacing: {
          min: value('pillarSpacingMin'),
          max: value('pillarSpacingMax'),
        },
        pillarRagged: value('pillarRagged'),
        pillarJitter: value('pillarJitter'),
        veinWidth: { min: value('veinWidthMin'), max: value('veinWidthMax') },
        veinWindiness: value('veinWindiness'),
        veinSpacing: value('veinSpacing'),
        minExits: value('minExits'),
        maxExits: value('maxExits'),
      });
    error.textContent = '';
    const floors = grid
      .toString()
      .split('')
      .filter((c) => c === '.').length;
    stats.textContent = `${(
      (100 * floors) /
      (grid.width * grid.height)
    ).toFixed(
      1,
    )}% floor (${String(floors)} tiles of ${String(grid.width * grid.height)}), ${String(passages.length)} tunnels, ${String(rooms.length)} rooms, ${String(roomExits.length)} room exits, ${String(exits.length)} exits`;
    const tileSize = value('tileSize');
    drawGrid(canvas, context, grid, tileSize, display.value as DisplayMode);
    if (data.has('showTunnels')) {
      for (const { kind, tiles } of passages) {
        context.fillStyle = kind === 'shaft' ? SHAFT_MARK : ADIT_MARK;
        for (const { x, y } of tiles) {
          context.fillRect(
            x * tileSize + tileSize / 3,
            y * tileSize + tileSize / 3,
            tileSize / 3,
            tileSize / 3,
          );
        }
      }
    }
    context.lineWidth = 2;
    const outline = (areas: Area[], color: string): void => {
      context.strokeStyle = color;
      for (const area of areas) {
        context.strokeRect(
          area.x * tileSize,
          area.y * tileSize,
          area.width * tileSize,
          area.height * tileSize,
        );
      }
    };
    if (data.has('showHalls')) {
      outline(halls, HALL_MARK);
    }
    if (data.has('showCaverns')) {
      outline(caverns, CAVERN_MARK);
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
    downloadCanvas(canvas, 'angstloch-mine.png');
  }
});
render();
