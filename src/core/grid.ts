import { assertDimensions } from './assert-dimensions';
import { Tile } from './tile';

const SYMBOLS: Record<Tile, string> = {
  [Tile.Wall]: '#',
  [Tile.Floor]: '.',
  [Tile.Door]: '+',
  [Tile.Grass]: '"',
  [Tile.Tree]: 'T',
};

/** A rectangular grid of tiles, stored row by row in a flat typed array. */
export class Grid {
  readonly width: number;
  readonly height: number;
  private readonly tiles: Uint8Array;

  constructor(width: number, height: number, fill: Tile = Tile.Wall) {
    assertDimensions(width, height);
    this.width = width;
    this.height = height;
    this.tiles = new Uint8Array(width * height).fill(fill);
  }

  inBounds(x: number, y: number): boolean {
    return x >= 0 && x < this.width && y >= 0 && y < this.height;
  }

  /** Returns the tile at the position. Anything outside the grid counts as a wall. */
  get(x: number, y: number): Tile {
    return this.inBounds(x, y)
      ? (this.tiles[y * this.width + x] as Tile)
      : Tile.Wall;
  }

  /** Sets the tile at the position. Throws a `RangeError` outside the grid. */
  set(x: number, y: number, tile: Tile): void {
    if (!this.inBounds(x, y)) {
      throw new RangeError(
        `position (${String(x)}, ${String(y)}) is outside the ${String(this.width)}x${String(this.height)} grid`,
      );
    }
    this.tiles[y * this.width + x] = tile;
  }

  clone(): Grid {
    const copy = new Grid(this.width, this.height);
    copy.tiles.set(this.tiles);
    return copy;
  }

  /** Renders the grid as text: `#` wall, `.` floor, `+` door, `"` grass, `T` tree. */
  toString(): string {
    const rows: string[] = [];
    for (let y = 0; y < this.height; ++y) {
      let row = '';
      for (let x = 0; x < this.width; ++x) {
        row += SYMBOLS[this.get(x, y)];
      }
      rows.push(row);
    }
    return rows.join('\n');
  }
}
