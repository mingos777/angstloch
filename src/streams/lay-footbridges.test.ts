import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../test-helpers/mulberry32';
import { findBridges } from './find-bridges';
import { layFootbridges } from './lay-footbridges';
import { layStreams } from './lay-streams';
import type { StreamOptions } from './stream-options';

const WIDTH = 100;
const HEIGHT = 70;
const LEVEL: StreamOptions = {
  angle: 0,
  windiness: 0,
  width: { min: 3, max: 3 },
};

function lay(options: StreamOptions, seed = 1) {
  return layStreams(WIDTH, HEIGHT, mulberry32(seed), options);
}

/** A column of road tiles from the top of the map to the bottom. */
function roadAt(x: number): Uint8Array {
  const road = new Uint8Array(WIDTH * HEIGHT);
  for (let y = 0; y < HEIGHT; ++y) {
    road[y * WIDTH + x] = 1;
  }
  return road;
}

/** The number of pieces of walkable land: the tiles that are not water, or are road or footbridge. */
function pieces(water: Uint8Array, ...crossings: (Uint8Array | undefined)[]) {
  const land = (at: number) =>
    water[at] !== 1 || crossings.some((crossing) => crossing?.[at] === 1);
  const seen = new Uint8Array(water.length);
  let count = 0;
  for (let start = 0; start < water.length; ++start) {
    if (seen[start] || !land(start)) {
      continue;
    }
    ++count;
    const stack = [start];
    seen[start] = 1;
    for (let at = stack.pop(); at !== undefined; at = stack.pop()) {
      const x = at % WIDTH;
      const y = Math.floor(at / WIDTH);
      for (const [nx, ny] of [
        [x - 1, y],
        [x + 1, y],
        [x, y - 1],
        [x, y + 1],
      ] as const) {
        const next = ny * WIDTH + nx;
        if (
          nx >= 0 &&
          ny >= 0 &&
          nx < WIDTH &&
          ny < HEIGHT &&
          !seen[next] &&
          land(next)
        ) {
          seen[next] = 1;
          stack.push(next);
        }
      }
    }
  }
  return count;
}

const total = (tiles: Uint8Array) => tiles.reduce((sum, tile) => sum + tile, 0);

describe('layFootbridges', () => {
  it('lays a footbridge across a stream that cuts the land in two', () => {
    // given
    const streams = lay(LEVEL);

    // when
    const foot = layFootbridges(streams, undefined, mulberry32(2), 0);

    // then: a column of three tiles across the three tiles of water
    expect(total(foot)).toBe(3);
    const tiles = [...foot.keys()].filter((at) => foot[at]);
    expect(new Set(tiles.map((at) => at % WIDTH)).size).toBe(1);
  });

  it('leaves the land in one piece', () => {
    // given
    const streams = lay(LEVEL);
    expect(pieces(streams.water)).toBe(2);

    // when
    const foot = layFootbridges(streams, undefined, mulberry32(2), 0);

    // then
    expect(pieces(streams.water, foot)).toBe(1);
  });

  it('lays none where a road already crosses the stream', () => {
    // given
    const streams = lay(LEVEL);
    const road = roadAt(30);

    // when
    const foot = layFootbridges(streams, road, mulberry32(2), 0);

    // then
    expect(total(foot)).toBe(0);
  });

  it('joins every piece of land that the tributaries cut off', () => {
    // given
    const streams = lay({ ...LEVEL, tributaries: { min: 2, max: 2 } }, 5);
    expect(pieces(streams.water)).toBeGreaterThan(2);

    // when
    const foot = layFootbridges(streams, undefined, mulberry32(2), 0);

    // then
    expect(pieces(streams.water, foot)).toBe(1);
  });

  it('lays none across a stream that has a spring, since the land goes round it', () => {
    // given
    const streams = lay({ ...LEVEL, spring: true });

    // when
    const foot = layFootbridges(streams, undefined, mulberry32(2), 0);

    // then
    expect(pieces(streams.water)).toBe(1);
    expect(total(foot)).toBe(0);
  });

  it('adds footbridges until the map has the bridges asked for', () => {
    // given
    const streams = lay(LEVEL);

    // when
    const foot = layFootbridges(streams, undefined, mulberry32(2), 3);

    // then
    expect(findBridges(streams.water, foot, WIDTH, HEIGHT)).toHaveLength(3);
  });

  it('counts the bridges of the roads towards the minimum', () => {
    // given
    const streams = lay(LEVEL);
    const first = roadAt(20);
    const roads = Uint8Array.from(
      first,
      (tile, at) => tile | (roadAt(70)[at] ?? 0),
    );

    // when
    const foot = layFootbridges(streams, roads, mulberry32(2), 2);

    // then
    expect(total(foot)).toBe(0);
  });

  it('keeps the footbridges apart', () => {
    // given
    const streams = lay(LEVEL);

    // when
    const foot = layFootbridges(streams, undefined, mulberry32(2), 4);

    // then
    const bridges = findBridges(streams.water, foot, WIDTH, HEIGHT);
    for (const a of bridges) {
      for (const b of bridges) {
        if (a !== b) {
          expect(
            Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y)),
          ).toBeGreaterThanOrEqual(8);
        }
      }
    }
  });

  it('lays fewer than the minimum when there is no room', () => {
    // given
    const streams = lay(LEVEL);

    // when
    const foot = layFootbridges(streams, undefined, mulberry32(2), 50);

    // then
    expect(findBridges(streams.water, foot, WIDTH, HEIGHT).length).toBeLessThan(
      50,
    );
  });

  it('goes across a stream where tributaries join it, never along it', () => {
    // given
    const streams = lay({ ...LEVEL, tributaries: { min: 3, max: 3 } }, 5);

    // when
    const foot = layFootbridges(streams, undefined, mulberry32(2), 6);

    // then: no bridge is longer than the stream is wide, with a tile to spare
    const bridges = findBridges(streams.water, foot, WIDTH, HEIGHT);
    expect(total(foot)).toBeLessThanOrEqual(bridges.length * 5);
  });

  it('never lays a footbridge on the edge of the map', () => {
    // given
    const seeds = Array.from({ length: 40 }, (_, seed) => seed + 1);

    // when
    const edges = seeds.flatMap((seed) => {
      const streams = lay(
        {
          angle: 'random',
          width: { min: 1, max: 3 },
          tributaries: { min: 2, max: 3 },
        },
        seed,
      );
      const foot = layFootbridges(streams, undefined, mulberry32(seed), 3);
      return Array.from(foot, (tile, at) => [tile, at] as const).filter(
        ([tile, at]) => {
          const x = at % WIDTH;
          const y = Math.floor(at / WIDTH);
          return (
            tile === 1 &&
            (x === 0 || y === 0 || x === WIDTH - 1 || y === HEIGHT - 1)
          );
        },
      );
    });

    // then
    expect(edges).toEqual([]);
  });
});
