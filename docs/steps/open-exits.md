# `openExits`

`openExits(options?)` is a step that carves exits into the border of the map. An exit is a door on the border and a straight tunnel to the nearest floor, found by going straight in from the border. It works on any map that has floor, so a cave, a mine or a maze is given its exits with it. Every option is checked when the step is made, and a bad one throws a `RangeError` at once.

```ts
const { grid, exits } = pipeline(
  emptyMap({ width: 80, height: 50, tile: Tile.Wall }),
  [
    // ...steps that dig floor...
    openExits({ count: { min: 2, max: 3 }, symmetry: 'horizontal' }),
  ],
  { random: mulberry32(42) },
);
```

| Option           | Default     | Meaning                                                                                                                                                                                      |
| ---------------- | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `at`             | `'border'`  | Where the exits go: `'border'`, anywhere on the border with a tunnel to the nearest floor, or `'outfalls'`, at the [outfalls](dig-sewers.md) of the sewers.                                  |
| `count`          | `{ 0, 0 }`  | How many exits to carve, a `Range` of whole numbers of at least 0. The default adds none. The twins that `symmetry` makes count towards it.                                                  |
| `lattice`        | `false`     | Puts doors on odd border coordinates only, which is where a maze has its cells.                                                                                                              |
| `symmetry`       | `'none'`    | `'horizontal'` (left to right), `'vertical'` (top to bottom), `'both'` or `'rotational'` (by 180°): an exit gets twins on the mirror images of its place that a tunnel can reach floor from. |
| `symmetryChance` | 1           | The chance that an exit has twins, from 0 to 1. The exit and its twins are all left out when there is no room for them or two of their doors would be side by side.                          |
| `tile`           | `Tile.Door` | The tile of a door on the border. The tunnel is `Tile.Floor`.                                                                                                                                |

- **Where.** A side of the map is picked at random, and then one of the exits on it with the shortest tunnels. A tunnel never digs through a tile that is [reserved](../composing.md#mapstate), and a door is never on one. A door is never next to another door, diagonals included.
- **Misses.** An exit may be left out for lack of floor to reach or of room. The step stops when it has made `count` exits or when ten tries in a row have come to nothing, and it never throws for that, so a map with no floor gets no exits.
- **Reserved.** Each door is recorded with `openReserved`, so the `Openable` tiles round it become `Solid`. The tiles it stamps stop being prunable.
- **At the outfalls.** With `at: 'outfalls'` the step opens outfalls of the `'sewer'` groups in `roomGroups` instead: `count` of those still reserved `Openable`, picked at random, or all of them when fewer are left. Each becomes `tile`, with no tunnel, since the sewer's walkway reaches it, and is recorded with `openReserved`. An outfall left unopened stays wall. `lattice`, `symmetry` and `symmetryChance` are not used, and a map with no sewer gets no exits.

```ts
const { grid, exits } = pipeline(
  emptyMap({ width: 80, height: 50, tile: Tile.Wall }),
  [
    digSewers({ outfalls: { min: 2, max: 2 } }),
    placeScatteredRooms(),
    digCorridors(),
    // one of the two outfalls becomes a way out
    openExits({ at: 'outfalls', count: { min: 1, max: 1 } }),
  ],
  { random: mulberry32(42) },
);
```

- **Adds** `exits`: the points of the doors. An `exits` extra that is in the state already is kept, and its doors count as neighbors to keep away from, so the step can run more than once, with different options.

## Example map

The map this code makes with seed 1 (`mulberry32` is defined in the [quick start](../../README.md#quick-start)), before and after `openExits`:

<!-- map: open-exits -->

```ts
import {
  emptyMap,
  pipeline,
  Tile,
  digCellularCave,
  openExits,
} from 'angstloch';

const result = pipeline(
  emptyMap({ width: 38, height: 22, tile: Tile.Wall }),
  [digCellularCave(), openExits({ count: { min: 2, max: 3 } })],
  { random: mulberry32(1) },
);
```

```text
before                                    after
######################################    ######################################
############################.....#####    ############################.....#####
######.....########..######.......####    ######.....########..######.......####
#####.......######....#####.......####    #####.......######....#####.......####
#####........####......####.....######    #####........####......####.....######
####.........###...##.#####....#######    ####.........###...##.#####....#######
####.........##...########....########    ####.........##...########....########
####.........##...#######.....########    ####.........##...#######.....########
###..........##....######.....####..##    ###..........##....######.....####..##
##...........###....######.....##...##    ##...........###....######.....##....+
##............###...#######.........##    ##............###...#######.........##
##....#.......###....#######........##    ##....#.......###....#######........##
##...###......####.......####.......##    ##...###......####.......####........+
#########....######.......##........##    #########....######.......##........##
####################...............###    ####################...............###
####################.........###..####    ####################.........###..####
###...##############........##########    ###...##############........##########
##.....######..............###########    ##.....######..............###########
##.....#####..............############    ##.....#####..............############
##....######............##############    ##....######............##############
###..#################################    ###..#################################
######################################    ######################################
```

<!-- /map -->
