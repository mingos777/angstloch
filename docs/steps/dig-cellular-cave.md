# `digCellularCave`

`digCellularCave(options?)` is a step that grows a cave with a cellular automaton, as [`generateCave`](../generators/cave.md) does: random noise smoothed over a number of passes until walls and floors clump into caverns. It joins nothing: the caverns are left apart, `largestOnly` keeps one of them, and joining is a later step's job. It needs a map that starts as wall, takes `area` and `count`, and checks every option when it is made.

```ts
import {
  digFishbone,
  emptyMap,
  digCellularCave,
  pipeline,
  Tile,
} from 'angstloch';

const { grid, rooms, roomGroups } = pipeline(
  emptyMap({ width: 80, height: 50, tile: Tile.Wall }),
  [
    digFishbone({ density: 0.1 }),
    // two caverns on pieces of the map of their own, one piece each
    digCellularCave({
      largestOnly: true,
      area: { width: { min: 16, max: 24 }, height: { min: 12, max: 16 } },
      count: { min: 2, max: 2 },
    }),
  ],
  { random: mulberry32(42) },
);
```

| Option           | Default       | Meaning                                                                                                                       |
| ---------------- | ------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `fillChance`     | 0.45          | Chance that a tile starts as a wall, from 0 to 1.                                                                             |
| `iterations`     | 4             | Number of smoothing passes, 0 or more.                                                                                        |
| `neighborhood`   | `'moore'`     | Which tiles count as neighbors: `'moore'` (8) or `'von-neumann'` (4). Tiles outside the area count as walls.                  |
| `birthLimit`     | 5 / 3         | A floor tile turns into a wall with at least this many wall neighbors. 5 for `'moore'`, 3 for `'von-neumann'`.                |
| `survivalLimit`  | 4 / 2         | A wall tile stays a wall with at least this many wall neighbors. 4 for `'moore'`, 2 for `'von-neumann'`.                      |
| `borderWalls`    | true          | Keeps the outermost ring of tiles of the area solid wall.                                                                     |
| `symmetry`       | `'none'`      | Mirrors or rotates the starting noise about the center of the area: `'horizontal'`, `'vertical'`, `'both'` or `'rotational'`. |
| `symmetryChance` | 1             | How often a tile of the starting noise copies its twin, from 0 to 1. At 1 the cave is perfectly symmetric.                    |
| `minRegionSize`  | 0             | Leaves out every cavern of the area smaller than this many tiles. 0 keeps all.                                                |
| `largestOnly`    | false         | Keeps only the largest cavern of the area.                                                                                    |
| `area`           | the whole map | The size of the part of the map to grow the cave in, see [areas](../composing.md#areas).                                      |
| `count`          | `{ 1, 1 }`    | How many caves to grow, each in an area of its own.                                                                           |
| `placement`      | `'free'`      | Where a smaller area goes: `'free'`, `'beside'` or `'overlap'`, see below.                                                    |
| `overlapShare`   | `{ 0, 1 }`    | With `'overlap'` only: how much of the cave's floor may land on what is there, a range of fractions from 0 to 1, see below.   |

- **Laid over the map.** The cave is grown on its own, then laid over its area: its floor is stamped on the [free](../composing.md#mapstate) tiles, and every other tile keeps what it has, so nothing that earlier steps made is lost, and no floor goes on a reserved tile. With `'free'` a smaller `area` only lands on free ground, so this matters for an area as big as the map, and for `'overlap'`.
- **Placement.** `placement` says where a smaller `area` goes, and no placement ever digs a reserved tile:
  - `'free'`, the default, is the rule of [areas](../composing.md#areas): a random spot where the box and a margin of one tile round it are all free. A copy that finds none fails the attempt.
  - `'beside'` puts a cave beside what is there, as the [caverns](../generators/mine.md#caverns) of a mine are. It picks its own spot, so it takes no window (`area.x`, `area.y`) and no `area.gravity` (see [Where an area goes](../composing.md#where-an-area-goes)): one throws a `RangeError` when the step is made. The cave is grown, and culled by `minRegionSize` and `largestOnly`, on its own first, and then up to 100 random spots are tried. A spot fits when every floor tile of the cave, and the 8 tiles round it, is free, so the cave's floor keeps a wall between it and anything on the map, while its box may overlap tunnels. Of the spots that fit, the one whose floor comes nearest the dug ground (any tile that is not the base) wins; on a map with nothing dug, the first that fits. When no spot fits, the copies up to `count.min` fail the attempt, with an ordinary `Error` that `pipeline` answers with a new map, and the copies above it are left out, so a `count` with a `min` of 0 never fails. A cave with no floor left after culling is left out, and is not listed in `caverns`.
  - `'overlap'` lays the cave over what is there: it runs into the tunnels and floor it meets, like a cave-in, and its caverns are measured with that floor, as above. The cave is grown, and culled by `minRegionSize` and `largestOnly`, on its own first, and then up to 100 random spots are drawn, in the window if there is one, clear only of the other copies of the step. A spot fits when the share of the cave's floor that lands on tiles that are not [free](../composing.md#mapstate) (floor dug before, anything an earlier step stamped, and reserved tiles, which stay wall) lies in `overlapShare`, both ends included. With `area.gravity` the box then slides, and stops at the first step where it would touch another copy or where the share would leave the range. The default `{ min: 0, max: 1 }` takes any spot; `{ min: 0, max: 0 }` keeps the cave's floor off everything (it may still touch it), and `{ min: 0.2, max: 0.5 }` makes it break into what is there by a fifth to a half. An area as big as the map has one spot only, whose share is measured all the same. When no spot fits, the copies up to `count.min` fail the attempt, with an ordinary `Error` that `pipeline` answers with a new map, and the copies above it are left out. A cave with no floor left after culling is left out. The share is a measure for placement, not a promise about the final map: once the cave is laid over, a pocket that its own culling dropped may survive because it touches floor that was there, which lowers the share a little.
  - `overlapShare` with a `placement` other than `'overlap'`, a `min` or `max` that is not a number from 0 to 1, or a `min` above the `max` throws a `RangeError` when the step is made.
- **Caverns and the floor that was there.** `minRegionSize` and `largestOnly` measure the caverns after that: unreserved floor that was there already counts as part of a cavern it touches, so a cavern cut in two by an earlier tunnel is still one cavern, and reserved tiles count as wall. Floor that no new floor touches is never left out, whatever its size.
- **Caverns are rooms.** Every cavern that is kept is a [`Room`](../rooms.md#room) of kind `'cavern'`, its box the smallest rectangle that holds its floor and its shape in `roomShapes` that floor, which blocks nothing and reserves nothing (see [halls and caverns](../rooms.md#room)). It holds only the floor this cave dug, not the floor that was there. The caverns of one copy are a `'cave'` [group](../rooms.md#roomgroup) with the box the copy was grown in. They are the caverns as the step dug them: a later step that joins them, or digs into them, does not change them.
- **Uses** `rooms`, `roomShapes` and `roomGroups`, from the steps before it, and **adds** all three again with its own appended, the ids following on.

## Example map

The map this code makes with seed 1 (`mulberry32` is defined in the [quick start](../../README.md#quick-start)):

<!-- map: dig-cellular-cave -->

```ts
import { emptyMap, pipeline, Tile, digCellularCave } from 'angstloch';

const result = pipeline(
  emptyMap({ width: 80, height: 25, tile: Tile.Wall }),
  [digCellularCave()],
  { random: mulberry32(1) },
);
```

```text
################################################################################
###########################..###################################################
##########################....####################....#####..#####.......#######
#########.######..####........###...###...###..........###....###.........######
#########.#####....###........###....#.................##.....###.............##
###############................#......................####.....#.........#....##
###############......................................#######..........#####...##
###############........###...........................########.........####....##
##############........#####.........................##########................##
######....###.......#######.........................##########...............###
#####..............########..........................#########...............###
#####..........###########.............................#######................##
##..#.........#########................................########...............##
#.............########...........................###############..............##
#.............####.............................############..####.............##
#.............###..........................###############....#######........###
##............###.........................###############......######.....######
##........................................##############.........###......######
##........................................############...##................#####
##............................######.....#########......###................#####
##.........##..............##########....########.......###................#####
###........#####.........############....########......####..............#######
####......#########.....##############...#########...######...####.....#########
#######...#################################################..###################
################################################################################
```

<!-- /map -->
