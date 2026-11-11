/** What `fillMapMarkers` made of a document. */
export interface FilledMapMarkers {
  /** The document with every known example written between its markers. */
  text: string;
  /** The names of the markers whose content changed, in the order they appear. */
  changed: string[];
  /** The names of all the markers, in the order they appear. */
  names: string[];
  /** One line per broken marker, starting with its line number: `12: ...`. */
  problems: string[];
}

const START = /^<!-- map: ([\w-]+) -->$/;
const END = '<!-- /map -->';

/**
 * Writes the examples into a Markdown document, between a `<!-- map: name -->`
 * line and the `<!-- /map -->` line after it, and leaves the rest of it alone.
 * `render` gives the Markdown of an example by name, or `undefined` for an
 * unknown one, which is a problem and keeps what sits between its markers.
 * Markers inside a fenced code block are text, not markers.
 */
export function fillMapMarkers(
  document: string,
  render: (name: string) => string | undefined,
): FilledMapMarkers {
  const lines = document.split('\n');
  const out: string[] = [];
  const changed: string[] = [];
  const names: string[] = [];
  const problems: string[] = [];
  let open: { name: string; line: number; body: string[] } | undefined;
  let fenced = false;

  lines.forEach((line, index) => {
    if (!open && line.startsWith('```')) {
      fenced = !fenced;
    }
    if (fenced) {
      out.push(line);
      return;
    }
    const start = START.exec(line);
    if (start) {
      if (open) {
        problems.push(
          `${String(index + 1)}: map ${start[1] ?? ''} starts inside map ${open.name}, which starts on line ${String(open.line)}.`,
        );
        out.push(...open.body);
      }
      out.push(line);
      open = { name: start[1] ?? '', line: index + 1, body: [] };
      names.push(open.name);
      return;
    }
    if (line === END) {
      if (!open) {
        problems.push(`${String(index + 1)}: ${END} closes no map.`);
        out.push(line);
        return;
      }
      const rendered = render(open.name);
      if (rendered === undefined) {
        problems.push(`${String(open.line)}: map ${open.name} is no example.`);
        out.push(...open.body);
      } else {
        const body = ['', ...rendered.trimEnd().split('\n'), ''];
        if (body.join('\n') !== open.body.join('\n')) {
          changed.push(open.name);
        }
        out.push(...body);
      }
      out.push(line);
      open = undefined;
      return;
    }
    if (open) {
      open.body.push(line);
    } else {
      out.push(line);
    }
  });

  if (open) {
    problems.push(
      `${String(open.line)}: map ${open.name} has no ${END} after it.`,
    );
    out.push(...open.body);
  }
  return { text: out.join('\n'), changed, names, problems };
}
