import { describe, expect, it } from 'vitest';
import { carveWindingTunnel } from './carve-winding-tunnel';
import { findCaveRegions } from './find-cave-regions';
import { Grid } from '../core/grid';
import { mulberry32 } from '../test-helpers/mulberry32';
import { Tile } from '../core/tile';

const OPTIONS = {
  style: 'winding',
  width: 1,
  windiness: 0.5,
  borderWalls: true,
} as const;

function twoSpots() {
  const grid = new Grid(21, 15);
  grid.set(3, 3, Tile.Floor);
  grid.set(17, 11, Tile.Floor);
  return grid;
}

describe('carveWindingTunnel', () => {
  it('joins the two positions', () => {
    // given
    const grid = twoSpots();

    // when
    carveWindingTunnel(
      grid,
      mulberry32(1),
      { x: 3, y: 3 },
      { x: 17, y: 11 },
      OPTIONS,
    );

    // then
    expect(findCaveRegions(grid)).toHaveLength(1);
  });

  it('wanders more than a direct tunnel when the windiness is high', () => {
    // given
    const wander = (windiness: number, seed: number) => {
      const grid = twoSpots();
      carveWindingTunnel(
        grid,
        mulberry32(seed),
        { x: 3, y: 3 },
        { x: 17, y: 11 },
        { ...OPTIONS, windiness },
      );
      return grid.toString().split('.').length - 1;
    };

    // when
    const straight = wander(0, 1);
    const wandering = wander(1, 1);

    // then
    expect(straight).toBe(14 + 8 + 1);
    expect(wandering).toBeGreaterThan(straight);
  });

  it('never touches the border with borderWalls', () => {
    // given
    const grid = twoSpots();

    // when
    carveWindingTunnel(
      grid,
      mulberry32(2),
      { x: 3, y: 3 },
      { x: 17, y: 11 },
      { ...OPTIONS, windiness: 1, width: 3 },
    );

    // then
    const rows = grid.toString().split('\n');
    expect(rows[0]).toBe('#'.repeat(21));
    expect(rows[14]).toBe('#'.repeat(21));
    expect(rows.every((row) => row.startsWith('#') && row.endsWith('#'))).toBe(
      true,
    );
  });

  it('finishes with a direct tunnel when the walk gets stuck', () => {
    // given
    const grid = twoSpots();
    const alwaysNorth = () => 0;

    // when
    carveWindingTunnel(
      grid,
      alwaysNorth,
      { x: 3, y: 3 },
      { x: 17, y: 11 },
      { ...OPTIONS, windiness: 1 },
    );

    // then
    expect(findCaveRegions(grid)).toHaveLength(1);
  });

  it('never steps onto a blocked tile', () => {
    // given
    const grid = twoSpots();
    const blocked = new Uint8Array(21 * 15);
    for (let y = 0; y < 12; ++y) {
      blocked[y * 21 + 10] = 1;
    }

    // when
    carveWindingTunnel(
      grid,
      mulberry32(2),
      { x: 3, y: 3 },
      { x: 17, y: 11 },
      { ...OPTIONS, width: 2, blocked },
    );

    // then
    expect(findCaveRegions(grid)).toHaveLength(1);
    for (let y = 0; y < 12; ++y) {
      expect(grid.get(10, y)).toBe(Tile.Wall);
    }
  });
});
