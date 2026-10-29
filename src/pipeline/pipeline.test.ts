import { describe, expect, it } from 'vitest';
import { Tile } from '../core/tile';
import { TemplatePlacementError } from '../rooms/templates/template-placement-error';
import { mulberry32 } from '../test-helpers/mulberry32';
import { emptyMap } from './empty-map';
import { pipeline } from './pipeline';
import { step } from './step';

const base = emptyMap({ width: 3, height: 3, tile: Tile.Wall });

const carve = step('carve', {}, (state) => {
  state.grid.set(1, 1, Tile.Floor);
  return {};
});

const findRoads = step<object, { roads: string[] }>(
  'findRoads',
  { adds: ['roads'] },
  () => ({ roads: ['main'] }),
);

const useRoads = step<{ roads: string[] }, { count: number }>(
  'useRoads',
  { needs: ['roads'], adds: ['count'] },
  (state) => ({ count: state.roads.length }),
);

/** A step that throws the given errors, one per call, and then succeeds. */
function failing(errors: Error[]) {
  let calls = 0;
  return step('failing', {}, () => {
    const error = errors[calls++];
    if (error) {
      throw error;
    }
    return {};
  });
}

describe('pipeline', () => {
  it('runs the steps on the base', () => {
    // given
    const steps = [carve] as const;

    // when
    const result = pipeline(base, steps);

    // then
    expect(result.grid.toString()).toBe('###\n#.#\n###');
  });

  it('merges the extras of the steps into the result', () => {
    // given
    const steps = [findRoads, useRoads] as const;

    // when
    const result = pipeline(base, steps);

    // then
    expect(result.roads).toEqual(['main']);
    expect(result.count).toBe(1);
  });

  it('lets a later extra replace an earlier one', () => {
    // given
    const replace = step<object, { roads: string[] }>(
      'replace',
      { adds: ['roads'] },
      () => ({ roads: ['side', 'lane'] }),
    );

    // when
    const result = pipeline(base, [findRoads, replace, useRoads]);

    // then
    expect(result.count).toBe(2);
  });

  it('returns the base tile and the prunable mask of the state', () => {
    // given
    const steps = [carve] as const;

    // when
    const result = pipeline(base, steps);

    // then
    expect(result.base).toBe(Tile.Wall);
    expect(result.prunable).toHaveLength(9);
  });

  it('reports one attempt and no failures when nothing throws', () => {
    // given
    const steps = [carve] as const;

    // when
    const result = pipeline(base, steps);

    // then
    expect(result.attempts).toBe(1);
    expect(result.failures).toEqual([]);
  });

  it('starts every attempt from a fresh base', () => {
    // given
    const scribble = (errors: Error[]) => {
      const inner = failing(errors);
      return step('scribble', {}, (state, context) => {
        const marked = state.grid.get(0, 0) !== Tile.Wall;
        state.grid.set(0, 0, Tile.Floor);
        if (marked) {
          throw new Error('the base was not fresh');
        }
        return inner(state, context);
      });
    };

    // when
    const result = pipeline(base, [scribble([new Error('retry')])]);

    // then
    expect(result.attempts).toBe(2);
    expect(result.failures).toHaveLength(1);
  });

  it('does not keep extras of a failed attempt', () => {
    // given
    const steps = [findRoads, failing([new Error('once')]), carve] as const;
    const seen: boolean[] = [];

    // when
    pipeline(base, steps, {
      onStep: (name, state) => {
        if (name === 'findRoads') {
          seen.push('roads' in state && 'count' in state);
        }
      },
    });

    // then
    expect(seen).toEqual([false, false]);
  });

  it('records a failure for every failed attempt, also when a later attempt succeeds', () => {
    // given
    const first = new Error('first');
    const second = new Error('second');
    const steps = [carve, failing([first, second])] as const;

    // when
    const result = pipeline(base, steps);

    // then
    expect(result.attempts).toBe(3);
    expect(result.failures).toEqual([
      { attempt: 1, step: 'failing', error: first },
      { attempt: 2, step: 'failing', error: second },
    ]);
  });

  it('throws the last error once the attempts run out', () => {
    // given
    const errors = [new Error('a'), new Error('b'), new Error('c')];
    const steps = [failing(errors)] as const;

    // when
    const call = () => pipeline(base, steps);

    // then
    expect(call).toThrow(errors[2]);
  });

  it('honors the number of attempts', () => {
    // given
    const errors = [new Error('a'), new Error('b')];
    const steps = [failing(errors)] as const;

    // when
    const call = () => pipeline(base, steps, { attempts: 2 });

    // then
    expect(call).toThrow(errors[1]);
  });

  it('does not retry an error that is permanent', () => {
    // given
    const permanent = new TemplatePlacementError(0, 'arena', 'too big', true);
    let calls = 0;
    const counting = step('counting', {}, () => {
      ++calls;
      throw permanent;
    });

    // when
    const call = () => pipeline(base, [counting]);

    // then
    expect(call).toThrow(permanent);
    expect(calls).toBe(1);
  });

  it('retries an error that is not permanent', () => {
    // given
    const retryable = new TemplatePlacementError(0, 'arena', 'no room');
    const steps = [failing([retryable])] as const;

    // when
    const result = pipeline(base, steps);

    // then
    expect(result.attempts).toBe(2);
  });

  it('throws a RangeError for attempts below 1', () => {
    // given
    const options = { attempts: 0 };

    // when
    const call = () => pipeline(base, [carve], options);

    // then
    expect(call).toThrow(RangeError);
  });

  it('throws a TypeError before the first attempt when a step needs an extra nothing adds', () => {
    // given
    let built = 0;
    const counting = () => {
      ++built;
      return base();
    };

    // when
    // @ts-expect-error useRoads comes before findRoads
    const call = () => pipeline(counting, [useRoads, findRoads]);

    // then
    expect(call).toThrow(TypeError);
    expect(call).toThrow(/"useRoads" needs "roads"/);
    expect(built).toBe(0);
  });

  it('does not compile a step that comes before the one it needs', () => {
    // given
    const wrongOrder = () =>
      // @ts-expect-error useRoads needs roads, which nothing adds before it
      pipeline(base, [useRoads]);

    // when
    const call = wrongOrder;

    // then
    expect(call).toThrow(TypeError);
  });

  describe('validate', () => {
    it('checks every step against a fresh base before the first attempt', () => {
      // given
      const seen: string[] = [];
      const checking = step(
        'checking',
        {
          validate: (state) =>
            seen.push(
              `${String(state.grid.width)}x${String(state.grid.height)}`,
            ),
        },
        () => {
          seen.push('run');
          return {};
        },
      );

      // when
      pipeline(base, [checking]);

      // then
      expect(seen).toEqual(['3x3', 'run']);
    });

    it('throws what it throws at once, without running a step or retrying', () => {
      // given
      let runs = 0;
      const counting = step('counting', {}, () => {
        ++runs;
        return {};
      });
      const refusing = step(
        'refusing',
        {
          validate: () => {
            throw new RangeError('too small');
          },
        },
        () => ({}),
      );

      // when
      const call = () => pipeline(base, [counting, refusing]);

      // then
      expect(call).toThrow(new RangeError('too small'));
      expect(runs).toBe(0);
    });

    it('does not record a failure, since no attempt was made', () => {
      // given
      const refusing = step(
        'refusing',
        {
          validate: () => {
            throw new RangeError('too small');
          },
        },
        () => ({}),
      );
      const onStep = () => {
        throw new Error('no step should run');
      };

      // when
      const call = () => pipeline(base, [refusing], { onStep });

      // then
      expect(call).toThrow('too small');
    });

    it('asks for the order first', () => {
      // given
      let validated = false;
      const checking = step<{ roads: string[] }>(
        'checking',
        {
          needs: ['roads'],
          validate: () => {
            validated = true;
          },
        },
        () => ({}),
      );

      // when
      // @ts-expect-error checking needs roads, which nothing adds
      const call = () => pipeline(base, [checking]);

      // then
      expect(call).toThrow(TypeError);
      expect(validated).toBe(false);
    });
  });

  it('calls onStep after every step with its name and the state', () => {
    // given
    const calls: string[] = [];
    const steps = [carve, findRoads] as const;

    // when
    pipeline(base, steps, {
      onStep: (name, state) => {
        calls.push(
          `${name}:${state.grid.get(1, 1) === Tile.Floor ? 'floor' : 'wall'}`,
        );
      },
    });

    // then
    expect(calls).toEqual(['carve:floor', 'findRoads:floor']);
  });

  it('hands the trace callback to the steps', () => {
    // given
    const tracing = step('tracing', {}, (_state, { trace }) => {
      trace?.('tracing', 'hello');
      return {};
    });
    const traced: [string, unknown][] = [];

    // when
    pipeline(base, [tracing], {
      trace: (name, data) => traced.push([name, data]),
    });

    // then
    expect(traced).toEqual([['tracing', 'hello']]);
  });

  it('gives the steps the injected random source', () => {
    // given
    const draw = step<object, { roll: number }>(
      'draw',
      { adds: ['roll'] },
      (_state, { random }) => ({
        roll: random(),
      }),
    );

    // when
    const result = pipeline(base, [draw], { random: mulberry32(7) });

    // then
    expect(result.roll).toBe(mulberry32(7)());
  });

  it('keeps drawing from the same random source across attempts', () => {
    // given
    const rolls: number[] = [];
    let calls = 0;
    const draw = step('draw', {}, (_state, { random }) => {
      rolls.push(random());
      if (++calls === 1) {
        throw new Error('retry');
      }
      return {};
    });
    const expected = mulberry32(3);

    // when
    pipeline(base, [draw], { random: mulberry32(3) });

    // then
    expect(rolls).toEqual([expected(), expected()]);
  });
});
