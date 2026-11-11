import { describe, expect, it } from 'vitest';
import { fillMapMarkers } from './fill-map-markers';

const EXAMPLES: Record<string, string> = {
  cave: '```text\n#..#\n```',
  maze: '```text\n#.#\n```',
};

function fill(document: string) {
  return fillMapMarkers(document, (name) => EXAMPLES[name]);
}

describe('fillMapMarkers', () => {
  it('writes an example between its markers, with a blank line round it', () => {
    // given
    const document = '# Cave\n\n<!-- map: cave -->\n<!-- /map -->\n';

    // when
    const { text } = fill(document);

    // then
    expect(text).toBe(
      '# Cave\n\n<!-- map: cave -->\n\n```text\n#..#\n```\n\n<!-- /map -->\n',
    );
  });

  it('replaces what sat between the markers and leaves the rest alone', () => {
    // given
    const document =
      'Before.\n<!-- map: cave -->\nold map\n<!-- /map -->\nAfter.';

    // when
    const { text } = fill(document);

    // then
    expect(text).toBe(
      'Before.\n<!-- map: cave -->\n\n```text\n#..#\n```\n\n<!-- /map -->\nAfter.',
    );
  });

  it('lists the markers whose content changed', () => {
    // given
    const document =
      '<!-- map: cave -->\n\n```text\n#..#\n```\n\n<!-- /map -->\n<!-- map: maze -->\nold\n<!-- /map -->';

    // when
    const { changed, names } = fill(document);

    // then
    expect({ changed, names }).toEqual({
      changed: ['maze'],
      names: ['cave', 'maze'],
    });
  });

  it('leaves a document without markers as it is', () => {
    // given
    const document = '# Title\n\nText.\n';

    // when
    const result = fill(document);

    // then
    expect(result).toEqual({
      text: document,
      changed: [],
      names: [],
      problems: [],
    });
  });

  it('flags an unknown example and keeps its content', () => {
    // given
    const document = 'x\n<!-- map: lake -->\nold\n<!-- /map -->';

    // when
    const { text, problems } = fill(document);

    // then
    expect({ text, problems }).toEqual({
      text: document,
      problems: ['2: map lake is no example.'],
    });
  });

  it('flags a marker that is never closed', () => {
    // given
    const document = '<!-- map: cave -->\nold';

    // when
    const { text, problems } = fill(document);

    // then
    expect({ text, problems }).toEqual({
      text: document,
      problems: ['1: map cave has no <!-- /map --> after it.'],
    });
  });

  it('flags an end marker that closes nothing', () => {
    // given
    const document = 'x\n<!-- /map -->';

    // when
    const { problems } = fill(document);

    // then
    expect(problems).toEqual(['2: <!-- /map --> closes no map.']);
  });

  it('flags a marker inside another', () => {
    // given
    const document =
      '<!-- map: cave -->\nold\n<!-- map: maze -->\n<!-- /map -->';

    // when
    const { problems } = fill(document);

    // then
    expect(problems).toEqual([
      '3: map maze starts inside map cave, which starts on line 1.',
    ]);
  });

  it('leaves markers inside a fenced code block alone', () => {
    // given
    const document = '```\n<!-- map: cave -->\n<!-- /map -->\n```\n';

    // when
    const result = fill(document);

    // then
    expect(result).toEqual({
      text: document,
      changed: [],
      names: [],
      problems: [],
    });
  });
});
