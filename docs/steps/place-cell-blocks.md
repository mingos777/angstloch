# `placeCellBlocks`

`placeCellBlocks(options?)` is a step that places the cell blocks of a prison: identical cells that share their walls, along a straight corridor, on one side of it or both. Every cell has one door onto the corridor, always `Tile.Door`; what kind of door it is (bars, a grate) is the game's choice. The block is entered at one end of its corridor, its entrance, and nowhere else, or, with a guard room, at the end of a tunnel that leads past the guard room's door. There is no prison generator: a prison is a dungeon with a block or two in it, and guard posts, solitary and service rooms are ordinary rooms that the game themes.

```ts
import {
  digCorridors,
  emptyMap,
  pipeline,
  placeCellBlocks,
  placeScatteredRooms,
  Tile,
} from 'angstloch';

const { grid, rooms, roomGroups } = pipeline(
  emptyMap({ width: 80, height: 50, tile: Tile.Wall }),
  [
    placeCellBlocks({ blocks: { min: 1, max: 2 } }),
    // the rooms keep clear of the blocks, and the corridors enter each block at its entrance
    placeScatteredRooms(),
    digCorridors(),
  ],
  { random: mulberry32(42) },
);
const cells = rooms.filter(({ kind }) => kind === 'cell');
```

A block with the defaults and 5 cells per side, before it is joined (`o` is the entrance, a wall until a joining step opens it):

```
#####################
#...#...#...#...#...#
#...#...#...#...#...#
#...#...#...#...#...#
##+###+###+###+###+##
o...................#
##+###+###+###+###+##
#...#...#...#...#...#
#...#...#...#...#...#
#...#...#...#...#...#
#####################
```

| Option          | Default                                | Meaning                                                                                                                                                              |
| --------------- | -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `blocks`        | `{ 1, 1 }`                             | How many blocks to place in each area, a `Range` of whole numbers of at least 0.                                                                                     |
| `cellSize`      | `{ width: { 3, 3 }, depth: { 3, 3 } }` | The floor of a cell in whole tiles of at least 1: `width` along the corridor, `depth` away from it. Each is drawn once per block, so the cells of a block are alike. |
| `cellsPerSide`  | `{ 4, 6 }`                             | How many cells line each side of the corridor, drawn once per block.                                                                                                 |
| `sides`         | `{ 2, 2 }`                             | On how many sides of the corridor the cells are, a `Range` of 1 to 2, drawn once per block. A block of one side has its cells on either side at random.              |
| `corridorWidth` | `{ 1, 1 }`                             | The width of the block corridor, drawn once per block.                                                                                                               |
| `orientation`   | `'any'`                                | Which way the corridor runs: `'horizontal'`, `'vertical'`, or `'any'`, drawn for each block.                                                                         |
| `cellDoors`     | `'centered'`                           | Where the door of a cell sits along its front: `'centered'`, or `'jittered'`, at a spot drawn once per block that all its cells share.                               |
| `placement`     | `'free'`                               | `'free'`, or `'lattice'` to keep the block on the lattice of a lattice dungeon (see [on the lattice](#cell-blocks-on-the-lattice)).                                  |
| `guardRoom`     | none                                   | A guard room for each block (`GuardRoomOptions`, see [guard rooms](#guard-rooms)). Absent means none.                                                                |
| `area`, `count` | the whole map, `{ 1, 1 }`              | The [areas](../composing.md#areas) to place blocks in, and how many. A smaller area goes on a random free spot.                                                      |

- **Where a block goes.** On a random spot of its area where the block and a ring of one tile round it are free (see [`isFree`](../composing.md#mapstate)), with two more free tiles beyond the entrance, so a corridor or a vein can reach it. Blocks of one area keep a tile apart. A block that finds no spot in 100 tries throws an ordinary `Error`, which [`pipeline`](../composing.md#pipeline) answers with a new map. The entrance is at either end of the corridor, on a row (or column) of it picked at random.
- **What it reserves.** The whole block, walls and floor, is `Reserve.Solid`, but for the entrance, which is `Reserve.Openable`: no step digs into the block, and the only way in is the entrance. Rooms placed afterwards keep clear of it, and of the tile in front of the entrance while the entrance is not opened, as they keep clear of the tile in front of a template's door: [`placeScatteredRooms`](place-scattered-rooms.md), [`placePartitionedRooms`](place-partitioned-rooms.md), [`placeClusteredRooms`](place-clustered-rooms.md) and the crypts of [`digCatacombs`](dig-catacombs.md) find the entrances in `roomGroups`, and a corridor can always start there.
- **Rooms and groups.** Every cell is a [`Room`](../rooms.md#room) of kind `'cell'` in `rooms`, with its shape in `roomShapes` (its floor and the walls round it, its door a `Door` cell) and its door in `roomExits` (with `door: true`), so it has its exit already and [`digCorridors`](dig-corridors.md) leaves it alone. The cells come side by side along the corridor, one side after the other. Each block adds a `'cellBlock'` [group](../rooms.md#roomgroup) to `roomGroups`, with its footprint, corridor and entrance, and its cells point to it with `group`. The corridor is no room: `digCorridors` joins it, with the cells whose doors open onto it, as one [feature](dig-corridors.md#features), through the entrance, which gets a door by its `doorChance`; [`digVeins`](dig-veins.md) enters it there too. A block that cannot be reached fails the map like any feature.
- **Uses** `rooms`, `roomShapes`, `roomExits` and `roomGroups` from the steps before it, if any, and **adds** all four again with its own appended, the ids following on. It needs a map that starts as wall, and it checks every option when it is made.
- **Over 200 seeds** of the run above on 80 by 50, no map failed, every map came out in one piece and none needed a second map. With a pillar hall and `digVeins` instead, none needed one either.
- **Steps after the block.** A step after the block may build right up to its reserved ring, so a later hall can reach the tile beyond the entrance. [`digCorridors`](dig-corridors.md) and [`digVeins`](dig-veins.md) then open the entrance with no corridor or vein. The room placement steps keep that tile free (see what it reserves). A hall or a sewer that stops a tile or two short of it is joined by `digCorridors` with a short straight way (see [features](dig-corridors.md#features)). On 80 by 50 with 1 to 2 blocks, then `digPillarHalls`, `placeScatteredRooms` and `digCorridors`, 4 maps in 200 needed another (2 with guard rooms the blocks are entered through), and none failed; with `digSewers` in place of the hall, 1 needed another for a cut-off block. With `digVeins` instead of `digCorridors`, none needed another. A [catacomb](dig-catacombs.md) seals a block in its area, so keep the blocks out of it.

## Guard rooms

With `guardRoom`, a block gets a guard room by its `chance`, beside the block or with the block entered through it. With the `placement` `'beside'`, the block gets a tunnel, one tile wide, that runs on from the end of its corridor, and the guard room stands beside the tunnel, on either side at random, its door centered on the wall it shares with the tunnel. The wall between the corridor and the tunnel becomes a door, and the entrance moves to the wall beyond the far end of the tunnel, which runs `tunnel` tiles past the guard room's door. The guard room is a [`Room`](../rooms.md#room) of kind `'guardRoom'` in the block's group, with its shape and its door in `roomExits` (with `door: true`), like a cell. The guard room and the tunnel, each with the walls round it, are reserved `Solid` and need a free ring of one tile too; they lie outside the block's `footprint`, and the group's `tunnel` is the tunnel's floor.

With the `placement` `'through'`, the guard room stands against the end of the block, sharing its end wall, with its door in that wall at the end of the corridor (on the entrance row), and the entrance opposite, in its far wall. Its floor is `size.width` along the corridor and `size.depth` across it, centered on the entrance row, so it may be shallower than the block or reach past it. There is no tunnel, and `tunnel` is not used. With `'any'`, each guard room is beside its block or the block is entered through it, at even odds. The entrance is a potential exit (`OptionalExit`) of the guard room's shape, and the only `Openable` tile of the block. Its door is an [`Exit`](../rooms.md#exit) of the guard room, as for `'beside'`. [`digCorridors`](dig-corridors.md) joins the guard room, the corridor and the cells as one [feature](dig-corridors.md#features) through the entrance, and lists the entrance as a second exit of the guard room. [`digVeins`](dig-veins.md) enters there too, and also records the entrance as an exit of the guard room.

A two-sided block entered through a guard room of 5 by 9 (`o` is the entrance):

```
#######################
#.....#...#...#...#...#
#.....#...#...#...#...#
#.....#...#...#...#...#
#.....##+###+###+###+##
o.....+...............#
#.....##+###+###+###+##
#.....#...#...#...#...#
#.....#...#...#...#...#
#.....#...#...#...#...#
#######################
```

With the default size of 5 by 3 it is a vestibule in the middle of the end wall:

```
      #################
      #...#...#...#...#
      #...#...#...#...#
#######...#...#...#...#
#.....##+###+###+###+##
o.....+...............#
#.....##+###+###+###+##
#######...#...#...#...#
      #...#...#...#...#
      #...#...#...#...#
      #################
```

A one-sided block with a guard room beside it (`o` is the entrance):

```
################################
#.....##...#...#...#...#...#...#
#.....##...#...#...#...#...#...#
#.....##...#...#...#...#...#...#
###+#####+###+###+###+###+###+##
o......+.......................#
################################
```

| Option      | Default                                | Meaning                                                                                                                          |
| ----------- | -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `chance`    | 1                                      | The chance that a block gets a guard room, from 0 to 1.                                                                          |
| `size`      | `{ width: { 5, 5 }, depth: { 3, 3 } }` | The floor of the guard room in whole tiles of at least 1: `width` along the tunnel, `depth` away from it.                        |
| `placement` | `'beside'`                             | Where it stands: `'beside'` the tunnel, `'through'`, the block entered through it, or `'any'`, either drawn for each guard room. |
| `tunnel`    | `{ 2, 4 }`                             | How many tiles the tunnel runs past the guard room's door before the entrance, whole numbers of at least 0. Only for `'beside'`. |

Over 200 seeds on 80 by 50 with 1 to 2 blocks, all with a guard room beside them, then `placeScatteredRooms` and `digCorridors`, no map failed and every map came out in one piece; 2 needed a second map. With the guard room `'through'`, none failed and none needed a second map. With the blocks, `digPillarHalls` and `digVeins`, none needed one and none was split, for either placement. With `'through'` on the lattice (81 by 51, every step on the lattice), none failed and none needed a second map.

## Cell blocks on the lattice

In a lattice dungeon a corridor of [`digCorridors`](dig-corridors.md) leaves a room only toward a tile with odd coordinates, so a block of the free placement is reached only when its entrance lands there by chance. With `placement: 'lattice'` the walls of the block fall on even coordinates and its floors on odd ones:

- The footprint starts on even coordinates and has odd sides, and its area goes on the lattice as the [areas](../composing.md#areas) of the other lattice steps do.
- The cell width and depth, the corridor width and the guard room's size are narrowed to odd numbers, as the sizes of lattice rooms are (a range of even sizes only, such as `{ 4, 4 }`, is rounded up to 5).
- The entrance sits on an odd row (or column) of the corridor, so the tile beyond it is odd on both axes.
- A guard room beside the block shares the block's end wall instead of standing a wall apart, its floor starting on the first odd column out, and the tunnel's length is made odd (by the length it runs past the door, rounded up when its `tunnel` range has no length that fits), so that the entrance at its far end is on the lattice too.
- A guard room the block is entered through shares the end wall in either placement. On the lattice its floor starts on an odd row, so when centering it on the entrance row would start it on an even one, it moves a tile to either side at random.
- The doors inside stay where they are: a cell door and the guard room's door open onto the block corridor and the tunnel, which no outside corridor touches, so a 3-wide cell keeps its door in the middle, on an even tile.

The option takes nothing from the other steps: give `placement: 'lattice'` to every step of a lattice dungeon, on a map of odd size.

```ts
const { grid } = pipeline(
  emptyMap({ width: 81, height: 51, tile: Tile.Wall }),
  [
    placeCellBlocks({
      blocks: { min: 1, max: 2 },
      placement: 'lattice',
      guardRoom: {},
    }),
    placeScatteredRooms({ placement: 'lattice' }),
    digCorridors({ placement: 'lattice' }),
  ],
  { random: mulberry32(42) },
);
```

Over 200 seeds of that run, with and without guard rooms, no map failed and none needed a second map; with the free placement of the blocks, 131 of 200 failed.
