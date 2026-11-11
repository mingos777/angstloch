/**
 * Writes the example maps of the docs: every `<!-- map: name -->` marker in
 * `README.md` and `docs/` gets the code and the map of the example of that
 * name in `DOC_EXAMPLES`. Run with `npm run docs:maps`; with `-- --check` it
 * writes nothing, lists the stale maps and exits with 1 when there is one.
 * Broken markers and examples used nowhere are listed and exit with 1 either
 * way.
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { DOC_EXAMPLES } from './doc-examples';
import { fillMapMarkers } from './fill-map-markers';
import { renderDocExample } from './render-doc-example';

declare const process: { argv: string[]; exitCode?: number };

const check = process.argv.includes('--check');

const paths = [
  'README.md',
  ...(existsSync('docs')
    ? readdirSync('docs', { encoding: 'utf8', recursive: true })
        .filter((path) => path.endsWith('.md'))
        .map((path) => `docs/${path.replace(/\\/g, '/')}`)
    : []),
].sort();

const rendered: Record<string, string> = {};
for (const [name, example] of Object.entries(DOC_EXAMPLES)) {
  rendered[name] = await renderDocExample(example);
}

const problems: string[] = [];
const stale: string[] = [];
const used = new Set<string>();
for (const path of paths) {
  const document = readFileSync(path, 'utf8');
  const {
    text,
    changed,
    names,
    problems: found,
  } = fillMapMarkers(document, (name) => rendered[name]);
  problems.push(...found.map((problem) => `${path}:${problem}`));
  for (const name of names) {
    used.add(name);
  }
  if (changed.length === 0) {
    continue;
  }
  stale.push(`${path}: ${changed.join(', ')}`);
  if (!check) {
    writeFileSync(path, text, 'utf8');
  }
}
for (const name of Object.keys(DOC_EXAMPLES)) {
  if (!used.has(name)) {
    problems.push(`${name} is in no document.`);
  }
}

for (const line of stale) {
  console.log(check ? `stale ${line}` : `wrote ${line}`);
}
for (const problem of problems) {
  console.log(problem);
}
if (problems.length > 0 || (check && stale.length > 0)) {
  process.exitCode = 1;
} else if (stale.length === 0) {
  console.log(
    `OK: ${String(used.size)} maps in ${String(paths.length)} files, all up to date.`,
  );
}
