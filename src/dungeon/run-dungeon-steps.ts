import type { BaseOptions } from '../core/base-options';
import { Tile } from '../core/tile';
import { emptyMap } from '../pipeline/empty-map';
import { pipeline } from '../pipeline/pipeline';
import type { AnyStep } from '../pipeline/pipeline-chain';
import type { RoomShape } from '../rooms/room-shape';
import { TemplateCell } from '../rooms/templates/template-cell';
import type { JoinedRooms } from './join-rooms';
import type { RoomDungeonResult } from './room-dungeon-result';

/**
 * Runs the steps of a dungeon preset, which place rooms and then join them
 * with `carveCorridors`, on a map of rock, and reports what they built.
 */
export function runDungeonSteps(
  options: BaseOptions,
  steps: AnyStep[],
): RoomDungeonResult {
  const { width, height, random } = options;
  const run = pipeline(emptyMap({ width, height, tile: Tile.Wall }), steps, {
    random,
  });
  // every step always runs, so their extras are there
  const { rooms, roomShapes, roomExits }: JoinedRooms =
    run as unknown as JoinedRooms;
  return {
    grid: run.grid,
    rooms,
    exits: roomExits,
    fill: floorOf(roomShapes, width) / (width * height),
    attempts: run.attempts,
    failures: run.failures,
  };
}

/** The tiles of floor in the shapes, doorways of templates included, each counted once. */
function floorOf(shapes: RoomShape[], width: number): number {
  const floor = new Set<number>();
  for (const { x, y, cells } of shapes) {
    cells.forEach((row, dy) => {
      row.forEach((cell, dx) => {
        if (
          cell === TemplateCell.Floor ||
          cell === TemplateCell.Exit ||
          cell === TemplateCell.Door
        ) {
          floor.add((y + dy) * width + x + dx);
        }
      });
    });
  }
  return floor.size;
}
