# `plantTrees`

`plantTrees(options?)` is a step that plants ground cover. Noise decides how thick it is, and every tile that still holds the base tile gets the planted tile with that chance. Planted tiles are marked prunable, so a later step can clear a verge round what it lays. It adds no extras. Run it first: it plants only on untouched base tiles, so a step that runs before it gets no verge. Every option is checked when the step is made, and a bad one throws a `RangeError` at once.

It is general ground cover and not only trees: `tile` takes any `Tile` value, on any base. Rocks on dirt for a steppe are `emptyMap({ ..., tile: Tile.Floor })` with `plantTrees({ tile: Tile.Wall, density: { min: 0, max: 0.05 } })`. What a tile value looks like is up to your game, which maps the values to whatever it draws.

```ts
const { grid } = pipeline(
  emptyMap({ width: 80, height: 50, tile: Tile.Grass }),
  [plantTrees({ scaleX: 40, density: { min: 0, max: 0.25 } })],
  { random: mulberry32(42) },
);
```

| Option             | Default                 | Meaning                                                                                                                                                                                                                                                             |
| ------------------ | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `scaleX`, `scaleY` | 40                      | Size in tiles of a feature of the density noise along each axis, before rotation. Larger values make broader woods and glades.                                                                                                                                      |
| `rotation`         | 0                       | Clockwise rotation of the noise in degrees, which makes stretched woods run diagonally.                                                                                                                                                                             |
| `octaves`          | 1                       | Layers of the built-in noise, each finer than the one before. With 1, `persistence` and `lacunarity` have no effect.                                                                                                                                                |
| `persistence`      | 0.2                     | How much each layer counts against the one before it, from 0 to 1.                                                                                                                                                                                                  |
| `lacunarity`       | 1                       | How much finer each layer is than the one before it. 1 puts every layer at the same zoom.                                                                                                                                                                           |
| `noise`            | built-in simplex        | Your own [`NoiseFunction`](../noise.md) instead. The scales and the rotation apply to it, but the octave options do not, so wrap it in `createFractalNoise` for layers.                                                                                             |
| `density`          | `{ min: 0, max: 0.25 }` | The chance of planting a tile, as fractions from 0 to 1 (unlike other ranges, which are whole numbers): `min` where the noise is lowest, rising to `max` where it is highest. The default leaves the lowest parts bare and makes the thickest woods a quarter full. |
| `tile`             | `Tile.Tree`             | The tile to plant.                                                                                                                                                                                                                                                  |

The step draws one random number for every base tile, and the built-in noise is seeded from the same `random`.

## Example map

The map this code makes with seed 1 (`mulberry32` is defined in the [quick start](../../README.md#quick-start)):

<!-- map: plant-trees -->

```ts
import { emptyMap, pipeline, Tile, plantTrees } from 'angstloch';

const result = pipeline(
  emptyMap({ width: 80, height: 25, tile: Tile.Grass }),
  [plantTrees()],
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
""""""""""""""""""""""""""""""""T""""""""T""""""""""""T"""""""""""""""""""""""T"
""""""T""""""""T"T""""""""T""""T""""T"T"T"""T""""""""""""""""""T"""""""""T"""T""
"""""""""T"""""""T""""""""""""""""T""""""""""TT""""""""T"T""""""""""""""T""""T"T
"""""""""""TT"""""""""""""""""""""T"""""""""""TT"""""""""""""""""""""""T"TT"""""
""""""T""""""""""""""T"""""""""""""""""""""""T""T""T"""""""""""""""""""T"""""T"T
""TT""""""""""""""""T""""""""""T"""""""T"""""""""TT"""""""T"""""""""""""""T"""T"
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
