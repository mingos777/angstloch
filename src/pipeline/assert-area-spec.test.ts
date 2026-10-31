import { describe, expect, it } from 'vitest';
import { assertAreaSpec } from './assert-area-spec';

describe('assertAreaSpec', () => {
  it('accepts the default, which is the whole map', () => {
    // given
    const area = {};

    // when
    const call = () => {
      assertAreaSpec(area, { min: 1, max: 1 }, 80, 50);
    };

    // then
    expect(call).not.toThrow();
  });

  it('accepts a smaller area with several copies', () => {
    // given
    const area = { width: { min: 10, max: 20 }, height: { min: 10, max: 20 } };

    // when
    const call = () => {
      assertAreaSpec(area, { min: 1, max: 3 }, 80, 50);
    };

    // then
    expect(call).not.toThrow();
  });

  it('accepts a count of 0', () => {
    // given
    const count = { min: 0, max: 1 };

    // when
    const call = () => {
      assertAreaSpec({}, count, 80, 50);
    };

    // then
    expect(call).not.toThrow();
  });

  it.each([
    ['a width larger than the map', { width: { min: 10, max: 81 } }],
    ['a height larger than the map', { height: { min: 10, max: 51 } }],
    ['a width of 0', { width: { min: 0, max: 5 } }],
    ['a height that is not whole', { height: { min: 1.5, max: 5 } }],
    ['a width with min above max', { width: { min: 9, max: 5 } }],
  ])('throws a RangeError for %s', (_, area) => {
    // given
    const count = { min: 1, max: 1 };

    // when
    const call = () => {
      assertAreaSpec(area, count, 80, 50);
    };

    // then
    expect(call).toThrow(RangeError);
  });

  it('throws a RangeError for a bad count', () => {
    // given
    const count = { min: -1, max: 1 };

    // when
    const call = () => {
      assertAreaSpec({}, count, 80, 50);
    };

    // then
    expect(call).toThrow(RangeError);
  });

  it('throws a RangeError for several copies of an area as big as the map', () => {
    // given
    const count = { min: 1, max: 2 };

    // when
    const call = () => {
      assertAreaSpec({}, count, 80, 50);
    };

    // then
    expect(call).toThrow(RangeError);
  });

  it('throws a RangeError for several copies when only one side is smaller and every width is the map width', () => {
    // given
    const area = { width: { min: 80, max: 80 }, height: { min: 50, max: 50 } };

    // when
    const call = () => {
      assertAreaSpec(area, { min: 1, max: 2 }, 80, 50);
    };

    // then
    expect(call).toThrow(RangeError);
  });

  describe('windows', () => {
    it('accepts a window on each axis', () => {
      // given
      const area = {
        width: { min: 10, max: 20 },
        height: { min: 5, max: 10 },
        x: { min: 0, max: 10, anchor: 'left' as const },
        y: { min: 40, max: 49, anchor: 'bottom' as const },
      };

      // when
      const call = () => {
        assertAreaSpec(area, { min: 1, max: 2 }, 80, 50);
      };

      // then
      expect(call).not.toThrow();
    });

    it('accepts a window that reaches beyond the map', () => {
      // given
      const area = { width: { min: 10, max: 10 }, x: { min: -20, max: 100 } };

      // when
      const call = () => {
        assertAreaSpec(area, { min: 1, max: 1 }, 80, 50);
      };

      // then
      expect(call).not.toThrow();
    });

    it('accepts a window an area as big as the map satisfies', () => {
      // given
      const area = { x: { min: 0, max: 0, anchor: 'left' as const } };

      // when
      const call = () => {
        assertAreaSpec(area, { min: 1, max: 1 }, 80, 50);
      };

      // then
      expect(call).not.toThrow();
    });

    it('accepts an odd window of several tiles on a lattice', () => {
      // given
      const area = { width: { min: 5, max: 5 }, x: { min: 3, max: 5 } };

      // when
      const call = () => {
        assertAreaSpec(area, { min: 1, max: 1 }, 81, 51, { lattice: true });
      };

      // then
      expect(call).not.toThrow();
    });

    it.each([
      ['a window with min above max', { x: { min: 10, max: 5 } }],
      ['a window that is not whole', { y: { min: 1.5, max: 5 } }],
      [
        'an unknown x anchor',
        { x: { min: 0, max: 5, anchor: 'top' as 'left' } },
      ],
      [
        'an unknown y anchor',
        { y: { min: 0, max: 5, anchor: 'left' as 'top' } },
      ],
      ['a window off the map', { x: { min: 90, max: 99 } }],
      [
        'a window too near the edge for the anchor',
        {
          width: { min: 10, max: 10 },
          x: { min: 0, max: 5, anchor: 'right' as const },
        },
      ],
      [
        'a window that cannot hold the largest box',
        {
          height: { min: 5, max: 40 },
          y: { min: 45, max: 49, anchor: 'top' as const },
        },
      ],
      [
        'a window an area as big as the map cannot satisfy',
        { x: { min: 5, max: 10, anchor: 'left' as const } },
      ],
    ])('throws a RangeError for %s', (_, area) => {
      // given
      const count = { min: 1, max: 1 };

      // when
      const call = () => {
        assertAreaSpec(area, count, 80, 50);
      };

      // then
      expect(call).toThrow(RangeError);
    });

    it('throws a RangeError for a window with no even coordinate on a lattice', () => {
      // given
      const area = { width: { min: 5, max: 5 }, x: { min: 3, max: 3 } };

      // when
      const call = () => {
        assertAreaSpec(area, { min: 1, max: 1 }, 81, 51, { lattice: true });
      };

      // then
      expect(call).toThrow(RangeError);
    });

    it('accepts the same window off a lattice', () => {
      // given
      const area = { width: { min: 5, max: 5 }, x: { min: 3, max: 3 } };

      // when
      const call = () => {
        assertAreaSpec(area, { min: 1, max: 1 }, 81, 51);
      };

      // then
      expect(call).not.toThrow();
    });
  });

  describe('gravity', () => {
    it('accepts gravity on its own', () => {
      // given
      const area = {
        width: { min: 10, max: 20 },
        gravity: { toward: 'top right' as const, strength: 0.5 },
      };

      // when
      const call = () => {
        assertAreaSpec(area, { min: 1, max: 2 }, 80, 50);
      };

      // then
      expect(call).not.toThrow();
    });

    it.each([
      [
        'gravity with an x window',
        {
          gravity: { toward: 'left' as const, strength: 1 },
          x: { min: 0, max: 79 },
        },
      ],
      [
        'gravity with a y window',
        {
          gravity: { toward: 'left' as const, strength: 1 },
          y: { min: 0, max: 49 },
        },
      ],
      [
        'an unknown toward',
        { gravity: { toward: 'up' as 'top', strength: 1 } },
      ],
      [
        'a strength above 1',
        { gravity: { toward: 'top' as const, strength: 1.5 } },
      ],
      [
        'a strength below 0',
        { gravity: { toward: 'top' as const, strength: -0.1 } },
      ],
    ])('throws a RangeError for %s', (_, area) => {
      // given
      const count = { min: 1, max: 1 };

      // when
      const call = () => {
        assertAreaSpec({ width: { min: 10, max: 10 }, ...area }, count, 80, 50);
      };

      // then
      expect(call).toThrow(RangeError);
    });
  });
});
