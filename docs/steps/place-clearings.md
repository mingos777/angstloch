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
