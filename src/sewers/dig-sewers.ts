import type { Point } from '../core/point';
import { Tile } from '../core/tile';
import { buildInArea } from '../pipeline/build-in-area';
import type { MapStep } from '../pipeline/map-step';
import { placeAreas } from '../pipeline/place-areas';
import { step } from '../pipeline/step';
import { addFeatureRoom } from '../rooms/add-feature-room';
import type { FeatureRooms } from '../rooms/feature-rooms';
import { assertDigSewersOptions } from './assert-dig-sewers-options';
import { assertSewerArea } from './assert-sewer-area';
import type { DigSewersOptions } from './dig-sewers-options';
import { laySewer } from './lay-sewer';
import { planSewer } from './plan-sewer';
import type { SewerSettings } from './plan-sewer';

/**
 * A step that digs a sewer: a straight trunk canal along its area, with
 * straight branches off it, or off earlier branches, at right angles. Every
 * branch meets its parent in a junction chamber, and some end in a head
 * chamber. The canals are `ShallowWater`, with a walkway of `Floor` on each
 * side, and `Bridge` tiles carry the walkways over the water, so every walkway
 * tile reaches every other without wading. Every end of a canal, a mouth,
 * meets a wall. The sewer is closed in by a ring of wall inside its area, and
 * covers no tile that is not free.
 *
 * The walls beside the water are reserved `Solid`, so a corridor or a vein
 * never ends in a canal, only on a walkway, and so is the rock right behind
 * each mouth. Otherwise the sewer reserves nothing: it is a feature, which
 * `digCorridors` and `digVeins` join anywhere on its boundary.
 *
 * Up to two ends of the trunk reach the border of the map as outfalls, by
 * `outfalls`: the water stops one tile short, at a mouth in the border wall,
 * or with `pierceBorder` runs onto the border tile, and the walkway on one
 * side reaches the border, where the tile beyond it is reserved `Openable`,
 * for `openExits` with `at: 'outfalls'` to open. Every other end is a mouth
 * inside the map.
 *
 * With `cisterns`, some junctions and heads are cisterns instead: larger
 * chambers with a basin of `ShallowWater`, ledges of `Floor` along some of its
 * sides, on which the canals and the corridors come in, and maybe columns of
 * wall standing in the water.
 *
 * Every chamber is a room of kind `'sewerChamber'`, every cistern one of kind
 * `'cistern'` and every stretch of tunnel between them one of kind
 * `'sewerTunnel'`, walkways included, its box the rectangle of its tiles and
 * its shape all of them but the columns, which blocks nothing. Each
 * sewer adds a `'sewer'` group to `roomGroups`, with its canals and its
 * mouths and outfalls. It uses `rooms`, `roomShapes` and `roomGroups` from the steps before
 * it, and adds them again with its own appended, in the coordinates of the
 * map. A sewer whose trunk finds no room, or whose area does not reach the
 * border for `outfalls.min` outfalls, throws an ordinary `Error`, which
 * `pipeline` answers with a new map. The map has to start as wall, which
 * `pipeline` checks before the first attempt. Throws a `RangeError` at once
 * for a bad option.
 */
export function digSewers(
  options: DigSewersOptions = {},
): MapStep<Partial<FeatureRooms>, FeatureRooms> {
  assertDigSewersOptions(options);
  const { area = {}, count = { min: 1, max: 1 } } = options;
  const settings: SewerSettings = {
    orientation: options.orientation ?? 'any',
    trunkWidth: options.trunkWidth ?? { min: 2, max: 3 },
    branchWidth: options.branchWidth ?? { min: 1, max: 1 },
    branches: options.branches ?? { min: 3, max: 6 },
    branchLength: options.branchLength ?? { min: 5, max: 12 },
    chamberSize: options.chamberSize ?? { min: 5, max: 9 },
    headChance: options.headChance ?? 0.5,
    bridgeChance: options.bridgeChance ?? 0.25,
    outfalls: options.outfalls ?? { min: 1, max: 2 },
    pierceBorder: options.pierceBorder ?? false,
    cisterns: options.cisterns ?? { min: 0, max: 0 },
    cisternSize: options.cisternSize ?? { min: 7, max: 11 },
    cisternLedges: options.cisternLedges ?? { min: 1, max: 4 },
    columnChance: options.columnChance ?? 0.5,
    columnSpacing: options.columnSpacing ?? { min: 2, max: 3 },
  };

  return step<Partial<FeatureRooms>, FeatureRooms>(
    'digSewers',
    {
      adds: ['rooms', 'roomShapes', 'roomGroups'],
      validate: (state) => {
        assertSewerArea(state, area, count, settings.orientation);
      },
    },
    (state, { random }) => {
      const added: FeatureRooms = {
        rooms: [...(state.rooms ?? [])],
        roomShapes: [...(state.roomShapes ?? [])],
        roomGroups: [...(state.roomGroups ?? [])],
      };
      for (const box of placeAreas(state, random, area, count)) {
        const laid = buildInArea(state, box, (scratch) =>
          laySewer(
            scratch,
            random,
            planSewer(scratch, random, settings, {
              left: box.x === 0,
              top: box.y === 0,
              right: box.x + box.width === state.grid.width,
              bottom: box.y + box.height === state.grid.height,
            }),
            settings.bridgeChance,
            { chance: settings.columnChance, spacing: settings.columnSpacing },
          ),
        );
        // in the coordinates of the map
        const shift = <T extends Point>(local: T): T => ({
          ...local,
          x: local.x + box.x,
          y: local.y + box.y,
        });
        const group = added.roomGroups.length;
        added.roomGroups.push({
          kind: 'sewer',
          area: box,
          canals: laid.canals.map((canal) => ({
            ...canal,
            centerline: canal.centerline.map(shift),
          })),
          mouths: laid.mouths.map((mouth) => ({
            ...mouth,
            position: shift(mouth.position),
            ...(mouth.wall && { wall: shift(mouth.wall) }),
          })),
          outfalls: laid.outfalls.map((outfall) => ({
            ...outfall,
            position: shift(outfall.position),
          })),
        });
        for (const room of laid.rooms) {
          const floor = shift(room.box);
          const tiles: Point[] = [];
          for (let y = floor.y; y < floor.y + floor.height; ++y) {
            for (let x = floor.x; x < floor.x + floor.width; ++x) {
              // all but the columns of a cistern
              if (state.grid.get(x, y) !== Tile.Wall) {
                tiles.push({ x, y });
              }
            }
          }
          addFeatureRoom(added, room.kind, group, tiles, floor);
        }
      }
      return added;
    },
  );
}
