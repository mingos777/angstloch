# `digRings`

`digRings(options?)` is a step that digs concentric rings joined by spokes (see [the rings layout](../generators/mine.md#the-rings-layout)): ovals round the middle of its area, evenly spaced, the outermost near the edge of the area, each wobbling by smooth noise, with at least one spoke between every ring and the next. Like `digFishbone` it needs a map that starts as wall, takes `area` and `count`, and checks every option when it is made.

```ts
const { grid } = pipeline(
  emptyMap({ width: 80, height: 50, tile: Tile.Wall }),
  [
    digRings({
      ringShape: 'circle',
      area: { width: { min: 30, max: 30 }, height: { min: 30, max: 30 } },
    }),
  ],
  { random: mulberry32(42) },
);
```

| Option          | Default       | Meaning                                                                                                                                                      |
| --------------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `density`       | 0.3           | The share of the area that is floor, from 0 to 1. It sets how many rings to dig when `rings` is not given.                                                   |
| `rings`         | from density  | How many concentric rings to dig in each area, a `Range` of whole numbers, 1 or more. Fewer are dug when the area has no room for them.                      |
| `ringShape`     | `'oval'`      | `'oval'` fits the rings to the area, `'circle'` makes them round and centered, as large as the shorter side of the area allows.                              |
| `ringWidth`     | `{ 2, 3 }`    | Width of a ring in whole tiles, 1 or more. One is picked for every ring.                                                                                     |
| `ringWobble`    | 0.5           | How far the rings stray from perfect ovals, from 0 to 1.                                                                                                     |
| `spokes`        | `{ 1, 3 }`    | How many spokes join each ring to the next, a `Range` of whole numbers, 0 or more. Every pair gets one at least.                                             |
| `veinWidth`     | `{ 1, 2 }`    | Width of a spoke in whole tiles. One is picked for every spoke.                                                                                              |
| `veinWindiness` | 0.5           | How much the spokes wind, from 0 (straight) to 1.                                                                                                            |
| `area`          | the whole map | The size of the part of the map to dig in, see [areas](../composing.md#areas). The rings are fitted round its middle, closed in by a ring of wall inside it. |
| `count`         | `{ 1, 1 }`    | How many sets of rings to dig, each in an area of its own.                                                                                                   |

- **Reserved ground.** Nothing is dug through a [reserved](../composing.md#mapstate) tile, so a ring that crosses one is cut there, and rings dug over reserved ground may come out in pieces. A smaller `area` only lands on free ground, so this concerns an area as big as the map.
- **Uses** `passages`, the tunnels of the steps before it, and **adds** `passages` again with its own appended: the `ring` entries first, each a closed loop whose first tile is also its last, then the `spoke` entries, all in the coordinates of the map.

## Example map

The map this code makes with seed 1 (`mulberry32` is defined in the [quick start](../../README.md#quick-start)):

<!-- map: dig-rings -->

```ts
import { emptyMap, pipeline, Tile, digRings } from 'angstloch';

const result = pipeline(
  emptyMap({ width: 80, height: 25, tile: Tile.Wall }),
  [digRings()],
  { random: mulberry32(1) },
);
```

```text
################################################################################
################################.......#########################################
#############################..............####.............####################
##############..........#.......................................################
############.......................#..............................##############
##########......................########..........#######...........############
#######..........####.......#################################..........#########
#####..........################################################............#####
####.........####################################################...........####
###.......##########################################################........####
###.....################################################################.....###
###....##################################################################....###
###...###################################################################....###
###...###################################################################....###
###....#################################################################.....###
###......############################################################........###
###...........####################################################..........####
####..............##############################################...........#####
######................#########################################.........########
###########..............####.......................#######..........###########
###############....................................................#############
###################...............................................##############
######################..........#################.............##################
################################################################################
################################################################################
```

<!-- /map -->
