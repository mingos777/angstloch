import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../test-helpers/mulberry32';
import type { CatacombSettings } from './catacomb-settings';
import type { GalleryLine } from './lattice';
import { planLattice } from './plan-lattice';

const SEEDS = Array.from({ length: 20 }, (_, i) => i + 1);

const SETTINGS: CatacombSettings = {
  mainGalleries: { min: 1, max: 2 },
  mainWidth: { min: 2, max: 3 },
  sideWidth: { min: 1, max: 1 },
  spacing: { min: 3, max: 5 },
  loopChance: 0.3,
  deadEndChance: 0.1,
  segments: { niches: 0, chambers: 0, bare: 1 },
  nicheDepth: { min: 1, max: 2 },
  nicheSpacing: { min: 1, max: 1 },
  nicheSides: { min: 1, max: 2 },
  chamberWidth: { min: 3, max: 5 },
  chamberDepth: { min: 2, max: 3 },
  chamberSpacing: { min: 1, max: 2 },
  chamberSides: { min: 1, max: 2 },
  chamberNicheChance: 0.5,
  deadEndChamberChance: 0.5,
  templates: [],
  templateSymmetry: false,
  doorChance: 1,
  symmetry: 'none',
  symmetryChance: 1,
};

/** The rock between each two lines next to each other. */
const gapsOf = (lines: readonly GalleryLine[]) =>
  lines
    .slice(1)
    .map(
      (line, index) =>
        line.start -
        (lines[index] as GalleryLine).start -
        (lines[index] as GalleryLine).width,
    );

describe('planLattice', () => {
  it('lays at least two galleries each way inside the box', () => {
    // given
    const box = { x: 1, y: 1, width: 40, height: 20 };

    // when
    const lattices = SEEDS.map((seed) =>
      planLattice(mulberry32(seed), box, SETTINGS),
    );

    // then
    for (const { columns, rows } of lattices) {
      for (const [lines, from, length] of [
        [columns, box.x, box.width],
        [rows, box.y, box.height],
      ] as const) {
        expect(lines.length).toBeGreaterThanOrEqual(2);
        expect(lines[0]?.start).toBeGreaterThanOrEqual(from);
        const last = lines[lines.length - 1] as GalleryLine;
        expect(last.start + last.width).toBeLessThanOrEqual(from + length);
      }
    }
  });

  it('keeps the rock between galleries within the spacing', () => {
    // given
    const settings = { ...SETTINGS, mainGalleries: { min: 0, max: 0 } };

    // when
    const lattices = SEEDS.map((seed) =>
      planLattice(
        mulberry32(seed),
        { x: 0, y: 0, width: 50, height: 30 },
        settings,
      ),
    );

    // then
    for (const { columns, rows } of lattices) {
      for (const gap of [...gapsOf(columns), ...gapsOf(rows)]) {
        expect(gap).toBeGreaterThanOrEqual(3);
        expect(gap).toBeLessThanOrEqual(5);
      }
    }
  });

  it('cuts a main gallery down to the room the box has', () => {
    // given
    const settings = {
      ...SETTINGS,
      mainGalleries: { min: 4, max: 4 },
      mainWidth: { min: 9, max: 9 },
      spacing: { min: 2, max: 2 },
    };

    // when
    const lattice = planLattice(
      mulberry32(1),
      { x: 0, y: 0, width: 4, height: 4 },
      settings,
    );

    // then
    for (const lines of [lattice.columns, lattice.rows]) {
      expect(lines.every(({ main }) => main)).toBe(true);
      expect(lines.map(({ width }) => width)).toEqual([1, 1]);
      expect(gapsOf(lines)).toEqual([2]);
    }
  });

  it('mirrors the galleries of a mirrored axis about the middle of the box, main ones in pairs', () => {
    // given
    const box = { x: 1, y: 1, width: 40, height: 21 };

    // when
    const lattices = SEEDS.map((seed) =>
      planLattice(mulberry32(seed), box, SETTINGS, {
        columns: true,
        rows: true,
      }),
    );

    // then
    for (const { columns, rows } of lattices) {
      for (const [lines, from, length] of [
        [columns, box.x, box.width],
        [rows, box.y, box.height],
      ] as const) {
        const mirrored = lines
          .map(({ start, width, main }) => ({
            start: 2 * from + length - start - width,
            width,
            main,
          }))
          .reverse();
        expect(mirrored).toEqual(lines);
      }
    }
  });

  it('fits as many galleries on a mirrored axis as on a plain one', () => {
    // given
    const box = { x: 1, y: 1, width: 40, height: 30 };
    const settings = {
      ...SETTINGS,
      mainGalleries: { min: 0, max: 0 },
      spacing: { min: 3, max: 3 },
    };

    // when
    const [plain, mirrored] = [false, true].map((mirror) =>
      planLattice(mulberry32(1), box, settings, {
        columns: mirror,
        rows: mirror,
      }),
    );

    // then
    expect(mirrored?.columns.length).toBe(plain?.columns.length);
    expect(mirrored?.rows.length).toBe(plain?.rows.length);
  });
});
