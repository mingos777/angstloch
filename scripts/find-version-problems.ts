/**
 * Compares the version in `package.json` with the latest git tag and the
 * changelog, and lists what does not agree. The rules are in
 * `designs/versioning.md` (the ratchet of CLAUDE.md): `package.json` holds the
 * next version to publish, and it only goes up between releases.
 */
export interface VersionState {
  /** The `version` of `package.json`. */
  version: string;
  /** The latest git tag (a leading `v` is fine), or `undefined` before the first release. */
  tag: string | undefined;
  /** The text of `CHANGELOG.md`. */
  changelog: string;
}

type Triple = [number, number, number];
type Level = 'none' | 'patch' | 'minor' | 'major';

const LEVEL_RANK: Record<Level, number> = {
  none: 0,
  patch: 1,
  minor: 2,
  major: 3,
};

const HEADING_LEVEL: Record<string, Level> = {
  Added: 'minor',
  Removed: 'major',
};

function parseVersion(text: string): Triple | undefined {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(text);
  if (!match) {
    return undefined;
  }
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

function compareVersions(a: Triple, b: Triple): number {
  return a[0] - b[0] || a[1] - b[1] || a[2] - b[2];
}

function describeLevel(from: Triple, to: Triple): Level {
  if (to[0] !== from[0]) {
    return 'major';
  }
  if (to[1] !== from[1]) {
    return 'minor';
  }
  return to[2] !== from[2] ? 'patch' : 'none';
}

/** The one version that follows `tag` at a given level, or `undefined` for 'none'. */
function nextVersion(tag: Triple, level: Level): string | undefined {
  switch (level) {
    case 'major':
      return [tag[0] + 1, 0, 0].join('.');
    case 'minor':
      return [tag[0], tag[1] + 1, 0].join('.');
    case 'patch':
      return [tag[0], tag[1], tag[2] + 1].join('.');
    case 'none':
      return undefined;
  }
}

function findUnreleasedLines(changelog: string): string[] | undefined {
  const lines = changelog.split('\n');
  const start = lines.findIndex((line) => /^## Unreleased\s*$/.test(line));
  if (start === -1) {
    return undefined;
  }
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((line) => line.startsWith('## '));
  return end === -1 ? rest : rest.slice(0, end);
}

/** The highest level an entry of the Unreleased section asks for. */
function findUnreleasedLevel(lines: string[]): Level {
  let heading = '';
  let level: Level = 'none';
  for (const line of lines) {
    if (line.startsWith('### ')) {
      heading = line.slice(4).trim();
    } else if (line.startsWith('- ')) {
      const entry = line.includes('**Breaking:**')
        ? 'major'
        : (HEADING_LEVEL[heading] ?? 'patch');
      if (LEVEL_RANK[entry] > LEVEL_RANK[level]) {
        level = entry;
      }
    }
  }
  return level;
}

function findTopReleasedVersion(changelog: string): string | undefined {
  return /^## \[?(\d+\.\d+\.\d+)\]?/m.exec(changelog)?.[1];
}

export function findVersionProblems(state: VersionState): string[] {
  const problems: string[] = [];
  const version = parseVersion(state.version);
  const tag =
    state.tag === undefined
      ? undefined
      : parseVersion(state.tag.replace(/^v/, ''));
  const unreleased = findUnreleasedLines(state.changelog);
  const unreleasedLevel =
    unreleased === undefined ? 'none' : findUnreleasedLevel(unreleased);
  const topReleased = findTopReleasedVersion(state.changelog);

  if (unreleased === undefined) {
    problems.push('CHANGELOG.md has no "## Unreleased" section.');
  }
  if (!version) {
    problems.push(
      `package.json says "${state.version}", which is not a plain x.y.z version.`,
    );
  }
  if (state.tag !== undefined && !tag) {
    problems.push(
      `The latest tag "${state.tag}" is not a version (v1.2.3 or 1.2.3).`,
    );
  }
  if (!version || (state.tag !== undefined && !tag)) {
    return problems;
  }

  if (state.tag === undefined || !tag) {
    if (state.version !== '0.0.0') {
      problems.push(
        `There is no release tag yet, so package.json should still say 0.0.0, not ${state.version}.`,
      );
    }
    if (topReleased !== undefined) {
      problems.push(
        `CHANGELOG.md lists ${topReleased} as released, but there is no git tag.`,
      );
    }
    return problems;
  }

  const tagText = tag.join('.');
  if (topReleased !== tagText) {
    problems.push(
      `The latest tag is ${tagText}, but the top released section of CHANGELOG.md is ${topReleased ?? 'missing'}.`,
    );
  }

  if (compareVersions(version, tag) < 0) {
    problems.push(
      `package.json says ${state.version}, which is lower than the latest tag ${tagText}.`,
    );
    return problems;
  }

  const pending = describeLevel(tag, version);
  if (pending !== 'none' && nextVersion(tag, pending) !== state.version) {
    problems.push(
      `package.json says ${state.version}, which is not the next ${pending} version after ${tagText} (${nextVersion(tag, pending) ?? ''}).`,
    );
  }
  if (pending !== 'none' && unreleasedLevel === 'none') {
    problems.push(
      `package.json is raised to ${state.version}, but the Unreleased section has no entries.`,
    );
  }
  if (LEVEL_RANK[unreleasedLevel] > LEVEL_RANK[pending]) {
    problems.push(
      `The Unreleased section holds a ${unreleasedLevel} change, so package.json should say ${nextVersion(tag, unreleasedLevel) ?? ''} (it says ${state.version}).`,
    );
  }
  return problems;
}
