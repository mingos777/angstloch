/** Union-find over the nodes of a graph, numbered from 0. */
export function createRoots(nodes: number) {
  const parent = Array.from({ length: nodes }, (_, node) => node);
  const find = (node: number): number => {
    let at = node;
    while (parent[at] !== at) {
      at = parent[at] as number;
    }
    parent[node] = at;
    return at;
  };
  /** Joins the sets of two nodes, and tells whether they were apart. */
  const join = (a: number, b: number): boolean => {
    const [rootA, rootB] = [find(a), find(b)];
    parent[rootA] = rootB;
    return rootA !== rootB;
  };
  return { find, join };
}
