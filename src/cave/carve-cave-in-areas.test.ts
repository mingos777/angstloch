import { describe, expect, it } from 'vitest';
import { Grid } from '../core/grid';
import { Tile } from '../core/tile';
import { emptyMap } from '../pipeline/empty-map';
import { Reserve } from '../pipeline/reserve';
import type { AreaSpec } from '../pipeline/area-spec';
import type { RoomGroup } from '../rooms/room-group';
import { mulberry32 } from '../test-helpers/mulberry32';
import { carveCaveInAreas } from './carve-cave-in-areas';
import type { CaveAreaSettings } from './carve-cave-in-areas';

const SEEDS = 20;
const SIX = { width: { min: 6, max: 6 }, height: { min: 6, max: 6 } };

/** A map of 30 by 10 tiles of wall, with floor on its 15 left columns. */
function halfDug() {
  const state = emptyMap({ width: 30, height: 10, tile: Tile.Wall })();
  for (let y = 0; y < 10; ++y) {
    for (let x = 0; x < 15; ++x) {
      state.grid.set(x, y, Tile.Floor);
    }
  }
  return state;
}

/** Where the box of the first cave starts across, if there is one. */
function caveX(groups: readonly RoomGroup[]): number | undefined {
  const [group] = groups;
  return group?.kind === 'cave' ? group.area.x : undefined;
}

/** A cave the size of the box: a ring of wall round a block of floor. */
function block({ width, height }: { width: number; height: number }): Grid {
  const grid = new Grid(width, height);
  for (let y = 1; y < height - 1; ++y) {
    for (let x = 1; x < width - 1; ++x) {
      grid.set(x, y, Tile.Floor);
    }
  }
  return grid;
}

function settings(
  overlapShare: { min: number; max: number },
  area: AreaSpec = SIX,
  count = { min: 1, max: 1 },
): CaveAreaSettings {
  return {
    area,
    count,
    minRegionSize: 0,
    largestOnly: false,
    placement: 'overlap',
    overlapShare,
  };
}

describe('carveCaveInAreas', () => {
  describe("with placement 'overlap'", () => {
    it('puts the cave where none of its floor lands on what is there with a share of 0', () => {
      // given
      const states = Array.from({ length: SEEDS }, halfDug);

      // when
      const groups = states.map(
        (state, seed) =>
          carveCaveInAreas(
            state,
            mulberry32(seed),
            settings({ min: 0, max: 0 }),
            block,
          ).roomGroups,
      );

      // then
      for (const found of groups) {
        expect(caveX(found)).toBeGreaterThanOrEqual(14);
      }
    });

    it('puts the cave where the share of its floor on what is there fits', () => {
      // given
      const states = Array.from({ length: SEEDS }, halfDug);

      // when
      const groups = states.map(
        (state, seed) =>
          carveCaveInAreas(
            state,
            mulberry32(seed),
            settings({ min: 0.25, max: 0.75 }),
            block,
          ).roomGroups,
      );

      // then
      for (const found of groups) {
        expect(caveX(found)).toBeGreaterThanOrEqual(11);
        expect(caveX(found)).toBeLessThanOrEqual(13);
      }
    });

    it('counts reserved tiles toward the share', () => {
      // given
      const states = Array.from({ length: SEEDS }, () => {
        const state = emptyMap({ width: 30, height: 10, tile: Tile.Wall })();
        for (let y = 0; y < 10; ++y) {
          state.reserved.fill(Reserve.Solid, y * 30, y * 30 + 15);
        }
        return state;
      });

      // when
      const groups = states.map(
        (state, seed) =>
          carveCaveInAreas(
            state,
            mulberry32(seed),
            settings({ min: 0.25, max: 0.75 }),
            block,
          ).roomGroups,
      );

      // then
      for (const found of groups) {
        expect(caveX(found)).toBeGreaterThanOrEqual(11);
        expect(caveX(found)).toBeLessThanOrEqual(13);
      }
    });

    it('stops a gravity slide where the share leaves the range', () => {
      // given
      const states = Array.from({ length: SEEDS }, halfDug);
      const area = {
        ...SIX,
        gravity: { toward: 'left' as const, strength: 1 },
      };

      // when
      const groups = states.map(
        (state, seed) =>
          carveCaveInAreas(
            state,
            mulberry32(seed),
            settings({ min: 0, max: 0 }, area),
            block,
          ).roomGroups,
      );

      // then
      for (const found of groups) {
        expect(caveX(found)).toBe(14);
      }
    });

    it('fails the attempt when a cave it needs finds no spot where the share fits', () => {
      // given
      const state = halfDug();

      // when
      const run = () =>
        carveCaveInAreas(
          state,
          mulberry32(1),
          settings({ min: 0.9, max: 1 }, { width: { min: 20, max: 20 } }),
          block,
        );

      // then
      expect(run).toThrow(/No spot for a cave.*overlapShare.*count\.min/);
      expect(run).not.toThrow(RangeError);
    });

    it('leaves out a cave above count.min that finds no spot where the share fits', () => {
      // given
      const state = halfDug();

      // when
      const { roomGroups } = carveCaveInAreas(
        state,
        mulberry32(1),
        settings(
          { min: 0.9, max: 1 },
          { width: { min: 20, max: 20 } },
          { min: 0, max: 2 },
        ),
        block,
      );

      // then
      expect(roomGroups).toEqual([]);
    });

    it('measures the share of a cave as big as the map at its only spot', () => {
      // given
      const state = halfDug();

      // when
      const run = () =>
        carveCaveInAreas(
          state,
          mulberry32(1),
          settings({ min: 0, max: 0.4 }, {}),
          block,
        );

      // then
      expect(run).toThrow(/No spot for a cave of 30 by 10/);
    });

    it('lays a cave as big as the map over it when the share fits', () => {
      // given
      const state = halfDug();

      // when
      const { roomGroups } = carveCaveInAreas(
        state,
        mulberry32(1),
        settings({ min: 0.4, max: 0.6 }, {}),
        block,
      );

      // then
      expect(roomGroups).toEqual([
        { kind: 'cave', area: { x: 0, y: 0, width: 30, height: 10 } },
      ]);
    });

    it('puts the cave on any spot with a share from 0 to 1', () => {
      // given
      const state = emptyMap({ width: 30, height: 10, tile: Tile.Wall })();
      state.reserved.fill(Reserve.Solid);

      // when
      const { roomGroups } = carveCaveInAreas(
        state,
        mulberry32(1),
        settings({ min: 0, max: 1 }),
        block,
      );

      // then
      expect(roomGroups).toEqual([]);
      expect(state.grid.toString()).not.toContain('.');
    });

    it('leaves out a cave with no floor', () => {
      // given
      const state = halfDug();

      // when
      const { roomGroups } = carveCaveInAreas(
        state,
        mulberry32(1),
        settings({ min: 0, max: 0 }),
        ({ width, height }) => new Grid(width, height),
      );

      // then
      expect(roomGroups).toEqual([]);
    });

    it('makes the cave once and samples it at a spot of the map', () => {
      // given
      const state = halfDug();
      const made: { width: number; height: number }[] = [];

      // when
      carveCaveInAreas(
        state,
        mulberry32(1),
        settings({ min: 0, max: 0 }),
        (box) => {
          made.push(box);
          return block(box);
        },
      );

      // then
      expect(made).toHaveLength(1);
      for (const { width, height } of made) {
        expect({ width, height }).toEqual({ width: 6, height: 6 });
      }
    });
  });
});
