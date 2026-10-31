import { describe, expect, it } from 'vitest';
import { Tile } from '../core/tile';
import { emptyMap } from '../pipeline/empty-map';
import { mulberry32 } from '../test-helpers/mulberry32';
import { planSewer } from './plan-sewer';
import type { SewerBorders, SewerSettings } from './plan-sewer';

const SETTINGS: SewerSettings = {
  orientation: 'any',
  trunkWidth: { min: 2, max: 2 },
  branchWidth: { min: 1, max: 1 },
  branches: { min: 0, max: 0 },
  branchLength: { min: 5, max: 12 },
  chamberSize: { min: 5, max: 9 },
  headChance: 0.5,
  bridgeChance: 0.25,
  outfalls: { min: 0, max: 2 },
  pierceBorder: false,
  cisterns: { min: 0, max: 0 },
  cisternSize: { min: 7, max: 11 },
  cisternLedges: { min: 1, max: 4 },
  columnChance: 0.5,
  columnSpacing: { min: 2, max: 3 },
};

const NONE: SewerBorders = {
  left: false,
  top: false,
  right: false,
  bottom: false,
};

/** Plans a sewer on a wall map of 40 by 24. */
function plan(
  settings: Partial<SewerSettings>,
  borders: SewerBorders,
  seed = 1,
) {
  const state = emptyMap({ width: 40, height: 24, tile: Tile.Wall })();
  return planSewer(
    state,
    mulberry32(seed),
    { ...SETTINGS, ...settings },
    borders,
  );
}

describe('planSewer', () => {
  it('runs the trunk to the one border its area reaches, with one outfall even when two are drawn', () => {
    // given
    const borders = { ...NONE, left: true };

    // when
    const trunks = Array.from({ length: 10 }, (_, i) =>
      plan({ outfalls: { min: 1, max: 2 } }, borders, i + 1),
    ).map(([trunk]) => trunk);

    // then
    for (const trunk of trunks) {
      expect(trunk?.horizontal).toBe(true);
      expect(trunk?.outfalls?.map(({ end }) => end)).toEqual([-1]);
      expect(trunk?.tunnel.min).toBe(1);
    }
  });

  it('makes no outfall where its area reaches no border', () => {
    // given
    const borders = NONE;

    // when
    const [trunk] = plan({ outfalls: { min: 0, max: 2 } }, borders);

    // then
    expect(trunk?.outfalls).toEqual([]);
  });

  it('throws when fewer outfalls fit than the least asked for', () => {
    // given
    const borders = { ...NONE, top: true };

    // when
    const run = () => plan({ outfalls: { min: 2, max: 2 } }, borders);

    // then
    expect(run).toThrow(/outfall/);
  });
});
