# `placeTemplates`

`placeTemplates({ templates, distance? })` is a step that places [templates](../generators/forest.md#templates-in-forests): ruins, camps, boss arenas. `templates` is a list of the same `RoomTemplate` objects as the dungeons take, with no exits, `positions` or `areas`. A template with `clearing: true` is centered on a free clearing from the `clearings` of the state, or gets a clearing of its own at a random spot, and any other template goes to a random spot and leaves the trees round it. `Floor` and `Wall` cells are stamped as `Tile.Floor` and `Tile.Wall` (so they are not prunable), and `Unused` cells leave the map as it is. Run it after `plantTrees` and after the steps that lay roads, water and clearings. Every template is checked when the step is made, and a bad one throws a `RangeError` at once; a template bigger than the map throws a `TemplatePlacementError` from `pipeline` before the first attempt, with no retry.

```ts
const { grid, templates } = pipeline(
  emptyMap({ width: 120, height: 80, tile: Tile.Grass }),
  [
    plantTrees(),
    layRoads(),
    placeClearings({ clearings: [{ radiusX: { min: 8, max: 8 } }] }),
    placeTemplates({ templates: [ruin] }),
  ],
  { random: mulberry32(42) },
);
```

- **Free ground.** A cell of a template, other than an `Unused` one, goes only on a free tile (see [`MapState`](../composing.md#mapstate)): one that holds the base tile or is prunable (untouched ground or ground cover) and is not reserved. A road, a path, water, a bridge or another template is never covered, and neither is a tile that any step of your own has stamped. A `clearing` template on a clearing that a road runs through finds no room there, and so makes a clearing of its own.
- **Own clearing.** The box of the template is free of trees, and the trees thicken over its `margin` beyond the box, with the ramp of a [verge](../composing.md#verges-and-pruneverge) that has a falloff of `margin` and no clearance. `distance` (default `'chebyshev'`) says how that is measured. The template's `clearing`, `chance`, `margin`, `count`, `rotate` and `mirror` fields work as described under [Templates in forests](../generators/forest.md#templates-in-forests).
- **Reads** `clearings`, optionally: a clearing holds one template at most, and the clearing is never grown.
- **Adds** `templates`: for each template that was placed, in the order of the list and of its copies, `template` (the index in `templates`), the box it fills (`x`, `y`, `width`, `height`), `rotation`, `mirrored`, `clearing` (the index in the `clearings` extra, left out for a template placed anywhere or on a clearing of its own) and `ownClearing`.
- **Retries.** A copy that finds no spot throws a `TemplatePlacementError`, and `pipeline` builds the map again, up to `attempts` times, before it throws the last error. A template bigger than the map is `permanent` and is thrown at once.

## Example map

The map this code makes with seed 1 (`mulberry32` is defined in the [quick start](../../README.md#quick-start)):

<!-- map: place-templates -->

```ts
import {
  emptyMap,
  pipeline,
  TemplateCell,
  Tile,
  plantTrees,
  placeTemplates,
} from 'angstloch';

const { Unused: _, Floor: F, Wall: W } = TemplateCell;

const result = pipeline(
  emptyMap({ width: 80, height: 25, tile: Tile.Grass }),
  [
    plantTrees(),
    placeTemplates({
      templates: [
        {
          name: 'ruin',
          cells: [
            [_, _, W, W, W, _, _],
            [_, W, F, F, F, W, _],
            [W, F, F, F, F, F, W],
            [W, F, F, F, F, F, W],
            [W, F, F, F, F, F, W],
            [_, W, W, F, W, W, _],
            [_, _, _, _, _, _, _],
          ],
          rotate: [0, 90, 180, 270],
          mirror: true,
        },
      ],
    }),
  ],
  { random: mulberry32(1) },
);
```

```text
""T""""""""""""""""""""T"""""T"T""""""""""""""""""""""""""""T"""""T"T"""""T""""T
""""""""""""""""T"""""""""""""""T"""T""""T"""""T""""""T"""""""""T"""T"T""""""T""
T""""""""""""""""""""""""""""""""""""""""""""T""T"""""""""""""T""""""T""""""""T"
"""""""""""""""T""""T""""""""""T""""T""""T""""""""T"T""""""""""T"""T""""""""TTT"
"""""""""""""""""""""""T""""""""""""""""""""T"T""""T"""""""""""""""""""T"""T""T"
"""""""""""""T"""""""""""""T"""""""""""""""""T""TT"""T"TT""""""""""""""""T""""""
"""""""""""""""""""""""""""T""""""""""""""""""""""""""T""""""""""""T""""T""T"T"T
""""""""""""""""""""""""""""""""T""""""""T""""""""""""T"""""""""""###"""""""""T"
""""""T""""""""T"T""""""""T""""T""""T"T"T"""T""""""""""""""""""T"#...#"""T"""T""
"""""""""T"""""""T""""""""""""""""T""""""""""TT""""""""T"T""""""#.....#"T""""T"T
"""""""""""TT"""""""""""""""""""""T"""""""""""TT""""""""""""""""#.....#T"TT"""""
""""""T""""""""""""""T"""""""""""""""""""""""T""T""T""""""""""""#.....#T"""""T"T
""TT""""""""""""""""T""""""""""T"""""""T"""""""""TT"""""""T""""""##.##""""T"""T"
"T""""""""""""""""""""""""""""""""T"""""""""""""""""T"""""""""""""""""""""""T"""
"""T"T"""""TTT""T"T"""""""""""""""""""""TT"""TT""""""""""""""""""""""""""""T"T""
""""""""T"""""""""""""""""""""""""""""""TT"""TT""T"""""T"T"""""""""""T""""""T"""
""""T"TT""""T"""""""""""""""""""""""T""""T"T"""""""T""T"""""""""""""""T"""""""""
""""T"""""T"T""""""T"T""""T"""""""T"T""""T"TT""""T""T"""T"""""""""""T"""""""""""
""""T"""T"T"""""T"""""T""""""""""""""""T"T""T"""T""""""""""T""""""""""T"""""T"T"
"""""""T""TTT"""T"""""""""T"""T""""""""""T""T""T"""T"""""T"""""""""""""""T""""""
"""""""TT"T"T"""""TT""""""T""""""""T""""""""T""""""T"T""""""""""""""""""""""""""
T"""""""""""""TT"""""""""""T"""""""""""T"""""T""""T"TT"""""""""""""""""""""T""""
""""""""T""""T""""""""TT"T"T""""""""T"T""""""""T""""T"""T"""""""""""""""""""""""
"""""""""""""""""T""T""""""""""T""""""""T"""T""""T""""""""""""""""""""""""""T"T"
""""T"""""""T""TT""""T""""""""""""""""""""T""""""T""""""""""""""""""""""""""""""
```

<!-- /map -->
