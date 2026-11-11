# Concepts

## Grid and tiles

Every generator returns a result object whose `grid` is a `Grid`: a flat `Uint8Array` of tiles with a few helpers.

```ts
grid.width; // number of columns
grid.height; // number of rows
grid.get(x, y); // the tile at the position; anything outside the grid is a Wall
grid.set(x, y, Tile.Floor); // throws a RangeError outside the grid
grid.inBounds(x, y);
grid.clone();
grid.toString(); // '#' wall, '.' floor, '+' door, '"' grass, 'T' tree, '=' road, '~' shallow water, '≈' deep water, '%' bridge, one line per row
```

Positions are plain `{ x, y }` objects (`Point`). `x` grows to the right and `y` grows downwards.

The numeric values of `Tile` are part of the public contract and never change; new kinds may be added.

| Tile                | Value | Meaning                                                                                                                           |
| ------------------- | ----- | --------------------------------------------------------------------------------------------------------------------------------- |
| `Tile.Wall`         | 0     | Solid rock.                                                                                                                       |
| `Tile.Floor`        | 1     | Passable floor.                                                                                                                   |
| `Tile.Door`         | 2     | A potential door placement. What to put there is yours.                                                                           |
| `Tile.Grass`        | 3     | Open ground of an outdoor map.                                                                                                    |
| `Tile.Tree`         | 4     | A tree. Whether it blocks movement or sight is yours.                                                                             |
| `Tile.Road`         | 5     | A road or a path. They differ only in how wide they are.                                                                          |
| `Tile.ShallowWater` | 6     | The banks of a stream: water that can be waded, at the cost of getting wet.                                                       |
| `Tile.DeepWater`    | 7     | The middle of a wide stream, where the current or the depth needs a swimmer. A game may treat both kinds of water as plain water. |
| `Tile.Bridge`       | 8     | A road where it crosses water.                                                                                                    |

## Options

Each generator is a function `generateX(options)` that takes a single options object. `width` and `height` are required, everything else is optional and has a documented default. A non-positive or non-integer dimension throws a `RangeError`, as does any other out-of-range option.

Generators are pure: they never mutate the options you pass in and keep no global state.

## Randomness and seeds

Every generator accepts `random`, a function returning a float in `[0, 1)` with the same contract as `Math.random`, which is the default. To get reproducible maps, pass the output of any seedable PRNG, such as the `mulberry32` of the [quick start](../README.md#quick-start):

```ts
import { generateMaze } from 'angstloch';

const { grid } = generateMaze({
  width: 41,
  height: 21,
  random: mulberry32(42),
});
```

The same options and the same random sequence always produce the same map.

## Ranges

Some options take a `Range`: an object `{ min, max }` of whole numbers, both ends inclusive. `{ min: 2, max: 2 }` means exactly 2.

## Attempts and failures

A map whose steps fail, such as a room template that finds no place, is built again from the start, up to 3 times in all, before the error is thrown. Every result reports `attempts`, how many times the map was built, and `failures`, one entry per failed attempt. See [`pipeline`](composing.md#pipeline).
