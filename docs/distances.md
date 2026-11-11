# Walking distances

`measureDistances` measures the walk between every two places of a finished map, so that a game can put the stairs up and down far apart. It is a plain function, not a step: call it on the `grid` of any result. A place is a list of tiles: a room, a clearing, an exit, anything. The library only measures; which places to pick is up to the game. For the rooms of a result, [`measureRoomDistances`](#measureroomdistances) builds the places for you.

```ts
import { Tile, generateForest, measureDistances } from 'angstloch';

const { grid, clearings, exits } = generateForest({ width: 80, height: 50 });
const places = [...clearings.map(({ x, y }) => [{ x, y }]), exits]; // every exit as one place
const distances = measureDistances(grid, places, {
  costs: { [Tile.DeepWater]: 10 }, // the player may swim, slowly
});
distances[0]?.[clearings.length]; // the walk from the first clearing to the nearest exit, -1 if there is none
```

The result is a places by places matrix, `number[][]`: row `a`, column `b` holds the cheapest walk from the nearest tile of place `a` to the nearest tile of place `b`. It is 0 on the diagonal and between places that share a tile, and -1 where there is no way. The tiles of a place that cannot be entered (a wall in a room's box, say) are left out of it, and a place left with no tile has -1 everywhere, even to itself. A tile outside the grid throws a `RangeError`.

| Option   | Default       | Meaning                                                                                                                                                                                                                                                                                                                                                                 |
| -------- | ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `costs`  | see below     | The cost factor of entering a tile, per `Tile` value (`Partial<Record<Tile, number>>`): a positive number, or `Infinity` for a tile that cannot be entered. A given entry replaces the default for that tile only. A factor below 1 is fine, such as a road that is quicker to walk than grass. Anything else, or a key that is no `Tile` value, throws a `RangeError`. |
| `metric` | `'euclidean'` | How a step is measured (`DistanceMetric`): `'manhattan'` walks in 4 directions with steps of 1, `'chebyshev'` in 8 directions with steps of 1, and `'euclidean'` in 8 directions with diagonal steps of √2. The distance is the length of the walk along the tiles, never the straight line between the places. An unknown metric throws a `RangeError`.                |

By default `Wall` and `DeepWater` cannot be entered, and every other tile has a factor of 1, doors included. A step costs its length (1, or √2 for a euclidean diagonal) times the factor of the tile it enters, so distances may be fractional. A diagonal step may cut between two walls that touch at a corner, as in most roguelikes.

Since the tile a walk starts on is free and the one it enters last is charged, the walk from `a` to `b` and the one back differ when the tiles they end on have different factors; with the default costs the matrix is symmetric.

It runs one search from each place, from all its tiles at once (Dijkstra's, on a binary heap). On a dungeon of 80 by 50, a place takes about 0.1 ms, so 40 rooms take a few milliseconds.

## `measureRoomDistances`

`measureRoomDistances(result, options)` measures the walk between every two rooms of a finished map. It takes anything with a `grid` and `roomShapes`, the result of a generator or of [`pipeline`](composing.md#pipeline), and the options of `measureDistances` (`costs` and `metric`, with the same defaults). Each room's place is its floor from [`createRoomMap`](rooms.md#createroommap), so every room of every kind counts: ordinary and templated rooms, cells and guard rooms, halls without their pillars and caverns, never the rock or the walls in a room's box. The result is a rooms by rooms matrix indexed by room id, so row `a`, column `b` is the walk from `rooms[a]` to `rooms[b]`, with the rules of `measureDistances`: 0 on the diagonal, -1 where there is no way, and -1 everywhere for a room with no floor on the map.

```ts
import { generateRoomDungeon, measureRoomDistances } from 'angstloch';

const result = generateRoomDungeon({ width: 80, height: 50 });
const distances = measureRoomDistances(result, { metric: 'manhattan' });
distances[2]?.[5]; // the walk from room 2 to room 5, -1 if there is none
```

A game that wants the stairs far apart may, say, leave out the cells (`room.kind === 'cell'`), take the largest distance in the matrix, and draw a pair of rooms among those at least 70% as far.
