# `layFootbridges`

`layFootbridges(options?)` is a step that lays footbridges across the streams: one tile wide and square to the stream, as a staircase of tiles that touch along edges where the stream runs at a slant. It first joins the large pieces of land that the water cuts apart (a stream at least 2 tiles wide cuts the land, a 1-wide one is waded; pieces under 20 tiles stay islands), nearest first, so that the walkable land is one piece, and then adds footbridges until the map has `minimum` bridges. It is an opt-in step: a stream through a cave gets none unless you ask. Every option is checked when the step is made, and a bad one throws a `RangeError` at once.

```ts
const { grid, bridges } = pipeline(
  emptyMap({ width: 80, height: 50, tile: Tile.Grass }),
  [
    plantTrees(),
    layStreams({ width: { min: 2, max: 3 }, tributaries: { min: 1, max: 1 } }),
    layRoads(),
    layFootbridges({ minimum: 2 }),
  ],
  { random: mulberry32(42) },
);
```

- **Options.** `minimum` (default 0), the number of bridges the map has at least, counting the bridges of roads: footbridges are added across the streams, spaced 8 tiles apart along a row or a column, until it is reached, and fewer are laid when there is no room. A footbridge that joins land the water cuts apart is laid whatever `minimum` says. `bridgeTile` (default `Tile.Bridge`) is the tile it stamps; use the `bridgeTile` of `layRoads`.
- **Needs** `streams`, so it must come after `layStreams`. Run it after every step that lays roads or paths, since a road that bridges a stream makes a footbridge unnecessary.
- **Land.** A water tile that holds `bridgeTile` already, which is a bridge of a road, counts as land, and so do dry roads and trees. A stream with a `spring` has land round its source, so it needs none. A footbridge never lies on the edge of the map and is at most 2 tiles longer than its stream is wide. Land that no such footbridge can join stays apart.
- **Adds** `bridges` again, one point per group of bridge tiles, footbridges and the bridges of roads together, which replaces the list of `layRoads`.

## Example map

The map this code makes with seed 1 (`mulberry32` is defined in the [quick start](../../README.md#quick-start)), before and after `layFootbridges`:

<!-- map: lay-footbridges -->

```ts
import {
  emptyMap,
  pipeline,
  Tile,
  plantTrees,
  layStreams,
  layFootbridges,
} from 'angstloch';

const result = pipeline(
  emptyMap({ width: 38, height: 22, tile: Tile.Grass }),
  [
    plantTrees(),
    layStreams({ width: { min: 2, max: 3 } }),
    layFootbridges({ minimum: 2 }),
  ],
  { random: mulberry32(1) },
);
```

```text
before                                    after
""T""""""""""""""""""""T"""""T"~~~""""    ""T""""""""""""""""""""T"""""T"~~~""""
""""""""""""""""""""""T"""""""~~~"""""    """"""""""""""""""""""T"""""""%%%"""""
""""""""""""""""""""T"""""""""~~~"""T"    """"""""""""""""""""T"""""""""~~%"""T"
""T"""""""""""""""""T"""""""""~~""T"T"    ""T"""""""""""""""""T"""""""""~~""T"T"
"""""T"""""""""""T""""""""""~~~~""""""    """""T"""""""""""T""""""""""~~~~""""""
""""""""""""""""""""""""""""~~~~T"""""    """"""""""""""""""""""""""""~~~~T"""""
"""""""""""""""""""""""""""~~~""T""T"T    """""""""""""""""""""""""""~~~""T""T"T
"""""""""""""""T""""""""""~~~~"""""""T    """""""""""""""T""""""""""~~~~"""""""T
"""T""""""""TTT"""""""""""~~~"""""""""    """T""""""""TTT"""""""""""~~~"""""""""
"T"""""""""""T""""""""T""~~~""""""""""    "T"""""""""""T""""""""T""~~~""""""""""
"""""""""""T""""""""""T"~~~~"""""T""""    """""""""""T""""""""""T"~~~~"""""T""""
"""""""""T"T""""""""""""~~~"""T""""T"T    """""""""T"T""""""""""""~~~"""T""""T"T
"""""""""""""""""T""""""~~"""""""""""T    """""""""""""""""T""""""~~"""""""""""T
""""""""T"T""T""""""""""~~""""""""""""    """"""""T"T""T""""""""""~~""""""""""""
""T""""""""""""T""""T"""~~""""""""""""    ""T""""""""""""T""""T"""~~""""""""""""
"""""""""""""""""""T""T"~~""""""""""""    """""""""""""""""""T""T"%%""""""""""""
""""""T"""""T"TT""""""""~~""""T"""""""    """"""T"""""T"TT""""""""~~""""T"""""""
T"T""""""T"TT""""""TT"""~~""""""""""""    T"T""""""T"TT""""""TT"""~~""""""""""""
""""""""""""""""""TT""""~~~"""""""""""    """"""""""""""""""TT""""~~~"""""""""""
""T""""T"""""""T""""""T"~~~~""""""""""    ""T""""T"""""""T""""""T"~~~~""""""""""
"""""""""""""T"TTT"""""""~~~"""""""""T    """""""""""""T"TTT"""""""~~~"""""""""T
"T""""""""""TTT"""""T"""""~~~"""""""""    "T""""""""""TTT"""""T"""""~~~"""""""""
```

<!-- /map -->
