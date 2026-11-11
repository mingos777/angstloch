/**
 * Checks the links of the Markdown docs (`README.md` and `docs/`) and lists
 * the broken ones: every relative link must point to a file that exists and,
 * when it has an anchor into a Markdown file, to a heading in it. Links with a
 * scheme (`https:`, `mailto:`) are not followed; links from the repository
 * root (`/docs/...`) are flagged, since the docs only use relative links.
 */
export interface DocsState {
  /** The Markdown files to check, keyed by their path from the repository root (`docs/steps/dig-veins.md`). */
  documents: Record<string, string>;
  /** Reads any file by its path from the repository root, or returns `undefined` when there is no such file. */
  readFile: (path: string) => string | undefined;
}

interface Link {
  line: number;
  target: string;
}

const FENCE = /^ {0,3}(`{3,}|~{3,})/;
const HEADING = /^ {0,3}(#{1,6})\s+(.*?)(?:\s+#+)?\s*$/;
const INLINE_LINK =
  /!?\[(?:[^[\]]|\[[^\]]*\])*\]\(\s*(<[^>]*>|[^\s)]+)(?:\s+(?:"[^"]*"|'[^']*'))?\s*\)/g;
const REFERENCE_DEFINITION = /^ {0,3}\[[^\]]+\]:\s*(<[^>]*>|\S+)/;
const HTML_ANCHOR = /<a\s[^>]*?\b(?:id|name)\s*=\s*["']([^"']+)["']/gi;
const CODE_SPAN = /(`+)[^`]*?\1/g;
const SCHEME = /^[a-z][a-z\d+.-]*:/i;

/** The lines of a Markdown text outside fenced code blocks, with their numbers (from 1). */
function findProseLines(text: string): { line: number; text: string }[] {
  const lines: { line: number; text: string }[] = [];
  let fence: string | undefined;
  text.split('\n').forEach((line, index) => {
    const match = FENCE.exec(line);
    if (fence === undefined) {
      if (match?.[1] !== undefined) {
        fence = match[1];
      } else {
        lines.push({ line: index + 1, text: line });
      }
    } else if (
      match?.[1] !== undefined &&
      match[1][0] === fence[0] &&
      match[1].length >= fence.length &&
      line.trim() === match[1]
    ) {
      fence = undefined;
    }
  });
  return lines;
}

/** The anchor GitHub gives a heading: lowercase, punctuation dropped, spaces turned into hyphens. */
function slugifyHeading(heading: string): string {
  return heading
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/<[^>]*>/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}\p{Pc} -]/gu, '')
    .replace(/ /g, '-');
}

/** Every anchor a Markdown text has: its headings (repeats numbered as GitHub does) and its HTML anchors. */
function findAnchors(text: string): Set<string> {
  const anchors = new Set<string>();
  const seen = new Map<string, number>();
  for (const { text: line } of findProseLines(text)) {
    const heading = HEADING.exec(line)?.[2];
    if (heading !== undefined) {
      const slug = slugifyHeading(heading);
      const count = seen.get(slug) ?? 0;
      seen.set(slug, count + 1);
      anchors.add(count === 0 ? slug : `${slug}-${String(count)}`);
    }
    for (const match of line.matchAll(HTML_ANCHOR)) {
      if (match[1] !== undefined) {
        anchors.add(match[1]);
      }
    }
  }
  return anchors;
}

function findLinks(text: string): Link[] {
  const links: Link[] = [];
  for (const { line, text: prose } of findProseLines(text)) {
    const bare = prose.replace(CODE_SPAN, (span) => ' '.repeat(span.length));
    const definition = REFERENCE_DEFINITION.exec(bare)?.[1];
    if (definition !== undefined) {
      links.push({ line, target: definition });
    }
    for (const match of bare.matchAll(INLINE_LINK)) {
      if (match[1] !== undefined) {
        links.push({ line, target: match[1] });
      }
    }
  }
  return links.map(({ line, target }) => ({
    line,
    target: target.replace(/^<(.*)>$/, '$1'),
  }));
}

/** Joins a relative path to the directory of `from`, or returns `undefined` when it leaves the repository. */
function resolvePath(from: string, path: string): string | undefined {
  const parts = from.split('/').slice(0, -1);
  for (const part of path.split('/')) {
    if (part === '..') {
      if (parts.length === 0) {
        return undefined;
      }
      parts.pop();
    } else if (part !== '.' && part !== '') {
      parts.push(part);
    }
  }
  return parts.join('/');
}

function decode(text: string): string {
  try {
    return decodeURIComponent(text);
  } catch {
    return text;
  }
}

export function findDocsProblems(state: DocsState): string[] {
  const problems: string[] = [];
  const anchorCache = new Map<string, Set<string> | undefined>();

  function readAnchors(path: string): Set<string> | undefined {
    if (!anchorCache.has(path)) {
      const text = state.documents[path] ?? state.readFile(path);
      anchorCache.set(path, text === undefined ? undefined : findAnchors(text));
    }
    return anchorCache.get(path);
  }

  for (const [document, text] of Object.entries(state.documents)) {
    for (const { line, target } of findLinks(text)) {
      if (SCHEME.test(target)) {
        continue;
      }
      const where = `${document}:${String(line)}: ${target}`;
      if (target.startsWith('/')) {
        problems.push(`${where} starts at the root; use a relative link.`);
        continue;
      }
      const hash = target.indexOf('#');
      const path = decode(hash === -1 ? target : target.slice(0, hash));
      const anchor = hash === -1 ? undefined : decode(target.slice(hash + 1));
      const file = path === '' ? document : resolvePath(document, path);
      if (file === undefined) {
        problems.push(`${where} leads out of the repository.`);
        continue;
      }
      const isMarkdown = file.endsWith('.md');
      const exists =
        file in state.documents ||
        (isMarkdown
          ? readAnchors(file) !== undefined
          : state.readFile(file) !== undefined);
      if (!exists) {
        problems.push(`${where} points to ${file}, which does not exist.`);
      } else if (
        anchor !== undefined &&
        anchor !== '' &&
        isMarkdown &&
        readAnchors(file)?.has(anchor) !== true
      ) {
        problems.push(`${where} points to no heading in ${file}.`);
      }
    }
  }
  return problems;
}
