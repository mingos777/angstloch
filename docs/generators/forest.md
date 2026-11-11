# Forests

```ts
import { generateForest } from 'angstloch';

const { grid } = generateForest({ width: 120, height: 70 });
console.log(grid.toString());
```

A forest is made from a [noise](../noise.md) map that says how dense the trees are: dense where the noise is high and open where it is low. Every tile then gets a tree with the chance that the map gives it. So a wood is a place where trees are likely, not a solid block, and its edge is ragged. Trees are `Tile.Tree` and the ground between them is `Tile.Grass`. Whether a tree blocks movement or sight is for the game to decide; the generator makes no connectivity guarantee.

`generateForest` is a ready-made composition of the [steps](../composing.md) of this library, and its options are nested, one key for each step: `trees` for [`plantTrees`](../steps/plant-trees.md), `streams` for [`layStreams`](../steps/lay-streams.md), `roads` for [`layRoads`](../steps/lay-roads.md), `clearings` for [`placeClearings`](../steps/place-clearings.md), `templates` for [`placeTemplates`](../steps/place-templates.md) and `footbridges` for [`layFootbridges`](../steps/lay-footbridges.md). Each key holds the options of its step, so everything those sections say about a step is true of the key. A step whose key is missing is left out (`trees` is the exception: the trees are always planted, with the defaults when the key is missing). The steps run in this order:

1. `plantTrees` plants the trees over the grass.
2. `layStreams`, laid first, since a natural feature has priority.
3. `layRoads`, which bend to cross the streams.
4. `placeClearings` and 5. `placeTemplates`.
5. `layClearingPaths`, when a clearing asks for a path, with its options under `paths`.
6. `layFootbridges`, when there are `streams`, unless `footbridges` is `false`.

Each step takes only its own options, with the defaults of that step; nothing passes from one key to another. So paths that should look like the roads get the same `roadTile`, `bridgeTile`, `clearance`, `falloff` and `distance` under `paths` as under `roads`.

Every step that lays something clears the trees from its own [verge](../composing.md#verges-and-pruneverge), so the trees fill in around roads, water and clearings. When a step throws, which happens to a template that finds no room, the forest is built again from the start, up to 3 times in all, and only then is the error thrown; see [`pipeline`](../composing.md#pipeline). The result reports `attempts` and `failures`. For a forest that is not this composition, run the steps yourself with `pipeline`, in any order they allow: that is what this function does.

The chance of a tree is set at the two ends of the noise: `trees.density` is a `Range` of fractions, `min` where the noise is at its lowest and `max` where it is at its highest. In between the chance rises evenly with the noise. With the defaults, 0 and 0.25, the lowest parts are bare and the thickest woods are a quarter full of trees, so the trees stand apart. Raise `max` for tighter woods: 1 packs the thickest parts solid. Both can be anything from 0 to 1, and `min` may be the larger of the two, which puts the trees where the noise is low. The noise is sampled at the center of each tile, and `random` both seeds the built-in noise and rolls the chance for each tile, so the same seed always gives the same forest. The noise rarely reaches the very ends of its range, so the chances rarely do either. There is no `density` in the result: count the trees, or sample the noise yourself.

## Roads

```ts
const { grid, roads, exits } = generateForest({
  width: 120,
  height: 70,
  roads: { angle: 20, width: { min: 3, max: 4 }, windiness: 0.5 },
});
```

Without `roads` the forest has no roads. With it, a main road runs through the forest from one edge of the map to the opposite one, and no trees grow on it: road tiles are `Tile.Road` (or `roadTile`). The trees are planted first and the roads laid over them, so the trees fill in around the roads.

The road is laid through a random point near the middle of the map, at the `angle`, and is then followed in both directions until it leaves the map. The angle is in degrees, clockwise from east, like `rotation`: 0 runs from left to right, 90 from top to bottom and 45 from the top left towards the bottom right. `'random'` picks an angle. The road winds as far as `windiness` says: its centerline is pushed to either side by smooth noise, which makes gentle bends and not jitter. At 1 it strays up to 12 tiles from the straight line. Its width is picked from the `width` range, in whole tiles, and the road is rounded at its edges when it is wide. Where a road leaves the map, it is laid as if it went on a little past the border, so the border cuts it at the angle it leaves at instead of ending it in a block; a road that leaves at a shallow angle tapers along the edge. Its centerline in `roads` and its tile in `exits` stay on the map.

| Road option | Default              | Meaning                                                                                           |
| ----------- | -------------------- | ------------------------------------------------------------------------------------------------- |
| `angle`     | `'random'`           | Direction of the main road in degrees, clockwise from east, or `'random'`.                        |
| `width`     | `{ min: 3, max: 3 }` | Width of the main road, and of the crossings, in tiles, a `Range` of whole numbers of at least 1. |
| `windiness` | 0.3                  | How much every road winds, from 0 (straight) to 1.                                                |

An invalid angle, width or windiness throws a `RangeError`.

### Clearance, falloff and distance

By default the trees grow right up to the road, which can look like a hedge. The [verge](../composing.md#verges-and-pruneverge) of `roads` keeps a strip beside every road free of trees: the main road, the crossings and the branches. The paths to clearings have a verge of their own, under `paths`. It has three fields, `clearance`, `falloff` and `distance`, which sit among the options of `roads`:

```ts
generateForest({
  width: 120,
  height: 70,
  roads: { clearance: 1, falloff: 3, distance: 'euclidean' },
});
```

- `clearance` is a number of tiles, 0 by default. No tree grows within `clearance` tiles of a road tile, in any direction. With the default `distance`, a step to a diagonal neighbor counts as one tile, so a clearance of 1 keeps trees off all eight neighbors of every road tile, diagonals included, and a clearance of 2 clears a strip two tiles wide on either side. The strip has a hard edge: beyond it the trees grow as thick as they would have anyway.
- `falloff` softens that edge: beyond the clear strip, the trees thicken gradually until they are at full density again. It is a number of tiles, 0 by default, and the chance of a tree grows in equal steps over them, so with a `falloff` of 3 the first tile past the clearance has a quarter of its chance, the next half, the next three quarters, and the one after that all of it. The two are independent: a `falloff` with a `clearance` of 0 thins the trees right next to the road, and a `clearance` with no `falloff` is the hard strip.
- `distance` says how the distance to a road is measured: `'chebyshev'` (the default) counts a diagonal step as one tile, which makes square verges; `'manhattan'` counts only orthogonal steps, which makes diamonds and suits games where diagonal movement is not possible; `'euclidean'` measures the straight line between tile centers, so a diagonal step is about 1.41 tiles, which makes round verges and a continuous falloff.

The verges of the other features are those of their steps, each with its own values: `streams` has the same three fields for the banks (see [Banks](#banks)), `clearings` has `falloff` and `distance`, since a clearing is bare inside its edge (see [Clearings](#clearings)), and `templates` has a `distance` for the `margin` of its templates. Where two verges overlap, slightly more is cleared than either alone would. A `clearance` or `falloff` that is not a whole number of at least 0, or a `distance` that is not one of the three, throws a `RangeError`.

### Clearings

`clearings` makes glades: patches with no trees, a good place for a camp, a hut or a hamlet. Each clearing is a `ClearingSpec`. It has a center of its own, so the caller decides where it goes, or it leaves the center out and is placed at random, or it is placed at the end of a branch (see [below](#clearings-at-branch-ends)) or on a stream (see [Clearings on a stream](#clearings-on-a-stream)):

```ts
const { grid, clearings } = generateForest({
  width: 120,
  height: 80,
  clearings: {
    clearings: [
      {
        x: 60,
        y: 40,
        radiusX: { min: 12, max: 12 },
        radiusY: { min: 7, max: 7 },
        angle: 30,
      },
      { x: 20, y: 15, radiusX: { min: 4, max: 4 }, irregularity: 0.8 },
      { radiusX: { min: 3, max: 6 } }, // placed at random, radius 3 to 6
      { radiusX: { min: 4, max: 4 } },
    ],
    spacing: 2,
    falloff: 3,
  },
});
```

| Clearing option | Default               | Meaning                                                                                                                                                                                                                            |
| --------------- | --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `x`, `y`        |                       | The tile of the center, whole numbers inside the map. Required.                                                                                                                                                                    |
| `at`            | none                  | `'branch-end'` puts the clearing at the end of a branch, and `'stream'` on a stream, instead of giving it a center. See [Clearings at branch ends](#clearings-at-branch-ends) and [Clearings on a stream](#clearings-on-a-stream). |
| `radiusX`       |                       | The approximate radius in tiles along the x axis, before `angle`, a `Range` of whole numbers, 1 or more. One is picked at random. Required.                                                                                        |
| `radiusY`       | `radiusX`             | The approximate radius along the y axis, a `Range` like `radiusX`. Different radii make an oval.                                                                                                                                   |
| `angle`         | 0                     | Clockwise rotation of the oval in degrees, any number.                                                                                                                                                                             |
| `irregularity`  | 0.5                   | How ragged the edge is, from 0 (a plain oval) to 1 (very ragged).                                                                                                                                                                  |
| `roadDistance`  | `{ min: 8, max: 25 }` | How far from the nearest road tile a clearing placed at random lies, a `Range` of whole numbers, 0 or more. See below.                                                                                                             |
| `path`          | none                  | `true` or `{ width?, windiness? }` leads a path to the clearing. See [Paths to clearings](#paths-to-clearings).                                                                                                                    |

The edge is not a clean oval. Noise shifts every tile before its distance to the center is measured, so the edge bulges and pinches, and every clearing gets its own outline, even when they are given the same shape. The radii are the radii of the plain oval, and the ragged edge wanders around them, so the real size is only approximately what you asked for. A tile only belongs to the clearing if it joins the center through other tiles of the clearing, so a clearing is always one piece, with no detached specks of bare ground beyond its edge. The center is always part of the clearing, and the part that falls outside the map is cut off.

No tree grows in a clearing. Beyond its edge the `falloff` of `clearings` thins the trees out, measured with its `distance`, as the falloff of a [verge](../composing.md#verges-and-pruneverge) does beside a road. There is no `clearance`, since the inside of a clearing is always bare. A road that runs through a clearing stays a road. The noise of the clearings is separate from the noise that sets the density of the trees, so adding a clearing never changes where the woods are thick.

A clearing without a center is placed after the ones that have a center, in the order of the list. Its center is picked at random, with these rules: the whole plain oval stays inside the map, and it keeps away from every clearing placed before it by at least the sum of their larger radii, so the plain ovals do not overlap (the ragged edges can still touch). `spacing` (an option of `clearings`, next to the list) adds tiles to that distance: a whole number, default 0. It does not move clearings that have a center, and it does not apply to them. A clearing that finds no room after a number of tries, or that is too large for the map, is left out and no error is thrown, so the `clearings` in the result may be fewer than asked for, always in the order of the list. Random placement uses the `random` source, so the same seed gives the same places.

With roads, a clearing placed at random also keeps its `roadDistance` from the roads that are laid when it is placed: its center lies at least `min` and at most `max` tiles from the nearest road tile, measured with `distance`. The default range of 8 to 25 puts it near enough to reach but off the road. When no tile on the map fits, the clearing is left out, as above. `roadDistance` does nothing without roads, and for a clearing with a center of its own. Paths to clearings are laid after all clearings are placed, so they do not count as roads for this distance.

### Clearings at branch ends

A road that ends in a clearing: give a clearing `at: 'branch-end'` and no `x` or `y`, and it is centered on the dead end of a [branch](#crossings-and-branches). It works best with a `branchLength`, which makes branches stop in the forest and not run to the border.

```ts
const { grid, clearings } = generateForest({
  width: 120,
  height: 80,
  roads: { branches: { min: 3, max: 3 }, branchLength: { min: 15, max: 30 } },
  clearings: {
    clearings: [
      { at: 'branch-end', radiusX: { min: 3, max: 6 } },
      { at: 'branch-end', radiusX: { min: 3, max: 6 } },
    ],
  },
});
```

- Each such clearing takes the next branch end, in the order the branches were laid, so two of them fill two dead ends. A clearing that finds no branch end is left out, with no error, so there may be fewer `clearings` than asked for. That is also the case without roads.
- Only the ends that lie inside the map count. A branch that runs to the border is an exit and gets no clearing, and neither do the [paths to clearings](#paths-to-clearings), which already end in a clearing.
- These clearings never keep away from others: `spacing` does not apply to them, and none is dropped for overlapping another. Two that touch merge into one bare patch, which suits several paths that lead to one glade.
- The `clearings` in the result list them after all the others, in the order of their branches.
- The other options (radii, `angle`, `irregularity`) work as for any clearing, and so do `falloff` and `distance`. `roadDistance` does nothing for them. A `path` does nothing either, since the center is on a road already.

An `at` that is not `'branch-end'` or `'stream'`, or one that comes with an `x` or `y`, throws a `RangeError`.

### Clearings on a stream

Streams often run through the middle of a meadow, and a clearing with `at: 'stream'` does the same: it is centered on a random tile of the centerline of a [stream](#streams-and-rivers), a tributary included.

```ts
const { grid, clearings } = generateForest({
  width: 120,
  height: 80,
  streams: { width: { min: 2, max: 3 } },
  clearings: { clearings: [{ at: 'stream', radiusX: { min: 5, max: 8 } }] },
});
```

- No tree grows in the clearing, as in any other, but the water in it stays water, so the stream flows through the glade, and the roads and bridges in it stay as they are.
- It is placed like a clearing at a random place: it keeps `spacing` tiles beyond the radii from the clearings placed before it, the whole plain oval stays inside the map, and the clearings are placed in the order of the list, after the ones with a center. A clearing that finds no room, or when there is no stream, is left out with no error.
- `roadDistance` does nothing for it, and neither does a `path`, since its center is in the water.

### Paths to clearings

A clearing can have a path: set `path` to `true`, or to `{ width, windiness }`. The path is a narrow track that starts at the nearest tile on the centerline of a road and ends in the center of the clearing. Without roads it starts at the nearest tile on the border of the map, so the clearing is reached from outside the map, and the tile on the border is one of the `exits`. Both ends are fixed, and the path winds gently in between, more with a higher `windiness`.

| Path option | Default | Meaning                                                |
| ----------- | ------- | ------------------------------------------------------ |
| `width`     | 1       | Width of the path in tiles, a whole number, 1 or more. |
| `windiness` | 0.3     | How much the path winds, from 0 (straight) to 1.       |

The path is a road of kind `'branch'` in `roads`, after the roads of the `roads` option and in the order of the clearings, so it shows up in `junctions` (where it meets a road) and in `exits` (where it reaches the border) like any branch. The paths are laid by [`layClearingPaths`](../steps/lay-clearing-paths.md) after the templates, with the `roadTile`, `bridgeTile` and verge of `paths`; give them the same values as `roads` for paths that look like the roads. This works with or without the `roads` option, and with clearings that have a center of their own as well as random ones. A later path may start at an earlier path if that is the nearest road. A path that stops at the template on its clearing, and a path that runs through another template, are described under [`layClearingPaths`](../steps/lay-clearing-paths.md). A clearing whose center is on a road already gets no path. A clearing that was left out gets none either. The default is no path, since a glade can just as well be in the middle of the forest with no way in.

A clearing with a center outside the map, an `x` or `y` that is not a whole number, only one of the two given, a radius that is not a `Range` of whole numbers of at least 1, an angle that is not finite, an `irregularity` outside 0 to 1, an invalid `roadDistance` range, or a path with a `width` that is not a whole number of at least 1 or a `windiness` outside 0 to 1 throws a `RangeError`.

### Crossings and branches

More roads can be attached to the main road, which makes a network. Every new road is laid on a place of a road that is there already, so the network is always joined up, and no road stands on its own.

- A **crossing** is a road that passes through a place on a road and runs on to both edges of the map, which makes a crossroads. It has the same `width` as the main road, and it meets the road at an angle picked from `crossingAngle`, turned to the left or to the right.
- A **branch** is a thinner path that leaves a road at a place on it and goes on one side only, so it forks away from the road. It leaves at an angle picked from `branchAngle` to the road, along it or against it. It has a width from `branchWidth` and a length from `branchLength`. A branch with no `branchLength` runs to the edge of the map. A branch that is not long enough to get there ends in the forest, which is a good place for a clearing, a camp or a hut. A branch may leave a crossing or another branch, and a crossing may cross a branch.

Crossings are laid first and branches after them. A place on a road is chosen at random, but never close to the ends of the road or to a junction, so roads do not pile up in one spot, and longer roads are more likely to be chosen. When the map is too small to find such a place, fewer roads are made than asked for, and no error is thrown. Each road winds with its own pattern of bends, at the same `windiness`.

| Road option     | Default                | Meaning                                                                                                                          |
| --------------- | ---------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `crossings`     | none                   | Number of crossings, a `Range` of whole numbers, 0 or more.                                                                      |
| `crossingAngle` | `{ min: 45, max: 90 }` | The angle in whole degrees, 1 to 179, at which a crossing meets the road. 90 is a right angle.                                   |
| `branches`      | none                   | Number of branches, a `Range` of whole numbers, 0 or more.                                                                       |
| `branchWidth`   | `{ min: 1, max: 1 }`   | Width of a branch in tiles, a `Range` of whole numbers of at least 1.                                                            |
| `branchAngle`   | `{ min: 20, max: 70 }` | Fishbone only. The angle in whole degrees, 1 to 179, between a branch and the road it leaves. A small angle makes a gentle fork. |
| `branchLength`  | to the edge            | Length of a branch in tiles, a `Range` of whole numbers of at least 1.                                                           |

The result lists every road, in the order they were laid: the main road, then the crossings (all of kind `'road'`), then the branches (kind `'branch'`). `junctions` lists the places where roads meet, and not only the ones that were planned: wherever the centerlines of two roads touch, that is a junction too, and where two roads share a stretch of tiles it counts as one junction, at the first of them. `exits` lists the places where roads reach the border. A branch that ends in the forest has no exit. An invalid range or an angle outside 1 to 179 throws a `RangeError`.

### Exact roads

For full control, `specs` lists the roads one by one. When it is given, it replaces the generated network: `angle`, `width`, `crossings`, `crossingAngle`, `branches`, `branchWidth`, `branchAngle` and `branchLength` are ignored, and `windiness` is only the default of the entries. An empty list lays no roads. The roads are laid in the order of the list, and the result lists them in that order.

```ts
const { grid, roads } = generateForest({
  width: 100,
  height: 70,
  roads: {
    specs: [
      { origin: { x: 50, y: 35 }, angle: 0, width: 3 }, // 0: the main road
      { parent: 0, at: 0.3, angle: 90 }, // 1: a crossing at 30% of the main road
      { kind: 'branch', parent: 1, at: 0.7, length: 20 }, // 2: a branch off the crossing
      { kind: 'branch', origin: { x: 5, y: 5 }, to: { x: 40, y: 30 } }, // 3: a path between two points
    ],
  },
});
```

| Entry field | Default                                | Meaning                                                                                                                         |
| ----------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `kind`      | `'road'`                               | A `'road'` passes through its start in both directions. A `'branch'` leaves it in one.                                          |
| `width`     | 3 for a road, 1 for a branch           | Width in tiles, a whole number, 1 or more.                                                                                      |
| `windiness` | `windiness` of the road options        | How much this road winds, from 0 to 1.                                                                                          |
| `parent`    | none                                   | The index of an earlier entry. The road starts at a tile of that road, and the two make a junction.                             |
| `at`        | 0.5                                    | Where along the parent the road starts, from 0 (its first tile) to 1 (its last).                                                |
| `origin`    | a random point near the middle         | Where a free-standing road starts or passes, in tiles. Ignored with a `parent`.                                                 |
| `angle`     | random, or a right angle to the parent | Direction in degrees, clockwise from east. Ignored with `to`.                                                                   |
| `length`    | to the edge                            | The most tiles a branch runs. Ignored with `to`.                                                                                |
| `to`        | none                                   | Where the road ends, in tiles. The road then runs from its start to this point and ends there. Needs an `origin` or a `parent`. |

Placement is best effort and never an error: an `origin` or `to` outside the map is moved onto it, a road runs only as far as the map goes, and a winding road strays a little from its straight line. A `parent` that is not the index of an earlier entry, a `width` or `length` that is not a whole number of at least 1, a `windiness` or `at` outside 0 to 1, an angle or point that is not finite, an unknown `kind`, or a `to` with neither an `origin` nor a `parent` throws a `RangeError`.

## Streams and rivers

`streams` lays a stream through the forest, and a river is the same thing, only wider. A stream is a road made of water, so it winds like one and has a width in tiles. It is laid before the roads, as a natural feature has priority, and the roads then cross it:

```ts
const { grid, streams, bridges } = generateForest({
  width: 120,
  height: 70,
  streams: { width: { min: 3, max: 3 } },
  roads: { crossings: { min: 1, max: 2 } },
});
```

The stream runs from one border of the map to the opposite one through a point near the middle (or, with `spring`, rises at that point, see [below](#springs)), and the water flows the way of its `angle`, so the first point of its centerline in `streams` is upstream and the last is the mouth. Its banks are `Tile.ShallowWater`, which can be waded at the cost of getting wet. A stream wide enough has `Tile.DeepWater` in the middle, which a game may gate behind a swimming ability, or it may treat both as plain water. No tree grows in the water, and where a stream flows off the map there is no bank at the edge. Like a road, a stream goes on a little past the border, so the edge cuts it cleanly, deep water included.

| Stream option                      | Default                               | Meaning                                                                                                                                                                                                                                                                                                                                      |
| ---------------------------------- | ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `angle`                            | `'random'`                            | Direction of the flow in degrees, clockwise from east, so 0 flows left to right and 90 top to bottom. `'random'` picks one.                                                                                                                                                                                                                  |
| `width`                            | `{ min: 1, max: 2 }`                  | Width in tiles, a `Range` of whole numbers, 1 or more. A whole number in it is picked at random.                                                                                                                                                                                                                                             |
| `windiness`                        | 0.5                                   | How much the stream winds, from 0 (straight) to 1 (it may stray up to 12 tiles to either side of the straight line).                                                                                                                                                                                                                         |
| `shoreWidth`                       | 1                                     | How many tiles of shallow water the stream has on each side, a whole number, 0 or more. The rest, in the middle, is deep. A stream no wider than twice this has no deep water: with the default, widths 1 and 2 are all shallow and width 3 has a single band of deep water along its middle, and each extra tile of width widens that band. |
| `spring`                           | `false`                               | Whether the stream rises at a spring inside the map and flows from it to the edge, see [Springs](#springs).                                                                                                                                                                                                                                  |
| `shallowTile`, `deepTile`          | `Tile.ShallowWater`, `Tile.DeepWater` | The tiles of the shallow and the deep water.                                                                                                                                                                                                                                                                                                 |
| `clearance`, `falloff`, `distance` | 0, 0, `'chebyshev'`                   | The verge kept clear of trees beside the water, see [Banks](#banks).                                                                                                                                                                                                                                                                         |

The bridges are the business of the other steps: the angle at which roads meet the stream is `bridgeAngle` among the `roads` options, and the footbridges are the `footbridges` key (see [Bridges](#bridges) and [Footbridges](#footbridges)).

### Springs

With `spring: true` the stream does not run from edge to edge. It rises at a point near the middle of the map, the first point of its centerline in `streams`, and flows from there to the edge of the map the way of its `angle`, with no water upstream of the spring. The land can then be walked round it, so it needs no footbridge. Tributaries can join it as they join any stream.

### Tributaries

`tributaries` adds thinner streams that flow into the stream from the side. Each leaves a point of a stream, away from its ends and from the other confluences, and runs upstream, at an angle from `tributaryAngle` to the flow of the stream it joins, to either side, so the two meet at an acute angle as real streams do. A tributary may join another tributary. It runs to the edge of the map, or, with a `tributaryLength`, stops in the forest, which makes a spring.

| Stream option     | Default                | Meaning                                                                                                                   |
| ----------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `tributaries`     | none                   | How many tributaries, a `Range` of whole numbers, 0 or more. Fewer are made when the map is too small to place them.      |
| `tributaryWidth`  | `{ min: 1, max: 1 }`   | Width in tiles, a `Range` of whole numbers, 1 or more.                                                                    |
| `tributaryAngle`  | `{ min: 30, max: 60 }` | The angle in whole degrees, from 1 to 179, between a tributary and the flow of the stream it joins, as a `Range`.         |
| `tributaryLength` | to the edge            | The length in tiles, a `Range` of whole numbers, 1 or more. A tributary too short to reach the edge starts in the forest. |

In `streams` a tributary is a `Road` of `kind` `'branch'`, after the main stream, in the order they were laid, and its `points` run with the water: from its source to the tile where it joins the stream. Its water has the same banks and deep water as the stream's, and where it joins, the water of the two is one. Roads are planned across a tributary as they are across the stream, see [Bridges](#bridges).

### Banks

By default trees grow right up to the water, as they often do. The `clearance`, `falloff` and `distance` of `streams` thin them out beside it, exactly as those of `roads` do beside a road ([see above](#clearance-falloff-and-distance)), for the water of every stream and with their own values: `clearance` tiles are bare and the trees then thicken over `falloff` tiles. They default to 0, 0 and `'chebyshev'`, and `clearance` and `falloff` must be whole numbers of at least 0, or a `RangeError` is thrown.

### Bridges

Where a road meets water, the road wins: its tiles over the water become `Tile.Bridge`, as wide as the road, and the water under it is not shown. A generated road (the main road, the crossings and the branches of `roads`, which keep the `bridgeAngle` of `roads` and `bridgeTile`) is first grown as described above, and if it comes near water (within half its width and a tile of it), its way across the streams is planned and the road is laid again through the plan:

- **Ends.** An end on the edge of the map that lies in or beside the water slides along the edge to the nearest tile clear of it, preferably on the same side and on the land the road reaches first (within 30 tiles), so a road and a stream that leave the map at the same place do not overlap. An end on the edge may also slide up to 30 tiles along its side when that lets the road reach its first crossing, or leave its last one, with a gentler turn and leave the edge squarely, so the road's `angle` is a best effort near streams. An end inside the map, such as the start of a branch, does not move.
- **Route.** The road goes over the same land as it was grown over, crossing from each piece of land that the water cuts the map into to the next, a stream crossed back and forth only once. Where that means crossing a tributary and then the stream it joins, the road may instead cross the stream once below where the two meet, whichever turns the road less; a crossing of that kind is looked for within 20 tiles of the grown road only.
- **Crossings.** Each crossing is a straight bridge at an angle from `bridgeAngle` to the stream, never longer than the stream across allows, so it never runs along a stream, with 4 tiles of straight road on either bank (fewer near the edge of the map). Of the possible places, the one picked asks the road to turn least on its way to the bridge and on from it, lies near the road as grown (within 10 tiles if it can, then 20), away from the place where another stream joins, and over a single band of water, and the road must be able to get there over land without a long detour. No way of the road turns more sharply than about 6 degrees a tile where there is a gentler one.
- **Laying.** Between the waypoints (the ends of the road and both ends of the straight run onto each bridge) the road is laid as a smooth curve that winds by the road's `windiness`, as a grown road does, with the bends fading out at every waypoint so that every bridge is met square on. A road whose way was free at an end of the map arcs evenly into its first crossing. Every stretch keeps the middle of the road at least half its width and a tile from the water, so that the road never touches the water except on its bridges; never comes back within its width of itself; never runs along the edge of the map; and turns no more sharply than about 45 degrees over 9 tiles where a gentler curve keeps the other rules. Where no curve fits, because the road has to go round the end of a stream, say, it follows the shortest way round the water, near the straight line, off the edge of the map where it can be, and rounded off. A road that crosses no stream keeps its course and is laid again only where it came near the water, or from end to end when that would turn too sharply.

A road that cannot be planned is left as it was grown. The roads of `roads.specs` and the [paths to clearings](#paths-to-clearings) are not planned, since they are placed exactly, and they are bridged wherever they happen to span the stream. A planned road is a bridge over the whole width of its straight run onto each bridge, and touches no water anywhere else. Any other road over water that does not span it, because it clips a bank, runs along the bank of the stream or ends in it, gives way to the water: a group of bridge tiles is laid only when it joins two different pieces of land, those that the water cuts the map into. A bridge is as wide as the road that crosses: where the road is wider than the crossing line, the lanes at its sides are bridge too, not water.

### Footbridges

Footbridges join the land where water that a walker cannot step through cuts it apart. A stream that runs from edge to edge, and tributaries that reach the border, split the map into pieces, and the roads may not cross them all. So where the land (every tile that is not water, with roads and their bridges counting as land) falls into pieces, the nearest two are joined by a footbridge by the shortest crossing there is, and this is repeated until there is one piece. Only a stream at least 2 tiles wide cuts the land: even when it is all shallow, crossing it means wading. A stream 1 tile wide can be stepped through and never gets a footbridge of its own. A piece of land smaller than 20 tiles, such as a scrap cut off where a tributary and its stream leave the map side by side, stays an island and is not joined.

A footbridge is one tile of `Tile.Bridge` wide and goes square across the stream, so where the stream runs at a slant it is a staircase of tiles that touch along edges, which can be walked without diagonal steps. Where it cannot go square, it slants by up to 20 degrees. It is never longer than the stream is wide plus two tiles, so it never runs along a stream, and never lies on the edge of the map. Pieces that no such footbridge can join are left apart, which did not happen in 800 random maps with streams 2 to 4 tiles wide and up to four tributaries. Trees are taken to be passable, as the generator does elsewhere. A stream with a `spring` does not cut the land and needs none.

`footbridges` is on by default whenever there are `streams`, and `footbridges: false` turns it off, for a forest whose streams may cut the land. Its `minimum` (0 by default) asks for more: it is the least number of bridges the map has, roads included. If the roads and the footbridges that join the land make fewer, more footbridges are added, each across a stream at a random place, at least 8 tiles from another bridge. These may cross a stream of any width, 1 included, and go square across it as above. When there is no room, the map has fewer than `minimum`. Footbridges are not bent to `bridgeAngle`; that is for roads.

`bridges` in the result has one point for every bridge, footbridges included: a group of bridge tiles that touch along an edge, at the tile nearest to its middle. The roads and `junctions` are not changed by a bridge, and a stream never makes a junction.

`shallowTile` and `deepTile` of `streams` and the `bridgeTile` of `roads` and `footbridges` replace the tiles of the water and the bridge, for instance `Tile.Floor` for shallow water and `Tile.Wall` for deep water in a game that makes no distinction. Give the same `bridgeTile` to every step that has one.

A `minimum` that is not a whole number of at least 0, a `width`, `tributaryWidth` or `tributaryLength` that is not a `Range` of whole numbers of at least 1, `tributaries` that is not a `Range` of whole numbers of at least 0, a `tributaryAngle` that is not a `Range` of whole degrees from 1 to 179, a `windiness` outside 0 to 1, a `shoreWidth` that is not a whole number of at least 0, an `angle` that is not finite or `'random'`, a `bridgeAngle` that is not a `Range` of whole degrees from 1 to 179, or a `shallowTile`, `deepTile` or `bridgeTile` that is not a `Tile` value throws a `RangeError`.

## Templates in forests

Put a ruin, a camp or a boss arena in the forest with `templates: { templates }`, the options of [`placeTemplates`](../steps/place-templates.md): a list of the same [`RoomTemplate`](../room-templates.md) objects as the dungeons take. A forest has no tunnels, so a template has no exits: it is a design of `Floor`, `Wall` and `Unused` cells. A template with an `Exit`, `Door` or `OptionalExit` cell, or with `positions` or `areas`, throws a `RangeError`, as does an invalid `count`, `chance`, `margin` or `rotate`.

```ts
import { TemplateCell, generateForest, type RoomTemplate } from 'angstloch';

const { Unused: _, Floor: F, Wall: W } = TemplateCell;

const ruin: RoomTemplate = {
  name: 'ruin',
  cells: [
    [_, W, W, W, _],
    [W, F, F, F, W],
    [W, F, F, F, W],
    [W, F, F, F, W],
    [_, W, F, W, _],
  ],
  rotate: [0, 90, 180, 270],
  clearing: true,
  margin: 3,
};

const { grid, templates } = generateForest({
  width: 120,
  height: 80,
  roads: {},
  clearings: { clearings: [{ radiusX: { min: 8, max: 8 }, path: true }] },
  templates: { templates: [ruin] },
});
```

| Template field     | Default        | Meaning                                                                                                                                                                           |
| ------------------ | -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `clearing`         | `false`        | Whether the template needs a clearing. A template that does not goes to a random spot, and the trees stay round it and in its `Unused` cells.                                     |
| `chance`           | 1              | The chance that each copy is placed at all, from 0 to 1. With 1 every copy is placed, which is what a boss arena needs. With a lower chance it can happen that no copy is placed. |
| `margin`           | 0              | For a template on a clearing of its own: how many tiles beyond its box the trees take to thicken from none to full density, a whole number, 0 or more. See below.                 |
| `count`            | exactly 1      | Number of copies, a `Range` of at least 0. Each copy is rolled against `chance` on its own and goes on a clearing of its own.                                                     |
| `rotate`, `mirror` | `[0]`, `false` | The variants a copy may be placed in, as for dungeons.                                                                                                                            |

**Where a template goes.** A template with `clearing: true` is centered on a free clearing from `clearings`, picked at random among those where it fits. The clearing is never grown: ask for clearings of a fitting size. A clearing holds one template at most. When no free clearing has room for it, because there are none or all are taken or blocked, the template gets a clearing of its own: it goes to a random spot, and the whole box of the template is free of trees. The `margin` makes the trees thicken over that many tiles beyond the box, with the same ramp as a [verge](../composing.md#verges-and-pruneverge)'s falloff (with a `margin` of 3 the first tile beyond the box has a quarter of the chance of a tree, the next half, the next three quarters), so a template leaves no bare rectangle. That clearing is not in `clearings`: `ownClearing` of the template says so.

**Which tiles a template changes.** `Floor` cells become `Tile.Floor` and `Wall` cells `Tile.Wall`, over trees and ground. `Unused` cells leave whatever the map has there: a tree, grass, a road or water. A template never covers a road, a path or water: it is placed only where none of its `Floor` or `Wall` cells lies on one, and where it overlaps no other template. A path to the clearing it stands on (see [Paths to clearings](#paths-to-clearings)) stops at the edge of the template. A road that a template cannot be placed clear of makes that forest fail, see below.

**A template always appears, or it throws.** A template is requested because the map needs it, so it is never quietly left out. A template that finds no place gets a new forest, up to three forests in all, and only after the third a [`TemplatePlacementError`](../room-templates.md) is thrown. Since every forest failed, the input is at fault (a template that fills the map, say) and not the map. A template that is bigger than the map throws at once. A `chance` below 1 is the only way a template is left out, and it is no error.

The `templates` result lists the templates that were placed, in the order of the list and of their copies, each with its `template` (the index in `templates`), the box it fills (`x`, `y`, `width`, `height`), its `rotation` and `mirrored`, the `clearing` it stands on (the index in the `clearings` result, left out for a template placed anywhere or on a clearing of its own) and `ownClearing`.

## `ForestOptions`

| Option        | Default         | Meaning                                                                                                                                                                                                                                                                           |
| ------------- | --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `width`       |                 | Map width in tiles. Required.                                                                                                                                                                                                                                                     |
| `height`      |                 | Map height in tiles. Required.                                                                                                                                                                                                                                                    |
| `random`      | `Math.random`   | Source of randomness, shared by all the steps.                                                                                                                                                                                                                                    |
| `trees`       | the defaults    | The options of [`plantTrees`](../steps/plant-trees.md): `scaleX`, `scaleY`, `rotation`, `octaves`, `persistence`, `lacunarity`, `noise`, `density` (a `Range` of fractions, default `{ min: 0, max: 0.25 }`) and `tile` (default `Tile.Tree`). The ground is always `Tile.Grass`. |
| `streams`     | no streams      | The options of [`layStreams`](../steps/lay-streams.md), a stream or a river: see [Streams and rivers](#streams-and-rivers). Includes the tiles of the water and the verge beside it.                                                                                              |
| `roads`       | no roads        | The options of [`layRoads`](../steps/lay-roads.md): see [Roads](#roads). Includes `roadTile`, `bridgeTile`, `bridgeAngle` and the verge (`clearance`, `falloff`, `distance`).                                                                                                     |
| `clearings`   | no clearings    | The options of [`placeClearings`](../steps/place-clearings.md): `{ clearings, spacing, falloff, distance }`, where `clearings` is the list of `ClearingSpec`: see [Clearings](#clearings).                                                                                        |
| `templates`   | no templates    | The options of [`placeTemplates`](../steps/place-templates.md): `{ templates, distance }`, where `templates` is the list of [`RoomTemplate`](../room-templates.md)s: see [Templates in forests](#templates-in-forests).                                                           |
| `paths`       | the defaults    | The options of [`layClearingPaths`](../steps/lay-clearing-paths.md): `roadTile`, `bridgeTile` and the verge (`clearance`, `falloff`, `distance`) of the paths to clearings. Used only when a clearing asks for a path. Nothing is taken from `roads`.                             |
| `footbridges` | on with streams | The options of [`layFootbridges`](../steps/lay-footbridges.md): `{ minimum, bridgeTile }`. Used only when there are `streams`, and then on by default; `false` leaves the footbridges out.                                                                                        |

Anything the steps check throws a `RangeError` before the forest is made, as does a width or height that is not a positive whole number. A template that is bigger than the map throws a `TemplatePlacementError` just as early.

## `ForestResult`

- `grid`: the map.
- `roads`: the roads that were laid, the main road first. Each is a `Road` with its `kind` (`'road'` for the main road and crossings, `'branch'` for branches and for the [paths to clearings](#paths-to-clearings)), its `width` in tiles and its `points`, the tiles of its centerline from one end to the other, each next to the one before. Empty without the `roads` option and without paths.
- `junctions`: the places where roads meet or cross, which are good places for a signpost or an inn. Empty while there is a single road. See [Crossings and branches](#crossings-and-branches).
- `exits`: the tiles on the map border where a road leaves the map, as for a [maze](maze.md). A game can join the maps on the other sides there.
- `streams`: the streams that were laid, as `Road`s: `width` in tiles and `points`, the tiles of the centerline from upstream to the mouth. Empty without the `streams` option. See [Streams and rivers](#streams-and-rivers).
- `bridges`: the bridges, one point for each place where a road or a footbridge crosses water. Empty without streams.
- `clearings`: the clearings that were made, each with its center `x` and `y`, `radiusX`, `radiusY` (the radii that were picked, plain numbers) and `angle`, the defaults filled in, and the `path` it asked for with its width and windiness. Empty without the `clearings` option. See [Clearings](#clearings).
- `templates`: the templates that were placed, each with its `template` index, its box (`x`, `y`, `width`, `height`), `rotation`, `mirrored`, the `clearing` it stands on and `ownClearing`. Empty without the `templates` option. See [Templates in forests](#templates-in-forests).
- `attempts` and `failures`: how many times the forest was built (1 to 3) and one `{ attempt, step, error }` for each attempt that failed, also when a later one worked. See [`pipeline`](../composing.md#pipeline).

There is no `density` in the result, since the chance of a tree belongs to `plantTrees` and nothing else needs it.

```ts
const { grid, roads, bridges, attempts } = generateForest({
  width: 200,
  height: 100,
  trees: {
    scaleX: 80,
    scaleY: 20,
    rotation: 30,
    density: { min: 0, max: 0.45 },
  },
  streams: { width: { min: 2, max: 3 } },
  roads: { windiness: 0.5, clearance: 1, falloff: 2 },
  footbridges: { minimum: 2 },
});
```
