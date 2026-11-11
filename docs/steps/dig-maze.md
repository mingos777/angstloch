# `digMaze`

`digMaze(options?)` is a step that carves a maze with the recursive backtracker, as [`generateMaze`](../generators/maze.md) does, round whatever is there: it keeps off every tile that is not free (see [`isFree`](../composing.md#mapstate)), which is the rooms of [`placeMazeRooms`](place-maze-rooms.md), other reserved tiles, and the floor of the steps before it. It needs a map that starts as wall.

```ts
import {
  openExits,
  digMaze,
  emptyMap,
  openMazeRooms,
  pipeline,
  placeMazeRooms,
  Tile,
} from 'angstloch';

const start = { x: 31, y: 21 };
const { grid, rooms, roomExits, exits } = pipeline(
  emptyMap({ width: 61, height: 41, tile: Tile.Wall }),
  [
    placeMazeRooms({ roomCount: { min: 3, max: 5 }, keepClear: start }),
    digMaze({ loopChance: 0.2, start }),
    openMazeRooms({ doorChance: 0.5 }),
    openExits({ count: { min: 1, max: 2 }, lattice: true }),
  ],
  { random: mulberry32(42) },
);
```

| Option           | Default    | Meaning                                                                                                                                                                                           |
| ---------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `horizontalBias` | 0          | Weight of horizontal corridors against `verticalBias`, 0 or more. Only the ratio matters, so set both; a lone value against 0 means always.                                                       |
| `verticalBias`   | 0          | Weight of vertical corridors against `horizontalBias`, 0 or more.                                                                                                                                 |
| `loopChance`     | 0          | Chance of turning a dead end into a loop: 0 is a perfect maze, 1 a braid maze.                                                                                                                    |
| `fill`           | 1          | Fraction of the maze to carve, from 0 to 1. The part the start is in is always carved.                                                                                                            |
| `straight`       | 0          | Preference for continuing straight, from 0 to 1.                                                                                                                                                  |
| `pattern`        | `'none'`   | `'whirlpool'` twirls corridors around the middle of the maze, `'snowflake'` makes them radiate from it.                                                                                           |
| `patternChance`  | 1          | How strongly the pattern is enforced, from 0 to 1.                                                                                                                                                |
| `start`          | the middle | Where carving starts, `{ x, y }` in the coordinates of the map: a maze cell, with odd coordinates inside the map. Only for a maze on the whole map. Defaults to the free cell nearest the middle. |
| `area`           | the map    | The size of the box each maze goes in, an `AreaSpec` (see [Areas](../composing.md#areas)) of at least 3 a side, placed on the lattice: odd sizes at even coordinates.                             |
| `count`          | `{ 1, 1 }` | How many mazes to carve, each in its own box. More than one needs an `area` smaller than the map.                                                                                                 |

- **Parts.** Tiles that are not free can cut the maze into parts, such as a room across the map. Each part is carved in turn, the start's first, and the parts are not joined to each other: [`openMazeRooms`](open-maze-rooms.md) joins them through the rooms.
- **In an area.** A maze in a box keeps a wall frame inside the box, starts at the free cell nearest the middle of the box, and its pattern turns about the middle of the box. Its rooms do not yet land in its box (see [`placeMazeRooms`](place-maze-rooms.md)).
- **Errors.** A `start` that is not a maze cell, a `start` with an `area`, or an area below 3 throws a `RangeError` before the first attempt. A `start` that is not free, such as one a template covers, fails the attempt, which `pipeline` answers with a new map.
- **Reserves** nothing, so later steps may dig through the maze's walls.
- **Adds** `start`, the start of the first maze; none when `count` gives no maze.
