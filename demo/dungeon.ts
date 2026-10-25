import { generateDigDungeon, generateRoomDungeon } from '../src';
import type {
  CorridorSymmetry,
  LayoutSymmetry,
  Placement,
  RoomPartition,
} from '../src';
import { mulberry32 } from '../src/test-helpers/mulberry32';
import { drawGrid } from './draw-grid';

const form = document.querySelector<HTMLFormElement>('#controls');
const canvas = document.querySelector<HTMLCanvasElement>('#map');
const error = document.querySelector<HTMLElement>('#error');
const stats = document.querySelector<HTMLElement>('#stats');
const context = canvas?.getContext('2d');

function render(): void {
  if (!form || !canvas || !error || !stats || !context) {
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
    stats.textContent = `${String(rooms.length)} rooms, ${String(exits.length)} exits (${String(doors)} with doors), fill ${fill.toFixed(3)}`;
    drawGrid(canvas, context, grid, tileSize);
    if (data.get('showExits')) {
      // open exits, which have no door, are marked with a dot
      context.fillStyle = '#4a7fc8';
      for (const { position, door } of exits) {
        if (!door) {
          context.fillRect(
            position.x * tileSize + tileSize / 4,
            position.y * tileSize + tileSize / 4,
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

form?.addEventListener('input', render);
render();
