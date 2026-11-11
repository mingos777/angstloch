# `layRoads`

`layRoads(options?)` is a step that lays roads: a main road from one border to the opposite one, with the crossings and branches that [`RoadOptions`](../generators/forest.md#roads) ask for, or the exact `specs`. It paints road tiles over whatever is there and then clears the trees of its verge. Every option is checked when the step is made, and a bad one throws a `RangeError` at once.

```ts
const { grid, roads, bridges } = pipeline(
  emptyMap({ width: 80, height: 50, tile: Tile.Grass }),
  [
    plantTrees(),
    layStreams({ width: { min: 2, max: 3 }, tributaries: { min: 1, max: 1 } }),
    layRoads({
      width: { min: 3, max: 3 },
      crossings: { min: 1, max: 1 },
      clearance: 1,
      falloff: 2,
    }),
  ],
  { random: mulberry32(42) },
);
```

- **Options.** All the fields of the roads described under [Roads](../generators/forest.md#roads) (`angle`, `width`, `windiness`, `crossings`, `crossingAngle`, `branches`, `branchWidth`, `branchAngle`, `branchLength` and `specs`), with the same defaults, plus `roadTile` (default `Tile.Road`), `bridgeTile` (default `Tile.Bridge`), `bridgeAngle` (a `Range` of whole degrees from 1 to 179, default `{ min: 75, max: 90 }`, see below) and the verge, `clearance`, `falloff` and `distance` ([see above](../composing.md#verges-and-pruneverge)), which default to 0, 0 and `'chebyshev'`. The verge replaces `clearance`, `falloff` and `distance` of the forest.
- **Adds** `roads` (`{ kind, width, points }` for every road, crossing and branch, in the order they were laid), `junctions` (the tiles where roads meet), `exits` (the tiles where roads reach the border) and `bridges` (one point per group of bridge tiles).
- **Streams.** When the state has `streams` (an `layStreams` step ran before), a generated road is planned across them: it is bent to cross at `bridgeAngle`, straight and square to the stream for the length of the bridge, and a road tile over water becomes `bridgeTile` along that straight run. A road tile over water that is no part of a crossing gives way to the water: a road that clips a bank, or runs along a stream, does not make a bridge. The roads of `specs` are not bent. They are bridged where they span the water. Without `streams` the step works on dry land, and `bridgeAngle` has no effect.
- **Order.** `layStreams` must come before it. Put `plantTrees` first, so that the verge has trees to clear.
- **Diagnostics.** Through the `trace` option of [`pipeline`](../composing.md#pipeline) the step reports `trace('layRoads', { grown, plans })`: `grown`, the centerline of every generated road as it was grown, before the streams bent it, and `plans`, a `CrossingPlan` for every road that comes near a stream (its `start`, `end`, and for each crossing the `approach`, `entry`, `exit` and `departure` tiles, which are where the road turns onto and off the straight run, and where it reaches and leaves the water). Nothing is traced unless `trace` is given.
