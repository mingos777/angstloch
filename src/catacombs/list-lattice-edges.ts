import type { Lattice, LatticeEdge } from './lattice';

/** Every edge of a lattice, between each two nodes next to each other along a row or a column: the edges along the rows first, then those along the columns. */
export function listLatticeEdges({ columns, rows }: Lattice): LatticeEdge[] {
  const edges: LatticeEdge[] = [];
  rows.forEach((row, r) => {
    columns.slice(1).forEach((right, c) => {
      const left = columns[c];
      if (!left) {
        return;
      }
      edges.push({
        from: r * columns.length + c,
        to: r * columns.length + c + 1,
        line: row,
        horizontal: true,
        between: {
          x: left.start + left.width,
          y: row.start,
          width: right.start - left.start - left.width,
          height: row.width,
        },
        span: {
          x: left.start,
          y: row.start,
          width: right.start + right.width - left.start,
          height: row.width,
        },
      });
    });
  });
  columns.forEach((column, c) => {
    rows.slice(1).forEach((bottom, r) => {
      const top = rows[r];
      if (!top) {
        return;
      }
      edges.push({
        from: r * columns.length + c,
        to: (r + 1) * columns.length + c,
        line: column,
        horizontal: false,
        between: {
          x: column.start,
          y: top.start + top.width,
          width: column.width,
          height: bottom.start - top.start - top.width,
        },
        span: {
          x: column.start,
          y: top.start,
          width: column.width,
          height: bottom.start + bottom.width - top.start,
        },
      });
    });
  });
  return edges;
}
