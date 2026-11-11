# `digNoiseCave`

`digNoiseCave(options?)` is a step that carves a cave by thresholding noise, as [`generateNoiseCave`](../generators/cave.md#noise-caves) does: the tiles with the lowest noise become wall and the rest floor, or with `shape: 'veins'` the floor follows the midpoint of the noise. Like `digCellularCave` it joins nothing, needs a map that starts as wall, takes `area` and `count`, and checks every option when it is made.

```ts
const { grid } = pipeline(
  emptyMap({ width: 80, height: 50, tile: Tile.Wall }),
  [digNoiseCave({ shape: 'veins', scaleX: 20, scaleY: 8, rotation: 30 })],
  { random: mulberry32(42) },
);
```

| Option           | Default       | Meaning                                                                                                                                             |
| ---------------- | ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `shape`          | `'blobs'`     | Which part of the noise becomes floor: `'blobs'` the high part, `'veins'` the part nearest the midpoint.                                            |
| `fill`           | 0.45          | The share of the tiles of the area that become wall, from 0 to 1. With `borderWalls` the border is walled on top of it.                             |
| `cornerBias`     | 4             | The distance in tiles from a corner of the area over which the walls are pulled in, a whole number. 0 turns it off.                                 |
| `scaleX`         | 12            | Size in tiles of a feature of the noise along the x axis, before rotation.                                                                          |
| `scaleY`         | 12            | Size in tiles of a feature of the noise along the y axis, before rotation.                                                                          |
| `rotation`       | 0             | Clockwise rotation of the noise in degrees.                                                                                                         |
| `octaves`        | 3             | Number of layers of the built-in noise.                                                                                                             |
| `persistence`    | 0.5           | How much each layer counts against the one before it, from 0 to 1.                                                                                  |
| `lacunarity`     | 2             | How much finer each layer is than the one before it.                                                                                                |
| `noise`          | simplex       | A `NoiseFunction` to use instead of the built-in noise. The scales and the rotation apply to it, the layers do not.                                 |
| `iterations`     | 0             | Number of passes of the cave automaton (4-5 rule on 8 neighbors) to smooth the thresholded noise with.                                              |
| `borderWalls`    | true          | As for `digCellularCave`.                                                                                                                           |
| `symmetry`       | `'none'`      | As for `digCellularCave`. A tile copies the noise at its twin.                                                                                      |
| `symmetryChance` | 1             | As for `digCellularCave`.                                                                                                                           |
| `minRegionSize`  | 0             | As for `digCellularCave`.                                                                                                                           |
| `largestOnly`    | false         | As for `digCellularCave`.                                                                                                                           |
| `area`           | the whole map | The size of the part of the map to carve the cave in, see [areas](../composing.md#areas). `fill`, `cornerBias` and `borderWalls` apply to the area. |
| `count`          | `{ 1, 1 }`    | How many caves to carve, each in an area of its own.                                                                                                |
| `placement`      | `'free'`      | As for `digCellularCave`.                                                                                                                           |
| `overlapShare`   | `{ 0, 1 }`    | As for `digCellularCave`, with `'overlap'` only.                                                                                                    |

- **One noise for the map.** The noise is made once per run and sampled where each tile is on the map, so two copies in two areas differ. With `placement: 'beside'` or `'overlap'` the cave is made before it has a spot, so its noise is sampled at a random spot of the map instead.
- **Laid over the map**, **placement**, **caverns** and **uses and adds** work as for [`digCellularCave`](dig-cellular-cave.md).
