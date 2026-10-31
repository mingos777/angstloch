import type { Point } from '../core/point';
import { buildInArea } from '../pipeline/build-in-area';
import type { MapStep } from '../pipeline/map-step';
import { placeAreas } from '../pipeline/place-areas';
import { step } from '../pipeline/step';
import { isFeatureRoom } from '../rooms/is-feature-room';
import type { RoomShape } from '../rooms/room-shape';
import { TemplatePlacementError } from '../rooms/templates/template-placement-error';
import { assertCatacombArea } from './assert-catacomb-area';
import { assertDigCatacombsOptions } from './assert-dig-catacombs-options';
import { buildCatacomb } from './build-catacomb';
import type { CatacombSettings } from './catacomb-settings';
import type { DigCatacombsOptions } from './dig-catacombs-options';
import type { DugCatacombs } from './dug-catacombs';

/**
 * A step that digs one section of a catacomb: a lattice of straight galleries
 * of `Floor` that cross at right angles, with turns, junctions and loops. Its
 * rows and columns of side galleries are as many as fit, with rock between
 * them drawn from `spacing`, and some of them are wider main galleries, which
 * run the whole length of the lattice. The stretches of side gallery between
 * the crossings are kept to join every gallery, and the others by
 * `loopChance`; a dead end stays by `deadEndChance`. The catacomb is closed in
 * by a ring of wall inside its area, and covers no tile that is not free.
 *
 * Every straight stretch of gallery, a segment, gets a character drawn by the
 * weights of `segments`: `'niches'` lines its walls with burial niches, short
 * dead ends of `Floor` one tile wide, `'chambers'` with burial chambers, small
 * rooms behind a `Door` in the wall, facing each other in pairs, and `'bare'`
 * leaves them bare. A segment with no room for a chamber gets niches instead.
 * A dead end may be closed by a chamber, and a chamber's walls may be lined
 * with niches. When niches or chambers may be drawn, the galleries are spaced
 * wider to leave the rock they need.
 *
 * Crypts, the copies of `templates`, are placed in the area first, as the
 * room steps place them, and the galleries keep off them as they keep off
 * every tile that is not free, and off rooms placed before. The galleries
 * enter every crypt, and every room placed before in the area that has no
 * exit yet, by passages from their exits: every `Exit` and `Door` that leads
 * outside, or the `OptionalExit` with the shortest way, and more where they
 * join galleries that a room cut apart. Only the largest piece is dug.
 *
 * With a `symmetry`, the catacomb is mirrored about the middle of its area:
 * its galleries always, its niches and chambers by `symmetryChance`, rolled
 * for a segment and its twins, and with `templateSymmetry`, its crypts.
 *
 * The section is a feature, not a room: `digCorridors` and `digVeins` join
 * it anywhere on its boundary. The rock between its galleries and round its
 * niches is reserved `Solid`, and so is every chamber, so they never dig
 * through it, nor into a niche or a chamber.
 *
 * Every chamber is a room of kind `'burialChamber'` in `rooms`, with its shape
 * in `roomShapes`, its niches included, and its door in `roomExits`, so it has
 * an exit already and `digCorridors` leaves it alone. Every crypt is a room
 * of kind `'room'` with its `template`, its shape and the exits it was entered
 * by, and a room placed before gets its exits appended. The step adds a
 * `'catacomb'` group to `roomGroups`, which the chambers and the crypts point
 * to with `Room.group`, with the area it was dug in, the segments of its
 * galleries, its niches, its chambers and its crypts, in the coordinates of
 * the map. It uses `rooms`, `roomShapes`, `roomExits` and `roomGroups` from
 * the steps before it, and adds them again with its own appended, with ids
 * that follow on. A catacomb that finds no free room throws an ordinary
 * `Error`, and a crypt that cannot be placed or joined, or a fixed exit of a
 * room placed before that cannot be reached, a `TemplatePlacementError`,
 * which `pipeline` answers with a new map. The map has to start as wall,
 * which `pipeline` checks before the first attempt. Throws a `RangeError` at
 * once for a bad option or template.
 */
export function digCatacombs(
  options: DigCatacombsOptions = {},
): MapStep<Partial<DugCatacombs>, DugCatacombs> {
  assertDigCatacombsOptions(options);
  const { area = {} } = options;
  const settings: CatacombSettings = {
    mainGalleries: options.mainGalleries ?? { min: 1, max: 2 },
    mainWidth: options.mainWidth ?? { min: 2, max: 3 },
    sideWidth: options.sideWidth ?? { min: 1, max: 1 },
    spacing: options.spacing ?? { min: 1, max: 2 },
    loopChance: options.loopChance ?? 0.3,
    deadEndChance: options.deadEndChance ?? 0.1,
    segments: options.segments
      ? { niches: 0, chambers: 0, bare: 0, ...options.segments }
      : { niches: 3, chambers: 1, bare: 1 },
    nicheDepth: options.nicheDepth ?? { min: 1, max: 2 },
    nicheSpacing: options.nicheSpacing ?? { min: 1, max: 1 },
    nicheSides: options.nicheSides ?? { min: 1, max: 2 },
    chamberWidth: options.chamberSize?.width ?? { min: 3, max: 5 },
    chamberDepth: options.chamberSize?.depth ?? { min: 2, max: 3 },
    chamberSpacing: options.chamberSpacing ?? { min: 1, max: 2 },
    chamberSides: options.chamberSides ?? { min: 1, max: 2 },
    chamberNicheChance: options.chamberNicheChance ?? 0.5,
    deadEndChamberChance: options.deadEndChamberChance ?? 0.5,
    templates: options.templates ?? [],
    templateSymmetry: options.templateSymmetry ?? false,
    doorChance: options.doorChance ?? 1,
    symmetry: options.symmetry ?? 'none',
    symmetryChance: options.symmetryChance ?? 1,
  };

  return step<Partial<DugCatacombs>, DugCatacombs>(
    'digCatacombs',
    {
      adds: ['rooms', 'roomShapes', 'roomExits', 'roomGroups'],
      validate: (state) => {
        assertCatacombArea(state, area, settings);
      },
    },
    (state, { random }) => {
      const rooms = [...(state.rooms ?? [])];
      const roomShapes = [...(state.roomShapes ?? [])];
      const roomExits = [...(state.roomExits ?? [])];
      const roomGroups = [...(state.roomGroups ?? [])];
      for (const box of placeAreas(state, random, area, { min: 1, max: 1 })) {
        // in the coordinates of the map, and back
        const shift = <T extends Point>(local: T, by = 1): T => ({
          ...local,
          x: local.x + by * box.x,
          y: local.y + by * box.y,
        });
        const shiftShape = (shape: RoomShape, by = 1): RoomShape => ({
          ...shift(shape, by),
          doors: shape.doors.map((door) => shift(door, by)),
        });
        // the rooms placed before in the box, not opened yet
        const earlier = rooms.flatMap((room) => {
          const shape = roomShapes[room.id];
          const inBox =
            shape !== undefined &&
            shape.x >= box.x &&
            shape.y >= box.y &&
            shape.x + shape.width <= box.x + box.width &&
            shape.y + shape.height <= box.y + box.height;
          return inBox && room.exitCount === 0 && !isFeatureRoom(room)
            ? [{ room, shape: shiftShape(shape, -1) }]
            : [];
        });
        const built = buildInArea(state, box, (scratch) =>
          buildCatacomb(
            scratch,
            random,
            settings,
            earlier.map(({ room, shape }) => ({
              shape,
              must: false,
              fail: (problem: string): never => {
                throw new TemplatePlacementError(
                  room.template ?? 0,
                  undefined,
                  `room ${String(room.id)} ${problem}`,
                );
              },
            })),
          ),
        );
        const { segments, niches, chambers, shapes, crypts, entries } = built;
        const group = roomGroups.length;
        const firstChamber = rooms.length;
        chambers.forEach(({ floor, door }, index) => {
          const shape = shapes[index] as RoomShape;
          const id = rooms.length;
          rooms.push({
            id,
            kind: 'burialChamber',
            ...shift(floor),
            exits: [roomExits.length],
            exitCount: 1,
            doorCount: 1,
            group,
          });
          roomExits.push({ position: shift(door), rooms: [id], door: true });
          roomShapes.push(shiftShape(shape));
        });
        const firstCrypt = rooms.length;
        crypts.forEach(({ shape, template }, index) => {
          const own = entries.filter(({ room }) => room === index);
          const name = settings.templates[template]?.name;
          rooms.push({
            id: rooms.length,
            kind: 'room',
            ...shift({
              x: shape.x,
              y: shape.y,
              width: shape.width,
              height: shape.height,
            }),
            exits: own.map((_, at) => roomExits.length + at),
            exitCount: own.length,
            doorCount: own.filter(({ door }) => door).length,
            group,
            template,
            ...(name === undefined ? {} : { templateName: name }),
            rotation: shape.rotation,
            mirrored: shape.mirrored,
          });
          roomShapes.push(shiftShape(shape));
          for (const { wall, door } of own) {
            roomExits.push({
              position: shift(wall),
              rooms: [rooms.length - 1],
              door,
            });
          }
        });
        earlier.forEach(({ room }, index) => {
          const own = entries.filter(
            (entry) => entry.room === crypts.length + index,
          );
          if (own.length === 0) {
            return;
          }
          rooms[room.id] = {
            ...room,
            exits: [
              ...room.exits,
              ...own.map((_, at) => roomExits.length + at),
            ],
            exitCount: room.exitCount + own.length,
            doorCount: room.doorCount + own.filter(({ door }) => door).length,
          };
          for (const { wall, door } of own) {
            roomExits.push({ position: shift(wall), rooms: [room.id], door });
          }
        });
        roomGroups.push({
          kind: 'catacomb',
          area: box,
          segments: segments.map((segment) => ({
            ...segment,
            floor: shift(segment.floor),
          })),
          niches: niches.map((niche) => ({
            ...niche,
            tiles: niche.tiles.map((tile) => shift(tile)),
          })),
          chambers: chambers.map(({ segment, side, deadEnd }, index) => ({
            room: firstChamber + index,
            segment,
            side,
            deadEnd,
          })),
          crypts: crypts.map((_, index) => firstCrypt + index),
        });
      }
      return { rooms, roomShapes, roomExits, roomGroups };
    },
  );
}
