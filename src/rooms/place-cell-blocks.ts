import type { Area } from '../core/area';
import type { Point } from '../core/point';
import { randomInt } from '../core/random-int';
import { assertAreaSize } from '../pipeline/assert-area-size';
import { assertWallBase } from '../pipeline/assert-wall-base';
import { buildInArea } from '../pipeline/build-in-area';
import type { MapStep } from '../pipeline/map-step';
import { placeAreas } from '../pipeline/place-areas';
import { step } from '../pipeline/step';
import { assertPlaceCellBlocksOptions } from './assert-place-cell-blocks-options';
import { layCellBlock } from './lay-cell-block';
import type { CellBlockSettings } from './lay-cell-block';
import type { PlaceCellBlocksOptions } from './place-cell-blocks-options';
import type { PlacedCellBlocks } from './placed-cell-blocks';
import type { RoomKind } from './room-kind';
import type { RoomShape } from './room-shape';
import { findTemplateExits } from './templates/find-template-exits';
import { TemplateCell } from './templates/template-cell';

/**
 * A step that places the cell blocks of a prison: identical cells that share
 * their walls, along a straight corridor, on one or both sides. Each cell has
 * one door onto the corridor, always `Tile.Door`. The whole block is reserved
 * `Solid` but for its entrance, a wall at one end of the corridor that is
 * `Openable`, so it is entered there and nowhere else. `digCorridors` joins
 * the corridor as a stand-in through the entrance, and `digVeins` enters the
 * block there too.
 *
 * With `guardRoom`, a block gets a guard room by its chance. Beside the block,
 * it stands by a tunnel that runs from the end of the corridor past the guard
 * room's door. The wall between the corridor and the tunnel becomes a door,
 * and the entrance is the wall at the far end of the tunnel instead. With the
 * placement `'through'`, it stands against the end of the block, its door in
 * the end wall, and the entrance is in its far wall, a potential exit of its
 * shape: `digCorridors` joins the block, its cells and the guard room as one.
 *
 * Every cell is a room of kind `'cell'` in `rooms`, and a guard room one of
 * kind `'guardRoom'`, each with its shape in `roomShapes` and its door in
 * `roomExits`, so it has an exit already and `digCorridors` leaves it alone.
 * Each block adds a `'cellBlock'` group to `roomGroups`, which its cells and
 * its guard room point to with `Room.group`. It appends all four to the ones
 * of the steps before it, with ids that follow on. A block
 * that finds no free spot throws an ordinary `Error`, which `pipeline` answers
 * with a new map. With `placement: 'lattice'` the block's walls fall on even
 * coordinates and its floors on odd ones, entrance included, so that lattice
 * corridors reach it. The map has to start as wall, which `pipeline` checks before
 * the first attempt. Throws a `RangeError` at once for a bad option.
 */
export function placeCellBlocks(
  options: PlaceCellBlocksOptions = {},
): MapStep<Partial<PlacedCellBlocks>, PlacedCellBlocks> {
  assertPlaceCellBlocksOptions(options);
  const {
    blocks = { min: 1, max: 1 },
    area = {},
    count = { min: 1, max: 1 },
    placement = 'free',
  } = options;
  const settings: CellBlockSettings = {
    cellWidth: options.cellSize?.width ?? { min: 3, max: 3 },
    cellDepth: options.cellSize?.depth ?? { min: 3, max: 3 },
    cellsPerSide: options.cellsPerSide ?? { min: 4, max: 6 },
    sides: options.sides ?? { min: 2, max: 2 },
    corridorWidth: options.corridorWidth ?? { min: 1, max: 1 },
    orientation: options.orientation ?? 'any',
    cellDoors: options.cellDoors ?? 'centered',
    placement,
    ...(options.guardRoom && {
      guardRoom: {
        chance: options.guardRoom.chance ?? 1,
        placement: options.guardRoom.placement ?? 'beside',
        width: options.guardRoom.size?.width ?? { min: 5, max: 5 },
        depth: options.guardRoom.size?.depth ?? { min: 3, max: 3 },
        tunnel: options.guardRoom.tunnel ?? { min: 2, max: 4 },
      },
    }),
  };

  return step<Partial<PlacedCellBlocks>, PlacedCellBlocks>(
    'placeCellBlocks',
    {
      adds: ['rooms', 'roomShapes', 'roomExits', 'roomGroups'],
      validate: (state) => {
        assertWallBase('placeCellBlocks', state);
        assertAreaSize(area, count, state.grid.width, state.grid.height);
      },
    },
    (state, { random }) => {
      const rooms = [...(state.rooms ?? [])];
      const roomShapes = [...(state.roomShapes ?? [])];
      const roomExits = [...(state.roomExits ?? [])];
      const roomGroups = [...(state.roomGroups ?? [])];
      for (const box of placeAreas(state, random, area, count, {
        lattice: placement === 'lattice',
      })) {
        const laid = buildInArea(state, box, (scratch) =>
          Array.from(
            { length: randomInt(random, blocks.min, blocks.max) },
            () => layCellBlock(scratch, random, settings),
          ),
        );
        // in the coordinates of the map
        const shift = <T extends Point>(local: T): T => ({
          ...local,
          x: local.x + box.x,
          y: local.y + box.y,
        });
        for (const block of laid) {
          const group = roomGroups.length;
          roomGroups.push({
            kind: 'cellBlock',
            footprint: shift(block.footprint),
            corridor: shift(block.corridor),
            entrance: shift(block.entrance),
            ...(block.tunnel && { tunnel: shift(block.tunnel) }),
          });
          const add = (
            kind: RoomKind,
            local: Area,
            localDoor: Point,
            entrance?: Point,
          ) => {
            const floor = shift(local);
            const door = shift(localDoor);
            const id = rooms.length;
            rooms.push({
              id,
              kind,
              ...floor,
              exits: [roomExits.length],
              exitCount: 1,
              doorCount: 1,
              group,
            });
            roomExits.push({ position: door, rooms: [id], door: true });
            roomShapes.push(
              oneDoorShape(floor, door, entrance && shift(entrance)),
            );
          };
          block.cells.forEach((cell, index) => {
            add('cell', cell, block.doors[index] as Point);
          });
          if (block.guardRoom) {
            // without a tunnel the block is entered through the guard room
            add(
              'guardRoom',
              block.guardRoom.floor,
              block.guardRoom.door,
              block.tunnel ? undefined : block.entrance,
            );
          }
        }
      }
      return { rooms, roomShapes, roomExits, roomGroups };
    },
  );
}

/** The shape of a cell or a guard room: its floor inside a ring of wall, with its door in the ring, and the entrance of the block as a potential exit for a guard room it is entered through. */
function oneDoorShape(floor: Area, door: Point, entrance?: Point): RoomShape {
  const [x, y] = [floor.x - 1, floor.y - 1];
  const cells = Array.from({ length: floor.height + 2 }, (_, dy) =>
    Array.from({ length: floor.width + 2 }, (__, dx): TemplateCell => {
      if (x + dx === door.x && y + dy === door.y) {
        return TemplateCell.Door;
      }
      if (x + dx === entrance?.x && y + dy === entrance.y) {
        return TemplateCell.OptionalExit;
      }
      const inside =
        dx > 0 && dy > 0 && dx <= floor.width && dy <= floor.height;
      return inside ? TemplateCell.Floor : TemplateCell.Wall;
    }),
  );
  return {
    x,
    y,
    width: floor.width + 2,
    height: floor.height + 2,
    cells,
    exits: findTemplateExits(cells),
    rotation: 0,
    mirrored: false,
    doors: [{ ...door, door: true }],
  };
}
