# `layClearingPaths`

`layClearingPaths(options?)` is a step that lays the paths that clearings asked for. Every clearing that `placeClearings` made with a `path` gets one, from the nearest road tile (or from the nearest border when there are no roads) to its center. The path joins the road at a junction. It paints `roadTile` over free ground, which removes its trees, then clears the trees of its verge. A clearing that a road already runs through the center of needs no path and gets none. Every option is checked when the step is made, and a bad one throws a `RangeError` at once.

```ts
const { grid, roads } = pipeline(
  emptyMap({ width: 120, height: 80, tile: Tile.Grass }),
  [
    plantTrees(),
    layRoads(),
    placeClearings({
      clearings: [{ radiusX: { min: 8, max: 8 }, path: { width: 2 } }],
    }),
    placeTemplates({ templates: [ruin] }),
    layClearingPaths({ clearance: 1, falloff: 2 }),
  ],
  { random: mulberry32(42) },
);
```

- **Options.** `roadTile` (default `Tile.Road`) and `bridgeTile` (default `Tile.Bridge`), which should be those of `layRoads`, so that paths and roads look alike, and the verge, `clearance`, `falloff` and `distance` ([see above](../composing.md#verges-and-pruneverge)), which default to 0, 0 and `'chebyshev'`. The width and windiness of a path are those its clearing asked for.
- **Needs** `clearings`, so it must come after `placeClearings`.
- **Uses** `roads` (where a path starts, and what it joins), `templates` (where it stops) and `streams` (where it bridges), all optional. Run it after `placeTemplates`, so that it knows the templates, and before `layFootbridges`, which counts roads as land.
- **Templates.** A path to a clearing with a template stops at the tile before the first tile of the template's box that holds something other than ground or trees, so at the edge of its walls. A path that still runs through a template, which can happen to a path to another clearing, makes the step throw a `TemplatePlacementError` ("a road or path runs through it"), and `pipeline` builds the map again. With wide paths, mind that the brush of a path that stops at a template may touch its wall.
- **Water.** A path tile over water becomes `bridgeTile` where the path spans the water, joining the two pieces of land it cuts the map into, and stays water everywhere else, as for the generated roads of [`layRoads`](lay-roads.md) that are not planned.
- **Adds** `roads`, `junctions`, `exits` and `bridges` again, which replace those of `layRoads`: the same lists with the paths added. A path is a road of `kind: 'branch'` that comes after the roads that were there, in the order of the clearings. A path from the border adds an exit.
