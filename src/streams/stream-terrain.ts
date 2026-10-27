/** What the roads need to know about the streams of a map, worked out once for all of them. */
export interface StreamTerrain {
  mapWidth: number;
  mapHeight: number;
  /** One byte per tile, row by row: 1 where there is water. */
  water: Uint8Array;
  /** The piece of land of every tile, numbered from 0, or -1 on water. The pieces are the land that the water cuts the map into, touching along edges. */
  pieces: Int32Array;
  /** The number of tiles of each piece of land. */
  sizes: number[];
  /** The pieces of land that lie across a single band of water from each piece. */
  neighbors: Map<number, Set<number>>;
  /** Every tile of the centerlines of the streams, once, with the way the stream runs there, in radians, its index and its width. */
  centers: {
    x: number;
    y: number;
    heading: number;
    stream: number;
    width: number;
  }[];
  /** The water grown by `radius` tiles: by a square a tile smaller, so that a road whose middle keeps off it never touches the water with a brush that reaches `radius - 1` tiles, and by a round shape beyond that, so that a road that goes round it bends smoothly. The tiles that a road's middle keeps off. */
  verge(radius: number): Uint8Array;
}
