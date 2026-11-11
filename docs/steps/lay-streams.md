# `layStreams`

`layStreams(options?)` is a step that lays a stream or a river across the map: a main stream from one border to the opposite one (or from a spring), with shallow banks, deep water in the middle when it is wide enough, and optional tributaries. It paints over whatever is there, so it does not matter whether it runs before or after `plantTrees`, but only a `plantTrees` that ran before it lets it clear trees. A stream is a road made of water, so most options work like those of a [road](../generators/forest.md#roads) and are described in [Streams and rivers](../generators/forest.md#streams-and-rivers); the same fields are accepted here, apart from the bridges, which belong to the steps that lay them (`bridges` and `bridgeAngle` are not options of this step).

```ts
const { grid, streams } = pipeline(
  emptyMap({ width: 80, height: 50, tile: Tile.Grass }),
  [
    plantTrees(),
    layStreams({
      width: { min: 2, max: 3 },
      tributaries: { min: 1, max: 2 },
      clearance: 1,
      falloff: 3,
    }),
  ],
  { random: mulberry32(42) },
);
```

- **Options.** `angle`, `spring`, `width`, `windiness`, `shoreWidth`, `tributaries`, `tributaryWidth`, `tributaryAngle` and `tributaryLength` as in [Streams and rivers](../generators/forest.md#streams-and-rivers) with the same defaults; `shallowTile` (default `Tile.ShallowWater`) and `deepTile` (default `Tile.DeepWater`); and the verge kept clear of trees beside the water, `clearance`, `falloff` and `distance` ([see above](../composing.md#verges-and-pruneverge)), which default to 0, 0 and `'chebyshev'`, so trees grow right up to the water. The verge replaces `bankClearance` and `bankFalloff` of the forest. Every option is checked when the step is made.
- **Adds `streams`**: an array of roads, `{ kind, width, points }`, the main stream first and then the tributaries. The `points` run with the water: a tributary runs from its source to where it joins. Later steps (roads that cross the stream, footbridges, clearings on the water) work from this list alone.
- **Water tiles** are stamped over what is there, so they are not prunable, and the trees are cleared beside them by the verge.
- **Order.** It must come before the steps that lay roads, so that the roads can cross it. With `roads` already in the state it throws a `TypeError` at once, without retrying, since no other map would help.

## Example map

The map this code makes with seed 1 (`mulberry32` is defined in the [quick start](../../README.md#quick-start)):

<!-- map: lay-streams -->

```ts
import { emptyMap, pipeline, Tile, plantTrees, layStreams } from 'angstloch';

const result = pipeline(
  emptyMap({ width: 80, height: 25, tile: Tile.Grass }),
  [plantTrees(), layStreams()],
  { random: mulberry32(1) },
);
```

```text
""T""""""""""""""""""""T""~~~T"T""""""""""""""""""""""""""""T"""""T"T"""""T""""T
""""""""""""""""T"""""""""""~"""T"""T""""T"""""T""""""T"""""""""T"""T"T""""""T""
T"""""""""""""""""""""""""""~~~""""""""""""""T""T"""""""""""""T""""""T""""""""T"
"""""""""""""""T""""T"""""""""~~~"""T""""T""""""""T"T""""""""""T"""T""""""""TTT"
"""""""""""""""""""""""T""""""""~~~"""""""""T"T""""T"""""""""""""""""""T"""T""T"
"""""""""""""T"""""""""""""T""""""~~~""""""""T""TT"""T"TT""""""""""""""""T""""""
"""""""""""""""""""""""""""T""""""""~~~~""""""""""""""T""""""""""""T""""T""T"T"T
""""""""""""""""""""""""""""""""T""""""~~~""""""""""""T"""""""""""""""""""""""T"
""""""T""""""""T"T""""""""T""""T""""T"T"T~~~T""""""""""""""""""T"""""""""T"""T""
"""""""""T"""""""T""""""""""""""""T""""""""~"TT""""""""T"T""""""""""""""T""""T"T
"""""""""""TT"""""""""""""""""""""T""""""""~~"TT"""""""""""""""""""""""T"TT"""""
""""""T""""""""""""""T""""""""""""""""""""""~T""T""T"""""""""""""""""""T"""""T"T
""TT""""""""""""""""T""""""""""T"""""""T""""~""""TT"""""""T"""""""""""""""T"""T"
"T""""""""""""""""""""""""""""""""T"""""""""~~""""""T"""""""""""""""""""""""T"""
"""T"T"""""TTT""T"T"""""""""""""""""""""TT"""~T""""""""""""""""""""""""""""T"T""
""""""""T"""""""""""""""""""""""""""""""TT"""~T""T"""""T"T"""""""""""T""""""T"""
""""T"TT""""T"""""""""""""""""""""""T""""T"T"~~""""T""T"""""""""""""""T"""""""""
""""T"""""T"T""""""T"T""""T"""""""T"T""""T"TT"~~"T""T"""T"""""""""""T"""""""""""
""""T"""T"T"""""T"""""T""""""""""""""""T"T""T""~~~~""""""""T""""""""""T"""""T"T"
"""""""T""TTT"""T"""""""""T"""T""""""""""T""T""T""~~~~~~"T"""""""""""""""T""""""
"""""""TT"T"T"""""TT""""""T""""""""T""""""""T""""""T"T"~~~~"""""""""""""""""""""
T"""""""""""""TT"""""""""""T"""""""""""T"""""T""""T"TT""""~~~""""""""""""""T""""
""""""""T""""T""""""""TT"T"T""""""""T"T""""""""T""""T"""T"""~~""""""""""""""""""
"""""""""""""""""T""T""""""""""T""""""""T"""T""""T"""""""""""~""""""""""""""T"T"
""""T"""""""T""TT""""T""""""""""""""""""""T""""""T"""""""""""~~"""""""""""""""""
```

<!-- /map -->
