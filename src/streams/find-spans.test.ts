import { describe, expect, it } from 'vitest';
import { findSpans } from './find-spans';

/** Builds a map of 7 by 5 tiles from rows where `~` is water, `#` is crossing over water and `=` is crossing over land. */
function build(rows: string[]) {
  const water = Uint8Array.from(rows.join('').split(''), (char) =>
    char === '~' || char === '#' ? 1 : 0,
  );
  const crossing = Uint8Array.from(rows.join('').split(''), (char) =>
    char === '#' || char === '=' ? 1 : 0,
  );
  return { water, crossing, width: rows[0]?.length ?? 0, height: rows.length };
}

const spanned = (spans: Uint8Array) => spans.reduce((a, b) => a + b, 0);

describe('findSpans', () => {
  it('finds a crossing that goes from one bank to the other', () => {
    // given
    const { water, crossing, width, height } = build([
      '..~~~..',
      '=.###.=',
      '..~~~..',
    ]);

    // when
    const spans = findSpans(water, crossing, width, height);

    // then
    expect(spanned(spans)).toBe(3);
  });

  it('ignores a crossing that only clips the bank', () => {
    // given
    const { water, crossing, width, height } = build([
      '..~~~..',
      '..#~~..',
      '..~~~..',
    ]);

    // when
    const spans = findSpans(water, crossing, width, height);

    // then
    expect(spanned(spans)).toBe(0);
  });

  it('ignores a crossing that runs along the stream', () => {
    // given
    const { water, crossing, width, height } = build([
      '..~#~..',
      '..~#~..',
      '..~#~..',
    ]);

    // when
    const spans = findSpans(water, crossing, width, height);

    // then
    expect(spanned(spans)).toBe(0);
  });

  it('ignores a crossing that ends in the water at the edge of the map', () => {
    // given
    const { water, crossing, width, height } = build(['..~~###', '..~~~~~']);

    // when
    const spans = findSpans(water, crossing, width, height);

    // then
    expect(spanned(spans)).toBe(0);
  });

  it('finds a crossing that goes down a column', () => {
    // given
    const { water, crossing, width, height } = build([
      '...=...',
      '~~~#~~~',
      '~~~#~~~',
      '...=...',
    ]);

    // when
    const spans = findSpans(water, crossing, width, height);

    // then
    expect(spanned(spans)).toBe(2);
  });

  it('keeps a lane of a bridge that ends in the water', () => {
    // given
    const { water, crossing, width, height } = build([
      '..~~~..',
      '=.###.=',
      '..###..',
      '..~~~..',
    ]);

    // when
    const spans = findSpans(water, crossing, width, height);

    // then: the lane below ends in the water, but is as much of the bridge
    expect(spanned(spans)).toBe(6);
  });

  it('ignores a crossing that runs along the bank', () => {
    // given
    const { water, crossing, width, height } = build([
      '..#~~..',
      '..#~~..',
      '..#~~..',
      '..~~~..',
    ]);

    // when
    const spans = findSpans(water, crossing, width, height);

    // then
    expect(spanned(spans)).toBe(0);
  });

  it('finds a diagonal crossing of water that is wider than the bridge', () => {
    // given
    const { water, crossing, width, height } = build([
      '=.~~~~~',
      '~##~~~.',
      '~~##~~.',
      '~~~##~.',
      '~~~~##.',
      '.~~~~#=',
    ]);

    // when
    const spans = findSpans(water, crossing, width, height);

    // then: the lines of the bridge end in water, but it joins two pieces of land
    expect(spanned(spans)).toBe(9);
  });
});
