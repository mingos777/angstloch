# `placeClearings`

`placeClearings({ clearings, spacing?, falloff?, distance? })` is a step that places clearings: glades with ragged edges, free of trees. It stamps nothing, since a clearing is ground, and removes the trees inside the ragged shape and across a falloff beyond it. Run it after `plantTrees`, so that there are trees to clear, and after `layStreams` and `layRoads`, which it reads. Every option is checked when the step is made, and a bad one throws a `RangeError` at once; a clearing whose center lies outside the map throws a `RangeError` too, from `pipeline` before the first attempt, since the step checks it in its `validate`.

```ts
const { clearings } = pipeline(
  emptyMap({ width: 80, height: 50, tile: Tile.Grass }),
  [
    plantTrees(),
    layRoads({
      branches: { min: 3, max: 3 },
      branchLength: { min: 20, max: 40 },
    }),
    placeClearings({
      clearings: [
        { radiusX: { min: 4, max: 7 }, roadDistance: { min: 8, max: 20 } },
        { at: 'branch-end', radiusX: { min: 3, max: 3 } },
      ],
      spacing: 2,
      falloff: 3,
    }),
  ],
  { random: mulberry32(42) },
);
```

- **`clearings`** is a list of `ClearingSpec`s, described under [Forests](../generators/forest.md): a center of its own (`x` and `y`), a random place within `roadDistance` of a road, or `at: 'branch-end'` or `at: 'stream'`; the radii as `Range`s, `angle`, `irregularity`, and `path`. A clearing that finds no room, or no branch end or stream, is left out. The ones `at: 'branch-end'` come last in the result and are never moved or dropped for overlapping.
- **`spacing`** (default 0) is how many tiles beyond their radii the clearings placed at random keep from each other.
- **`falloff`** (default 0) and **`distance`** (default `'chebyshev'`) are those of a [verge](../composing.md#verges-and-pruneverge), counted from the edge of the clearing. There is no `clearance`: the inside of a clearing is always bare.
- **Reads** `roads` (a random clearing keeps its `roadDistance` from the roads, and `at: 'branch-end'` takes the dead ends of branches that end inside the map, in the order the branches were laid) and `streams` (`at: 'stream'` is centered on a random tile of a stream's centerline, so the stream runs through it; the water stays water). Both are optional.
- **Adds** `clearings`: for each clearing that was made, `x`, `y`, `radiusX`, `radiusY` and `angle`, with the defaults filled in. A clearing that was asked to have a path, `path: true` or `path: { width, windiness }`, also carries `path: { width, windiness }` (defaults 1 and 0.3), which the step that lays paths to clearings reads. A clearing on a stream never has one.

## Example map

The map this code makes with seed 1 (`mulberry32` is defined in the [quick start](../../README.md#quick-start)):

<!-- map: place-clearings -->

```ts
import {
  emptyMap,
  pipeline,
  Tile,
  plantTrees,
  layRoads,
  placeClearings,
} from 'angstloch';

const result = pipeline(
  emptyMap({ width: 80, height: 25, tile: Tile.Grass }),
  [
    plantTrees({ density: { min: 0.3, max: 0.6 } }),
    layRoads(),
    placeClearings({
      clearings: [
        { radiusX: { min: 4, max: 7 } },
        { radiusX: { min: 4, max: 7 } },
      ],
    }),
  ],
  { random: mulberry32(1) },
);
```

```text
T"T""T""""""TT""=======T"""""T"T""T""""T""""T""TT"T""""T"""TT""TT""TTT"TT"T"""TT
T"""""T""""""T"TT"======="""""""T"T"T"T"TTTTT""TTT""T"TTT""T""""T""""TT"""T"TTT"
TT""""""TTT""""T"""=======""""T"""TTT"T"TT"""T"TTT"T"T"""TTTT"TT""""""""""TT""T"
TT""T"""""""T""TT"""========"T"T""""T"""TT"T""TT""T"T"TTTT""T"TT"""""""T""T"TTTT
""T""""""""T"""""T"""T========TT"T"TTT""TT""T"TT"""TT""T"""""""""""""""""TTTTTTT
""T"""T""""""T"""""T"T"============""TT"TT"TTTT"TTT"TT"TT"TT"""""""""""""TT"TT""
T"""T"T""""""T"""T"T"TT"T=================="""TTT""T""T""""T"T""""""""""TTTT"T"T
"""T"T"""T""T"""""""""""""T=================="""TTT"""T""T"TTT"""""""""TT"T"TTTT
"T"""TT"TT"""""T"TT"T""T"TT"""TT===============TTT"TT"""""T"""TT"""""""TTTTTTTTT
"T""T""""TT""T"""T"T"TT"TTT"T""TT"T"T"T"========"""T"T"TTT""""TT""""""""T""TTT"T
"""""T"""TTTT"TTTTT"T""T"T"""T"T""T"""""""=======""""TT"T""T"""""""T"""T"TTT"T""
TT""T"TT""TTT""TT"T"""""T"T"TTT""T""""T"""T"=======T"TT""T""T""T"""T"T"T""T"TT"T
"TTTT"T"""T"TT"""""TT""""""""TTTTTT""T"TT"T"T=======""""T"T""T""""""""""""T""TT"
"T"""T"T"TT"""T"T"""T""""""T""TT""T""TTT""TTT"===================T"TTTT""""TTT"T
TT"T"TT"""TTTT""T"""""""""""""""""""""""TT"""TT"===================""""T"TTT"T"T
"T"T""TTTTT"TT""""""""""""""""""""""T"""TTT""TT"T====================TTT""""T"""
""T"T"TT""T"T"""T"""""""""""T"""T""TTT"T"T"T"""T"""T"TTT"TTT""=======TTTTTT""T""
""""T"""""T"T""T""""""""""""""""""T"T""TTT"TT"T""T"TTTT"T""T""T"======T"TTT""TTT
""T"T""TT"T"""""T"""""""""""TT""""""TTTT"T""T"""T"TTT"T"TTTT"TT"""====="""T"T"TT
"""""T"TT"TTTT""TT"""""""""""TT"""T""T"""TTTTTTT""TT""""TT""T"""""====="TT""T""T
"TT""""TTTT"T"TTTT"""""""""""TT""T"TT"T""T""T"""T""TTT"""T"""T""T"T======"""T"T"
TTT"T"TTT"""T"TTT"""""""""""""""T""""""TT"TT"T"T""TTTTTT"""T""TT"T""======"TTT""
T"""TT""T""TTT"TT"TT"""""""""TT"""""TTT""""T"TTT"T""TT""TTTT"TT"""""======"""T""
"TT"""T""""""TTTTTTTT""T"TT"T"TT"""T"""TT"""TT"""T"T"TTTTT""T"""TT""""=======TTT
""""T"""""T"TT"TTTT""T"T""TT""""T"TT""T"T"T""TT"TTT""T""""TT"T""TTT""""========T
```

<!-- /map -->
