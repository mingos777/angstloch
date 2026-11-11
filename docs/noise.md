# Noise

Noise is a smooth, random-looking landscape of values: neighboring positions get similar values, so it forms hills and valleys, not static. It is the basis of outdoor maps, where it can say how dense the trees are or how high the ground is.

```ts
import {
  createFractalNoise,
  createSimplexNoise,
  transformNoise,
} from 'angstloch';

const noise = transformNoise(
  createFractalNoise(createSimplexNoise(random), { octaves: 2 }),
  { scaleX: 60, scaleY: 20, rotation: 30 },
);
const height = noise(x, y); // x and y are tile positions
```

A `NoiseFunction` is `(x, y) => number`. It returns a float from -1 to 1 for any position, including negative ones, and the same position always gives the same value. Positions are in noise units, not tiles: the noise has features about one unit wide, so tile coordinates have to be divided by a number to zoom the noise to a useful size. `transformNoise` does that, and can stretch and turn the noise as well. Generators that take a noise function treat it this way too, and apply the transform to it. You can pass any function with that shape, such as one from another noise library.

- `createSimplexNoise(random?)` creates 2D simplex noise. The `Random` shuffles the table that the noise is built from, so a given random source always gives the same landscape and another one gives a different landscape. The random source is not used when the noise is sampled. It defaults to `Math.random`. The values are spread over almost the whole range from -1 to 1 and average out around 0.
- `createFractalNoise(noise, options?)` adds layers of `noise` together, each finer and weaker than the one before, so there is fine detail on top of broad shapes. The result stays within -1 and 1.

| Option        | Default | Meaning                                                                                                       |
| ------------- | ------- | ------------------------------------------------------------------------------------------------------------- |
| `octaves`     | 3       | Number of layers. 1 is the plain noise. A whole number, 1 or more.                                            |
| `persistence` | 0.5     | How much each layer counts against the one before it, from 0 (only the first layer) to 1 (all layers alike).  |
| `lacunarity`  | 2       | How much finer each layer is than the one before it: its positions are multiplied by this. A positive number. |

Invalid `FractalNoiseOptions` throw a `RangeError`.

- `transformNoise(noise, options?)` turns noise into a function of tile positions. A position is rotated clockwise about the origin (the top-left corner of the map, with y growing downwards) and then divided by the scales along the rotated axes.

| Option     | Default | Meaning                                                                          |
| ---------- | ------- | -------------------------------------------------------------------------------- |
| `scaleX`   | 1       | Size in tiles of a feature along the x axis, before rotation. A positive number. |
| `scaleY`   | 1       | Size in tiles of a feature along the y axis, before rotation. A positive number. |
| `rotation` | 0       | Clockwise rotation in degrees, any number. The stretched axes turn with it.      |

Different scales stretch the shapes: with `scaleX: 80` and `scaleY: 20` they are four times as long as they are wide, and they run left to right. A `rotation` of 90 makes them run top to bottom, and 45 makes them run diagonally, down and to the right. Positions are rotated before they are scaled, so the shapes turn without being sheared. Rotating about the origin only changes which part of the endless noise is seen, and the seed already decides that. An invalid scale or a rotation that is not a finite number throws a `RangeError`.
