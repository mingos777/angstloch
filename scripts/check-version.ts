/**
 * Checks that the version in `package.json`, the latest git tag and
 * `CHANGELOG.md` agree. Run with `npm run check:version`. It prints one line
 * per problem and exits with 1, or prints OK. The rules are in
 * `findVersionProblems`.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { findVersionProblems } from './find-version-problems';

declare const process: { exitCode?: number };

function readLatestTag(): string | undefined {
  try {
    return execFileSync('git', ['describe', '--tags', '--abbrev=0'], {
      encoding: 'utf8',
      stdio: 'pipe',
    }).trim();
  } catch {
    // git exits with an error when the repository has no tag yet
    return undefined;
  }
}

const { version } = JSON.parse(readFileSync('package.json', 'utf8')) as {
  version: string;
};
const tag = readLatestTag();
const problems = findVersionProblems({
  version,
  tag,
  changelog: readFileSync('CHANGELOG.md', 'utf8'),
});

if (problems.length === 0) {
  console.log(`OK: package.json ${version}, latest tag ${tag ?? 'none'}.`);
} else {
  for (const problem of problems) {
    console.log(problem);
  }
  process.exitCode = 1;
}
