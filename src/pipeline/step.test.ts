import { describe, expect, it } from 'vitest';
import { Tile } from '../core/tile';
import { mulberry32 } from '../test-helpers/mulberry32';
import { emptyMap } from './empty-map';
import { step } from './step';

const draw = step('draw', {}, (state, { random }) => {
  state.grid.set(0, 0, random() < 2 ? Tile.Floor : Tile.Wall);
  return {};
});

const countRoads = step<{ roads: number[] }, { count: number }>(
  'countRoads',
  { needs: ['roads'], adds: ['count'] },
  (state) => ({ count: state.roads.length }),
);

describe('step', () => {
  it('carries its name and the extras it declares', () => {
    // given
    const declared = countRoads;

    // when
    const { stepName, needs, adds } = declared;

    // then
    expect(stepName).toBe('countRoads');
    expect(needs).toEqual(['roads']);
    expect(adds).toEqual(['count']);
  });

  it('carries the validate function it declares', () => {
    // given
    const validate = () => undefined;
    const checked = step('checked', { validate }, () => ({}));

    // when
    const declared = checked.validate;

    // then
    expect(declared).toBe(validate);
  });

  it('can be called by hand without a context', () => {
    // given
    const state = emptyMap({ width: 2, height: 2, tile: Tile.Wall })();

    // when
    draw(state);

    // then
    expect(state.grid.get(0, 0)).toBe(Tile.Floor);
  });

  it('passes the random source of the context it is given', () => {
    // given
    const state = emptyMap({ width: 2, height: 2, tile: Tile.Wall })();
    const seen: number[] = [];
    const record = step('record', {}, (_state, { random }) => {
      seen.push(random());
      return {};
    });
    const expected = mulberry32(5)();

    // when
    record(state, { random: mulberry32(5) });

    // then
    expect(seen).toEqual([expected]);
  });

  it('passes the trace callback of the context on', () => {
    // given
    const state = emptyMap({ width: 2, height: 2, tile: Tile.Wall })();
    const traced: unknown[] = [];
    const tracing = step('tracing', {}, (_state, { trace }) => {
      trace?.('tracing', 42);
      return {};
    });

    // when
    tracing(state, { trace: (_name, data) => traced.push(data) });

    // then
    expect(traced).toEqual([42]);
  });

  it('returns the extras of the function', () => {
    // given
    const state = {
      ...emptyMap({ width: 2, height: 2, tile: Tile.Wall })(),
      roads: [1, 2, 3],
    };

    // when
    const extras = countRoads(state);

    // then
    expect(extras).toEqual({ count: 3 });
  });

  it('throws a TypeError naming the step and the extra it needs when called by hand without it', () => {
    // given
    const state = emptyMap({ width: 2, height: 2, tile: Tile.Wall })();

    // when
    // @ts-expect-error the state has no roads
    const call = () => countRoads(state);

    // then
    expect(call).toThrow(TypeError);
    expect(call).toThrow(/"countRoads" needs "roads"/);
  });
});
