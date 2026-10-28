/**
 * Which tiles count as neighbors: `moore` is the 8 tiles around a tile,
 * `von-neumann` the 4 tiles that share an edge with it.
 */
export type CaveNeighborhood = 'moore' | 'von-neumann';
