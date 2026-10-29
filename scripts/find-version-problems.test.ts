import { describe, expect, it } from 'vitest';
import { findVersionProblems } from './find-version-problems';

function changelog(unreleased: string, released = ''): string {
  return `# Changelog\n\n## Unreleased\n\n${unreleased}\n${released}`;
}

const NOTHING = '';
const FIX = '### Fixed\n\n- A fix.\n';
const FEATURE = '### Added\n\n- A step.\n';
const BREAKING = '### Changed\n\n- **Breaking:** an option was renamed.\n';
const RELEASED = '## 1.0.0 - 2026-11-01\n\n### Added\n\n- Initial release.\n';

describe('findVersionProblems', () => {
  describe('before the first release', () => {
    it('accepts 0.0.0 with an Unreleased section', () => {
      // given
      const state = {
        version: '0.0.0',
        tag: undefined,
        changelog: changelog(FEATURE),
      };

      // when
      const problems = findVersionProblems(state);

      // then
      expect(problems).toEqual([]);
    });

    it('flags a version other than 0.0.0', () => {
      // given
      const state = {
        version: '1.0.0',
        tag: undefined,
        changelog: changelog(FEATURE),
      };

      // when
      const problems = findVersionProblems(state);

      // then
      expect(problems).toHaveLength(1);
      expect(problems[0]).toContain('should still say 0.0.0');
    });

    it('flags a released section in the changelog without a tag', () => {
      // given
      const state = {
        version: '0.0.0',
        tag: undefined,
        changelog: changelog(NOTHING, RELEASED),
      };

      // when
      const problems = findVersionProblems(state);

      // then
      expect(problems).toHaveLength(1);
      expect(problems[0]).toContain('no git tag');
    });
  });

  describe('the changelog', () => {
    it('flags a missing Unreleased section', () => {
      // given
      const state = {
        version: '0.0.0',
        tag: undefined,
        changelog: '# Changelog\n',
      };

      // when
      const problems = findVersionProblems(state);

      // then
      expect(problems).toEqual([
        'CHANGELOG.md has no "## Unreleased" section.',
      ]);
    });

    it('flags a tag that differs from the top released section', () => {
      // given
      const state = {
        version: '1.0.0',
        tag: 'v1.0.0',
        changelog: changelog(NOTHING, '## 0.9.0 - 2026-01-01\n'),
      };

      // when
      const problems = findVersionProblems(state);

      // then
      expect(problems).toHaveLength(1);
      expect(problems[0]).toContain(
        'top released section of CHANGELOG.md is 0.9.0',
      );
    });

    it('reads a released heading in brackets', () => {
      // given
      const state = {
        version: '1.0.0',
        tag: 'v1.0.0',
        changelog: changelog(NOTHING, '## [1.0.0] - 2026-11-01\n'),
      };

      // when
      const problems = findVersionProblems(state);

      // then
      expect(problems).toEqual([]);
    });
  });

  describe('after a release', () => {
    it('accepts the tagged version with nothing unreleased', () => {
      // given
      const state = {
        version: '1.0.0',
        tag: 'v1.0.0',
        changelog: changelog(NOTHING, RELEASED),
      };

      // when
      const problems = findVersionProblems(state);

      // then
      expect(problems).toEqual([]);
    });

    it('accepts a tag without a leading v', () => {
      // given
      const state = {
        version: '1.0.0',
        tag: '1.0.0',
        changelog: changelog(NOTHING, RELEASED),
      };

      // when
      const problems = findVersionProblems(state);

      // then
      expect(problems).toEqual([]);
    });

    it('accepts a patch bump for a fix', () => {
      // given
      const state = {
        version: '1.0.1',
        tag: 'v1.0.0',
        changelog: changelog(FIX, RELEASED),
      };

      // when
      const problems = findVersionProblems(state);

      // then
      expect(problems).toEqual([]);
    });

    it('accepts a minor bump when a fix is also unreleased', () => {
      // given
      const state = {
        version: '1.1.0',
        tag: 'v1.0.0',
        changelog: changelog(`${FEATURE}\n${FIX}`, RELEASED),
      };

      // when
      const problems = findVersionProblems(state);

      // then
      expect(problems).toEqual([]);
    });

    it('accepts a major bump for a breaking entry', () => {
      // given
      const state = {
        version: '2.0.0',
        tag: 'v1.4.2',
        changelog: changelog(BREAKING, '## 1.4.2 - 2026-12-01\n'),
      };

      // when
      const problems = findVersionProblems(state);

      // then
      expect(problems).toEqual([]);
    });

    it('asks for a minor bump when an added entry is unreleased', () => {
      // given
      const state = {
        version: '1.0.1',
        tag: 'v1.0.0',
        changelog: changelog(`${FIX}\n${FEATURE}`, RELEASED),
      };

      // when
      const problems = findVersionProblems(state);

      // then
      expect(problems).toHaveLength(1);
      expect(problems[0]).toContain('should say 1.1.0');
    });

    it('asks for a major bump when a removal is unreleased', () => {
      // given
      const state = {
        version: '1.1.0',
        tag: 'v1.0.0',
        changelog: changelog('### Removed\n\n- An option.\n', RELEASED),
      };

      // when
      const problems = findVersionProblems(state);

      // then
      expect(problems).toHaveLength(1);
      expect(problems[0]).toContain('should say 2.0.0');
    });

    it('asks for a bump when entries are unreleased at the tagged version', () => {
      // given
      const state = {
        version: '1.0.0',
        tag: 'v1.0.0',
        changelog: changelog(FIX, RELEASED),
      };

      // when
      const problems = findVersionProblems(state);

      // then
      expect(problems).toHaveLength(1);
      expect(problems[0]).toContain('should say 1.0.1');
    });

    it('flags a raised version with an empty Unreleased section', () => {
      // given
      const state = {
        version: '1.0.1',
        tag: 'v1.0.0',
        changelog: changelog(NOTHING, RELEASED),
      };

      // when
      const problems = findVersionProblems(state);

      // then
      expect(problems).toHaveLength(1);
      expect(problems[0]).toContain('no entries');
    });

    it('flags a version below the tag', () => {
      // given
      const state = {
        version: '1.0.0',
        tag: 'v1.2.0',
        changelog: changelog(NOTHING, '## 1.2.0 - 2027-01-01\n'),
      };

      // when
      const problems = findVersionProblems(state);

      // then
      expect(problems).toHaveLength(1);
      expect(problems[0]).toContain('lower than the latest tag 1.2.0');
    });

    it('flags a version that skips a number', () => {
      // given
      const state = {
        version: '1.0.5',
        tag: 'v1.0.0',
        changelog: changelog(FIX, RELEASED),
      };

      // when
      const problems = findVersionProblems(state);

      // then
      expect(problems).toHaveLength(1);
      expect(problems[0]).toContain(
        'not the next patch version after 1.0.0 (1.0.1)',
      );
    });
  });

  describe('malformed input', () => {
    it('flags a version that is not x.y.z', () => {
      // given
      const state = {
        version: '1.0.0-beta.1',
        tag: undefined,
        changelog: changelog(FEATURE),
      };

      // when
      const problems = findVersionProblems(state);

      // then
      expect(problems).toEqual([
        'package.json says "1.0.0-beta.1", which is not a plain x.y.z version.',
      ]);
    });

    it('flags a tag that is not a version', () => {
      // given
      const state = {
        version: '1.0.0',
        tag: 'release-1',
        changelog: changelog(NOTHING),
      };

      // when
      const problems = findVersionProblems(state);

      // then
      expect(problems).toEqual([
        'The latest tag "release-1" is not a version (v1.2.3 or 1.2.3).',
      ]);
    });
  });
});
