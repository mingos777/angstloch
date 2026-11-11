import { describe, expect, it } from 'vitest';
import { findDocsProblems } from './find-docs-problems';

function check(
  documents: Record<string, string>,
  files: Record<string, string> = {},
): string[] {
  return findDocsProblems({
    documents,
    readFile: (path) => files[path],
  });
}

describe('findDocsProblems', () => {
  describe('anchors in the same file', () => {
    it('accepts a link to a heading', () => {
      // given
      const readme =
        '# Angstloch\n\n## Grid and tiles\n\nSee [grid](#grid-and-tiles).\n';

      // when
      const problems = check({ 'README.md': readme });

      // then
      expect(problems).toEqual([]);
    });

    it('flags a link to a missing heading, with its line', () => {
      // given
      const readme = '# Angstloch\n\nSee [grid](#grid).\n';

      // when
      const problems = check({ 'README.md': readme });

      // then
      expect(problems).toEqual([
        'README.md:3: #grid points to no heading in README.md.',
      ]);
    });

    it('drops punctuation and code marks from a heading', () => {
      // given
      const readme =
        '## `digVeins`: veins, (and) more\n\n[a](#digveins-veins-and-more)\n';

      // when
      const problems = check({ 'README.md': readme });

      // then
      expect(problems).toEqual([]);
    });

    it('keeps the text of a link in a heading', () => {
      // given
      const readme =
        '## The [pipeline](#the-pipeline-step) step\n\n[a](#the-pipeline-step)\n';

      // when
      const problems = check({ 'README.md': readme });

      // then
      expect(problems).toEqual([]);
    });

    it('numbers repeated headings as GitHub does', () => {
      // given
      const readme = '## Options\n\n## Options\n\n[a](#options-1)\n';

      // when
      const problems = check({ 'README.md': readme });

      // then
      expect(problems).toEqual([]);
    });

    it('accepts an HTML anchor', () => {
      // given
      const readme = '<a id="tiles"></a>\n\n[a](#tiles)\n';

      // when
      const problems = check({ 'README.md': readme });

      // then
      expect(problems).toEqual([]);
    });

    it('accepts a bare hash, the top of the page', () => {
      // given
      const readme = '[top](#)\n';

      // when
      const problems = check({ 'README.md': readme });

      // then
      expect(problems).toEqual([]);
    });
  });

  describe('links to other files', () => {
    it('accepts a link to a heading in another document', () => {
      // given
      const documents = {
        'README.md': '[veins](docs/steps/dig-veins.md#options)\n',
        'docs/steps/dig-veins.md': '# digVeins\n\n## Options\n',
      };

      // when
      const problems = check(documents);

      // then
      expect(problems).toEqual([]);
    });

    it('resolves a path from the directory of the linking file', () => {
      // given
      const documents = {
        'docs/steps/dig-veins.md': '[concepts](../concepts.md#ranges)\n',
        'docs/concepts.md': '## Ranges\n',
      };

      // when
      const problems = check(documents);

      // then
      expect(problems).toEqual([]);
    });

    it('flags a link to a missing file', () => {
      // given
      const documents = { 'README.md': '[docs](docs/missing.md)\n' };

      // when
      const problems = check(documents);

      // then
      expect(problems).toEqual([
        'README.md:1: docs/missing.md points to docs/missing.md, which does not exist.',
      ]);
    });

    it('flags a link to a missing heading in another document', () => {
      // given
      const documents = {
        'README.md': '[x](docs/concepts.md#nowhere)\n',
        'docs/concepts.md': '## Ranges\n',
      };

      // when
      const problems = check(documents);

      // then
      expect(problems).toEqual([
        'README.md:1: docs/concepts.md#nowhere points to no heading in docs/concepts.md.',
      ]);
    });

    it('reads the headings of a Markdown file outside the checked ones', () => {
      // given
      const documents = { 'README.md': '[1.0.0](CHANGELOG.md#unreleased)\n' };
      const files = { 'CHANGELOG.md': '# Changelog\n\n## Unreleased\n' };

      // when
      const problems = check(documents, files);

      // then
      expect(problems).toEqual([]);
    });

    it('accepts any anchor into a file that is not Markdown', () => {
      // given
      const documents = { 'docs/x.md': '[code](../src/index.ts#L3)\n' };
      const files = { 'src/index.ts': 'export {};\n' };

      // when
      const problems = check(documents, files);

      // then
      expect(problems).toEqual([]);
    });

    it('flags a link that leads out of the repository', () => {
      // given
      const documents = { 'README.md': '[old](../angstloch-old/README.md)\n' };

      // when
      const problems = check(documents);

      // then
      expect(problems).toEqual([
        'README.md:1: ../angstloch-old/README.md leads out of the repository.',
      ]);
    });

    it('flags a link from the repository root', () => {
      // given
      const documents = {
        'README.md': '[docs](/docs/concepts.md)\n',
        'docs/concepts.md': '# Concepts\n',
      };

      // when
      const problems = check(documents);

      // then
      expect(problems).toEqual([
        'README.md:1: /docs/concepts.md starts at the root; use a relative link.',
      ]);
    });

    it('decodes an escaped path', () => {
      // given
      const documents = {
        'README.md': '[x](docs/two%20words.md)\n',
        'docs/two words.md': '# Two words\n',
      };

      // when
      const problems = check(documents);

      // then
      expect(problems).toEqual([]);
    });
  });

  describe('what is not a link', () => {
    it('skips links with a scheme', () => {
      // given
      const readme = '[npm](https://www.npmjs.com/) and [me](mailto:a@b.c)\n';

      // when
      const problems = check({ 'README.md': readme });

      // then
      expect(problems).toEqual([]);
    });

    it('skips fenced code blocks', () => {
      // given
      const readme =
        '```\n[a](#nowhere)\n## Not a heading\n```\n\n[b](#not-a-heading)\n';

      // when
      const problems = check({ 'README.md': readme });

      // then
      expect(problems).toEqual([
        'README.md:6: #not-a-heading points to no heading in README.md.',
      ]);
    });

    it('skips code spans', () => {
      // given
      const readme = 'Write `[a](#nowhere)` for a link.\n';

      // when
      const problems = check({ 'README.md': readme });

      // then
      expect(problems).toEqual([]);
    });
  });

  describe('kinds of links', () => {
    it('checks images', () => {
      // given
      const readme = '![map](docs/map.png)\n';

      // when
      const problems = check({ 'README.md': readme });

      // then
      expect(problems).toHaveLength(1);
    });

    it('checks reference definitions', () => {
      // given
      const readme = '[grid][g]\n\n[g]: #grid\n';

      // when
      const problems = check({ 'README.md': readme });

      // then
      expect(problems).toEqual([
        'README.md:3: #grid points to no heading in README.md.',
      ]);
    });

    it('checks a link with a title and angle brackets', () => {
      // given
      const readme =
        '## Grid\n\n[a](<#grid> "The grid") [b](#tiles \'Tiles\')\n';

      // when
      const problems = check({ 'README.md': readme });

      // then
      expect(problems).toEqual([
        'README.md:3: #tiles points to no heading in README.md.',
      ]);
    });

    it('checks every link on a line', () => {
      // given
      const readme = '[a](#one), [b](#two)\n';

      // when
      const problems = check({ 'README.md': readme });

      // then
      expect(problems).toHaveLength(2);
    });
  });
});
