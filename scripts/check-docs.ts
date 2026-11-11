/**
 * Checks the links of `README.md` and the Markdown files in `docs/`. Run with
 * `npm run check:docs`. It prints one line per broken link and exits with 1,
 * or prints OK. The rules are in `findDocsProblems`.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { findDocsProblems } from './find-docs-problems';

declare const process: { exitCode?: number };

function readFile(path: string): string | undefined {
  try {
    return readFileSync(path, 'utf8');
  } catch {
    // a missing file, or a directory
    return undefined;
  }
}

const paths = [
  'README.md',
  ...(existsSync('docs')
    ? readdirSync('docs', { encoding: 'utf8', recursive: true })
        .filter((path) => path.endsWith('.md'))
        .map((path) => `docs/${path.replace(/\\/g, '/')}`)
    : []),
].sort();

const documents: Record<string, string> = {};
for (const path of paths) {
  documents[path] = readFileSync(path, 'utf8');
}

const problems = findDocsProblems({ documents, readFile });

if (problems.length === 0) {
  console.log(`OK: ${String(paths.length)} files, no broken links.`);
} else {
  for (const problem of problems) {
    console.log(problem);
  }
  console.log(`${String(problems.length)} broken links.`);
  process.exitCode = 1;
}
