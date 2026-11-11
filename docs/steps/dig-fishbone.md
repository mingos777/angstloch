# `digFishbone`

`digFishbone(options?)` is a step that digs a fishbone mine (see [the fishbone layout](../generators/mine.md#the-fishbone-layout) for how it looks): a main shaft through a point near the middle of its area, and then adits off the shaft, roughly parallel ribs mirrored on its two sides, until the density is reached. A mine is dug out of rock, so the map has to start as wall, which `pipeline` checks before the first attempt (a `RangeError` that says how to start the map). Every option is checked when the step is made, and a bad one throws a `RangeError` at once.

```ts
const { grid, passages } = pipeline(
  emptyMap({ width: 80, height: 50, tile: Tile.Wall }),
  [
    digFishbone({
      density: 0.2,
      area: { width: { min: 25, max: 35 }, height: { min: 20, max: 30 } },
      count: { min: 2, max: 2 },
    }),
    openExits({ count: { min: 2, max: 3 } }),
  ],
  { random: mulberry32(42) },
);
```

The options are those of the fishbone layout of [`generateMine`](../generators/mine.md#mineoptions), none of them marked "fishbone only" any more, since the step has no other layout, plus the two options of [areas](../composing.md#areas):

| Option           | Default       | Meaning                                                                                                                                     |
| ---------------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `density`        | 0.15          | The share of the area that is floor, from 0 to 1. A target, met as far as the area has room. The main shaft is always dug.                  |
| `shaftWidth`     | `{ 2, 3 }`    | Width of the main shaft in whole tiles, a `Range`.                                                                                          |
| `shaftWindiness` | 0.1           | How much the main shaft winds, from 0 (straight) to 1.                                                                                      |
| `angle`          | `'random'`    | Direction of the main shaft in degrees, clockwise from east. `'random'` picks one for every copy.                                           |
| `aditWidth`      | `{ 1, 2 }`    | Width of an adit in whole tiles. One is picked for every adit.                                                                              |
| `aditWindiness`  | 0.1           | How much the adits wind, from 0 to 1.                                                                                                       |
| `aditLength`     | `{ 15, 50 }`  | Length of an adit in whole tiles. An adit that ends up shorter than the minimum is not dug.                                                 |
| `branchAngle`    | `{ 45, 90 }`  | The rib angle in whole degrees, from 1 to 179, between the adits and the forward direction of the shaft. One is picked for every mine.      |
| `aditSpread`     | 10            | The most, in whole degrees from 0 to 90, that an adit starts off the line of its side, either way. One is picked for every adit.            |
| `crosscuts`      | 0.1           | The chance, from 0 to 1, that two neighboring adits on the same side of the shaft are joined by a crosscut, a straight tunnel 1 tile wide.  |
| `area`           | the whole map | The size of the part of the map to dig in, see [areas](../composing.md#areas). The mine is closed in by a ring of wall inside it.           |
| `count`          | `{ 1, 1 }`    | How many mines to dig, each in an area of its own. The mines are apart, so a map with two is in two pieces, unless a later step joins them. |

- **Density is a share of the area**, not of the map: a 25 by 20 area with a `density` of 0.2 gets about 100 tiles of floor.
- **Reserved ground.** Tunnels are dug out of wall and never through a [reserved](../composing.md#mapstate) tile, so a mine dug over reserved ground may come out in pieces. A smaller `area` only lands on free ground, so this concerns an area as big as the map.
- **Uses** `passages`, the tunnels of the steps before it, and **adds** `passages` again with its own appended: `shaft`, `adit` and `crosscut` entries, the crosscuts after the adits, with `tiles` in the coordinates of the map, whatever the area. A second mine layout in the same pipeline carries on with the lanes of the noise where this one stopped, so no two tunnels bend alike.

## Example map

The map this code makes with seed 1 (`mulberry32` is defined in the [quick start](../../README.md#quick-start)):

<!-- map: dig-fishbone -->

```ts
import { emptyMap, pipeline, Tile, digFishbone } from 'angstloch';

const result = pipeline(
  emptyMap({ width: 80, height: 25, tile: Tile.Wall }),
  [digFishbone()],
  { random: mulberry32(1) },
);
```

```text
################################################################################
#####################################################......#####################
####################################################........####################
##################################################...........###################
################################################........##....##################
###############################################........####....#################
#############################################........#######....################
###########################################........##########...################
#########################################.........############...###############
########################################........##############....##############
#######################################.......#################....#############
#####################################.......####################....############
#####################################.......#####################....###########
###################################.......#..#####################....##########
##################################......####..#####################....#########
#################################.........###..#####################....########
################################...........###..#####################....#######
#############################........###....###..#####################....######
###########################.........#####....###...####################.....####
##########################.........#######....####...###################.....###
########################........###########.....####..####################....##
######################........##############....#####..####################....#
#####################........#################....####...###################...#
#####################......###################....######.#######################
################################################################################
```

<!-- /map -->
