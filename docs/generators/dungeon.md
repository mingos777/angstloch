# Dungeons

```ts
import { generateRoomDungeon } from 'angstloch';

const { grid, rooms, exits, fill } = generateRoomDungeon({
  width: 61,
  height: 41,
  scatter: { placement: 'lattice', roomCount: { min: 6, max: 12 } },
  corridors: { placement: 'lattice', loopChance: 0.3 },
});
console.log(grid.toString());
console.log(`${rooms.length} rooms covering ${fill * 100}% of the map`);
```

Prefabricated rooms are supported by both generators (see [Room templates](../room-templates.md)).

There are two dungeon generators, both ready-made compositions of [steps](../composing.md) that take the options of each step under a key of its own. They differ in where the rooms go:

- `generateRoomDungeon` spreads its rooms over the whole map, in a scattered or a regular way (see [`RoomDungeonOptions`](#roomdungeonoptions)).
- [`generateDigDungeon`](#grown-dungeons) grows its rooms out of a first room in the middle, each beyond a wall of one there is, so they cluster and most corridors are short, as in a roguelike of old (see [`DigDungeonOptions`](#digdungeonoptions)).

`generateRoomDungeon` builds a dungeon room-first, on a map of rock:

1. [`placeScatteredRooms`](../steps/place-scattered-rooms.md), or [`placePartitionedRooms`](../steps/place-partitioned-rooms.md) with `partition`, places the templated rooms and then the ordinary rooms, without overlapping, either scattered at random or by binary space partitioning.
2. [`digCorridors`](../steps/dig-corridors.md) joins the rooms with corridors. Every room can be reached from every other one (see [Connections](#connections)). Rooms get the number of exits they ask for, and loops and dead ends are added if requested. Every opening in a room's wall becomes an _exit_, and each exit gets a door or stays a plain opening.

In both generators, when a step throws, which is what happens to a template that finds no place or cannot be joined, the map is built again from the start, up to 3 times in all; the result reports the `attempts` and the `failures`. For other compositions, such as rooms of both kinds in one map, rooms in part of a map, or rooms next to a cave, run the steps with [`pipeline`](../composing.md#pipeline).

## Example map

The map this code makes with seed 1 (`mulberry32` is defined in the [quick start](../../README.md#quick-start)):

<!-- map: generate-room-dungeon -->

```ts
import { generateRoomDungeon } from 'angstloch';

const result = generateRoomDungeon({
  width: 80,
  height: 25,
  random: mulberry32(1),
});
```

```text
################################################################################
##############......############################################################
##############......############################################################
####.........+......############################################################
####.#########......############################################################
####.#########+###+###############################################...###########
####.#####......#..###########.....#########################.....#...###########
####.#####......#.############.....#########################.....+...###########
####.#...#......#.############.....#########################.....#...###########
####.#...#......#.################+###########.............+.....#...####......#
####.#...+......+.################.###########.#############.....#...+.##......#
####.#...########.###.......+...........######.###############+#######.##......#
####.#...+.######.###.......#.#########.######.###############.........##......#
####.#####.######.###.......#.#########.######.#######################..+......#
####.......######.###.......#.#####...#.#....+.#################################
#################.###.......#.#####...#.#....###################################
#################.###.......#.#####...#.#....###################################
#################.###.......#.#####...+.+....###################################
#################.###########.#####...###....###################################
#################.............#####...###....###################################
################################################################################
################################################################################
################################################################################
################################################################################
################################################################################
```

<!-- /map -->

## `RoomDungeonOptions`

| Option            | Default       | Description                                                                                                                                                                                                                         |
| ----------------- | ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `width`, `height` | required      | Map size in tiles.                                                                                                                                                                                                                  |
| `random`          | `Math.random` | Source of randomness.                                                                                                                                                                                                               |
| `scatter`         | the defaults  | The rooms, tried at random spots: the options of [`placeScatteredRooms`](../steps/place-scattered-rooms.md). Used when `partition` is not given.                                                                                    |
| `partition`       | none          | The rooms, one in each part of a binary space partition: the options of [`placePartitionedRooms`](../steps/place-partitioned-rooms.md), in place of `scatter`. Giving both throws a `RangeError`.                                   |
| `corridors`       | the defaults  | The corridors and exits: the options of [`digCorridors`](../steps/dig-corridors.md). It takes nothing from the options of the rooms, so lattice or symmetric rooms want the same `placement`, `symmetry` and `symmetryChance` here. |

Every option is checked before anything is generated, and a bad one throws a `RangeError` that names it. The rooms take `area` and `count` too, but those leave most of the map empty in a dungeon of its own; they are meant for compositions.

## `DigDungeonOptions`

| Option            | Default       | Description                                                                                                                                                                                                                         |
| ----------------- | ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `width`, `height` | required      | Map size in tiles.                                                                                                                                                                                                                  |
| `random`          | `Math.random` | Source of randomness.                                                                                                                                                                                                               |
| `grow`            | the defaults  | The rooms, grown from a first room in the middle: the options of [`placeClusteredRooms`](../steps/place-clustered-rooms.md).                                                                                                        |
| `corridors`       | the defaults  | The corridors and exits: the options of [`digCorridors`](../steps/dig-corridors.md). It takes nothing from the options of the rooms, so lattice or symmetric rooms want the same `placement`, `symmetry` and `symmetryChance` here. |

Every option is checked before anything is generated, and a bad one throws a `RangeError` that names it.

## `RoomDungeonResult`

The result of both generators: the fields of a [`DungeonResult`](#dungeonresult), plus:

| Field      | Description                                                                                                                                            |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `attempts` | How many times the map was built, 1 or more.                                                                                                           |
| `failures` | One entry per failed attempt, also when a later attempt succeeded: `{ attempt, step, error }`, as [`pipeline`](../composing.md#pipeline) reports them. |

`exits` are the `roomExits` of [`digCorridors`](../steps/dig-corridors.md), and `fill` is worked out from the shapes of the rooms: the floor of every room, the doorways of templates included, over the map.

## Placement of rooms

Which rooms go where is decided by the step that places them: `scatter` or `partition` in the options of `generateRoomDungeon`, and `grow` in those of [`generateDigDungeon`](#grown-dungeons):

- `scatter` ([`placeScatteredRooms`](../steps/place-scattered-rooms.md), the default): random rooms are tried one after another, and any that would come too close to the map edge or to another room is discarded. Generation stops when the first of these happens:
  - `roomCount.max` rooms have been placed.
  - The `fill` target has been reached and at least `roomCount.min` rooms are placed.
  - The map is full: 100 rooms in a row failed to fit. In that case you can get fewer rooms than `roomCount.min` or a lower fill than requested.
- `partition` ([`placePartitionedRooms`](../steps/place-partitioned-rooms.md)): the map is cut in two again and again (binary space partitioning), and every area that results holds one room. The number of areas is estimated from `fill` and the typical room size, and kept within `roomCount`. If the rooms fall short of the target, the map is cut into more areas, a few times over. Rooms are placed inside their areas and separated by `roomSpacing`, so a partitioned dungeon looks more regular than a scattered one.

`spacingUniformity`, an option of both steps, sets how evenly rooms are spread, from 0 to 1:

- With `scatter`, several candidate rooms are compared at once and the one farthest from the other rooms is kept. At 0 there is a single candidate, so rooms can land anywhere; at 1 there are ten.
- With `partition`, at 0 the cuts and the rooms inside their areas are placed at random, and the area to cut next is picked at random too. At 1 the biggest area is always cut next, cuts go through the middle and rooms sit in the middle of their areas, which gives an almost regular grid.

```ts
const regular = generateRoomDungeon({
  width: 61,
  height: 41,
  partition: { roomSpacing: 3, spacingUniformity: 1 },
});
```

- `grow` ([`placeClusteredRooms`](../steps/place-clustered-rooms.md)): each room is built beyond a wall of a room there is, a `gap` of corridor away, starting from a room in the middle. See [Grown dungeons](#grown-dungeons).

Rooms that turn out to be unreachable are dropped afterwards, see [Connections](#connections).

A room is always separated from the map edge by at least one wall tile. The minimum number of wall tiles between two rooms is set with `roomSpacing`. If a size range does not fit between the map edges, it is clamped to what fits. If not even the smallest room fits, no rooms are placed, and no error is thrown.

## `placement`

- `'free'` (default): a room can start on any tile and have any size within the ranges. Corridors can turn anywhere.
- `'lattice'`: ADOM-style. Rooms start on odd coordinates and have odd dimensions, so the whole dungeon sits on the same lattice as a [maze](maze.md): floors on odd coordinates, walls between them. Corridors run along the lattice and exits are on odd coordinates along the wall. This keeps exits apart and rules out awkward corners.

In `lattice` mode the size ranges are narrowed to odd numbers: `{ min: 4, max: 10 }` becomes 5 to 9. A range that holds no odd number, such as `{ min: 4, max: 4 }`, is rounded up to the next odd size (5). Likewise `roomSpacing` is rounded up to an odd number.

`placement` is an option of each step: lattice rooms (`scatter.placement`, `partition.placement` or `grow.placement`) want lattice corridors (`corridors.placement`) too.

## Connections

Rooms are joined in a tree, which means one link fewer than there are rooms. Extra links for exits and loops come on top of it. `connection` (`corridors.connection` in the generators) decides which links make the tree:

- `'nearest'` (the default) links the closest rooms first, between rooms that are not connected yet.
- `'bsp'` joins rooms the way a BSP dungeon does. The rooms are cut in two, by a vertical or a horizontal cut, and each half is cut again, until single rooms are left. A cut runs across the axis where the centers of the rooms are more spread out, and it splits the rooms in half by their order along that axis. Every cut then gets one link, between the closest pair of rooms on its two sides. The smallest cuts are joined first, so rooms are joined into small clusters, and the clusters are then joined into larger ones. The cuts are worked out from where the rooms are, so `bsp` connections work with either placement step and either `placement`, with templated rooms and with symmetry, and not only with `partition`. The result has long, straight links between clusters, where `nearest` has many short ones.
- `'bsp-random'` cuts the rooms in the same way, but joins a random room on one side of a cut to a random room on the other, as the textbook BSP algorithm does. The links are often long and cross the map, which makes a more tangled dungeon with more corridor crossings, where far-apart rooms are joined directly.

With the BSP connections, if the corridor between the chosen pair of a cut cannot be built, the next pair is tried (the next closest for `'bsp'`, another random one for `'bsp-random'`). When no pair can be joined, the rooms are left for the nearest-first rule, and then for the recovery described at the end of this section. The rooms themselves are the same with every connection: only the corridors differ.

For each link, whichever way it was chosen:

- If the two rooms face each other across exactly one wall tile (`roomSpacing: 1` makes this common), a single door in that wall joins them. This exit belongs to both rooms.
- Otherwise a corridor is routed between the rooms. Each room's end of it is a new exit on the wall that faces the other room, or, if the room has all the exits it wants, a branch off a corridor it has already (see [Exits per room](#exits-per-room)).

Corridors are one tile wide. They stay a tile away from the walls of rooms, except where they leave through an exit, and they never run alongside another corridor, which would make a section two tiles wide, nor diagonally past one, which would let a diagonal step jump from one corridor to the other. Corridors do not touch themselves either. If the direct route is blocked, a corridor may cross an existing one, but only straight on. Two corridors that point at each other along one line may be joined end to end. A corridor that would have to wind far around to get anywhere is not built; another route is tried instead.

Exits are never next to each other, not even diagonally, so no room has two doors side by side.

If a room cannot be linked to any other room, it is joined to the nearest corridor instead, with a corridor of its own or, when a corridor passes right outside its wall, with nothing but an exit. A room that cannot be reached at all, because other rooms box it in, is dropped from the dungeon.

As a result every room can always be reached from every other room, but a crowded map can end up with fewer rooms than `roomCount.min` asks for, or with a lower `fill` than the target. This is most likely with a `roomSpacing` of 2 in `free` placement: rooms two tiles apart have no room for a corridor between them and no single wall to share a door in, so a room surrounded on all sides by such neighbors is dropped. Use 1 or 3 and more to avoid that.

## Exits per room

Both generators honor `exitsPerRoom` (`corridors.exitsPerRoom`, like `loopChance` and `deadEndChance` below). It is a `Range`. Every room draws its own wanted number of exits from it, so `{ min: 1, max: 1 }` means one exit each, `{ min: 2, max: 4 }` means several and `{ min: 1, max: 3 }` (the default) is random with at least one.

- A room with fewer links than it wants gets extra links to its nearest neighbors, which makes loops.
- A room with more links than it wants uses its exits for several corridors: the extra corridors branch off the ones leaving through its exits, outside the wall.

This is best effort. A door shared with another room counts as an exit for both of them, and a room that cannot branch off anywhere, or has no neighbor to link to, gets one more exit or one fewer than wanted. Connectivity always takes priority.

## Loops

In both generators, after the rooms are connected, `loopChance` adds extra corridors between rooms that are connected already. Each room is considered with its three nearest neighbors, and every such pair that is not linked yet gets one roll. A loop is never made by crossing another corridor and respects `exitsPerRoom`, so it is only added where there is room for it. At 0 the corridors form a tree (with the odd exception where a corridor had to cross another); at 1 every pair of neighbors is linked where possible.

## Dead ends

In both generators, `deadEndChance` is the chance that a corridor sprouts a branch that leads nowhere, roughly 3 to 8 tiles long, from a random tile of the corridor. At 0, the default, there are no dead ends at all.

## Grown dungeons

```ts
import { generateDigDungeon } from 'angstloch';

const { grid, rooms, exits } = generateDigDungeon({
  width: 61,
  height: 41,
  grow: { gap: { min: 2, max: 6 } },
  corridors: { loopChance: 0.2 },
});
```

`generateDigDungeon` builds a dungeon out of a first room, on a map of rock:

1. [`placeClusteredRooms`](../steps/place-clustered-rooms.md) places the templated rooms, the first of them in the middle of the map unless it has `positions` or `areas` of its own, and then grows the ordinary rooms off it, or off an ordinary room in the middle when there are no templates. Each new room goes beyond a wall of a room there is, a `gap` of corridor away (1 to 4 tiles by default) and facing it, until `fill` and `roomCount` are met or 300 tries in a row fail.
2. [`digCorridors`](../steps/dig-corridors.md) joins the rooms with corridors, nearest first, so most rooms are joined to the room they were built off by a short corridor, or by a door in the wall they share for a `gap` of 0.

It takes the options of each step under a key of its own (see [`DigDungeonOptions`](#digdungeonoptions)) and returns a [`RoomDungeonResult`](#roomdungeonresult), as `generateRoomDungeon` does. The templates other than the first are placed before growing starts, wherever they fit, and are joined by the corridors afterwards. Templated rooms count towards `roomCount` and `fill`.

### Example map

The map this code makes with seed 1 (`mulberry32` is defined in the [quick start](../../README.md#quick-start)):

<!-- map: generate-dig-dungeon -->

```ts
import { generateDigDungeon } from 'angstloch';

const result = generateDigDungeon({
  width: 80,
  height: 25,
  random: mulberry32(1),
});
```

```text
################################################################################
################################################################################
################################################################################
################################################################################
####################################################################....########
####################################################################....########
####################################################################....########
###############################..............#####################.+....########
###############################.############.###......############.#....########
##############.....#####......#.####.......#.###......####....+....+....########
##############.....+...+......#.####.......#.###......####....######....########
##############.....#####......+.####.......+..##......####....##################
##############.....#####......######.......##.##+##+######+#####################
##############.....#################.......##.+...#.#......#####################
##############.....#################.......####...#.+......#####################
####################################.......####...#.#......#####################
##########################################+####...#.#......#####################
##########################################.####+###+############################
##########################################+###.......###########################
#####################################......###.......###########################
#####################################......###.......###########################
#####################################......+.+.......###########################
#####################################......#####################################
################################################################################
################################################################################
```

<!-- /map -->

## Symmetry

Both generators can be symmetric. The layout symmetry is the `symmetry` and `symmetryChance` of each step, the rooms and `corridors`, and the corridor symmetry is under `corridors`.

```ts
import { generateDigDungeon, generateRoomDungeon } from 'angstloch';

const grown = generateDigDungeon({
  width: 61,
  height: 41,
  grow: { symmetry: 'both' },
  corridors: { symmetry: 'both' },
});
const roomFirst = generateRoomDungeon({
  width: 61,
  height: 41,
  scatter: { symmetry: 'both' },
  corridors: { symmetry: 'both' },
});
```

There are two independent kinds of symmetry, each with a chance. They can be used together. At a chance of 1 the symmetry is applied everywhere. At 0 it is ignored completely, and the result is the same as with `none`. In between, it is applied to that share of the dungeon: the more, the closer to symmetric.

| Option                             | Default | Description                                                                                                                         |
| ---------------------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `symmetry` of the rooms            | `none`  | Mirrors or rotates the layout of the dungeon about the center of the map: `none`, `horizontal`, `vertical`, `both` or `rotational`. |
| `symmetryChance` of the rooms      | `1`     | How often the layout is symmetric, from 0 to 1.                                                                                     |
| `corridors.symmetry`               | `none`  | Mirrors the corridors, exits and doors the same way.                                                                                |
| `corridors.symmetryChance`         | `1`     | How often a corridor gets its twins, from 0 to 1.                                                                                   |
| `corridors.corridorSymmetry`       | `none`  | Makes corridors follow the pattern of a maze: `none`, `whirlpool` or `snowflake`.                                                   |
| `corridors.corridorSymmetryChance` | `1`     | How strongly corridors follow `corridorSymmetry`, from 0 to 1.                                                                      |

The rooms and the corridors are mirrored by their own steps, each with its own `symmetry` and `symmetryChance`, and neither takes the other's. A symmetric dungeon gives the same settings to both; symmetric rooms with free corridors leave them out of `corridors`.

### Layout symmetry

The layout symmetry, `symmetry`, makes the dungeon look the same when mirrored or turned:

- `horizontal` mirrors it from left to right: the left half is the mirror image of the right half.
- `vertical` mirrors it from top to bottom.
- `both` does both at once, so that the dungeon is made of four mirrored quarters.
- `rotational` turns it by 180° about the center. The result looks the same upside down.

Rooms, corridors, exits and doors are all mirrored. A room and its _twins_ get the same exits (as far as the usual [exit counts](#exits-per-room) allow), and an exit and its twins are all open or all have a door, whatever `doorChance` is. Loops and dead ends are mirrored, too. Rooms that lie on an axis are their own twins. Both generators put a room in the middle of the map that is its own twin: `placeClusteredRooms` grows from it, and `placeScatteredRooms` and `placePartitionedRooms` place it before all others. Every room is still reachable, and all the rules of corridors apply as usual.

`symmetryChance` is rolled for every room and corridor that is placed, and for every extra exit, loop and dead end. When the roll fails, the room or corridor gets no twins. A corridor gets twins only where the rooms it joins have theirs, so the unsymmetric parts stay unsymmetric. Where a mirrored room, corridor or exit would not fit, because it would collide with something, the whole step is skipped, which keeps a dungeon at chance 1 perfectly symmetric.

Things to know:

- `roomCount` and `fill` count every room, twins included. As rooms come in sets of up to four, the room count can end up a little short of `roomCount.max`, and a set that would exceed it is not built.
- The axes run through the center of the map. With `lattice` placement, a map with an even width or height is treated as one tile smaller, so that the axis falls on a lattice tile, and the last row or column stays empty as extra border: an 80 by 50 map is symmetric as if it were 79 by 49.
- The first room must sit exactly on the axis, which needs its size to have the same parity as the map (and, on the lattice, the right position on it). If its random size does not, it is made one step (2 on the lattice) wider, or narrower if it is as wide as it can be. It can therefore stray one step outside `roomWidth` or `roomHeight`, but only when the range has a single size.
- Symmetry changes what the generator makes, so the same seed gives another dungeon than without it.

How each generator applies the layout symmetry:

- The rooms. With `grow`, each room that is grown is mirrored together with its twins at the given chance, and it is only built if all of them fit. With `scatter`, each room that is placed is mirrored together with its twins at the given chance, and rooms may lie on an axis. With `partition`, only one half (or quarter) of the map is partitioned and its areas are mirrored; rooms never straddle an axis, apart from the middle room. With a chance below 1, a mirrored area gets a room of its own instead of a twin.
- The corridors. `digCorridors` mirrors every link between the rooms. A corridor that crosses an axis cannot be mirrored, as it would meet its own image, so the two halves are joined through the room in the middle. A room that cannot be linked symmetrically is dropped together with its twins, so the layout stays symmetric.
- A `roomCount.max` below the size of a set of twins can leave few rooms; with `partition`, `fill` is met roughly, as without symmetry, but less closely.

### Corridor symmetry

`corridorSymmetry` is the `pattern` of [`digMaze`](../steps/dig-maze.md), applied to the direction of corridors. It steers corridors by where they are on the map:

- `snowflake` makes corridors radiate from the center. Where a tile is further from the center horizontally than vertically, corridors there run horizontally, and the other way round.
- `whirlpool` makes them twirl around the center, with the same rule turned by 90°.

`corridorSymmetryChance` is how often the pattern applies, instead of `horizontalBias` and `verticalBias`. `straight` limits the effect. Corridors are routed on a map where each tile has a preferred axis, chosen by the chance. Corridors prefer to follow it, as moving along the other axis costs more, but they still go wherever they have to.

Corridor symmetry does not make the layout symmetric.

## Doors

The generator never decides what a door looks like, it only tells you where doors can go.

- Every opening in a room's wall is an exit and is listed in `exits`, whether it has a door or not.
- `doorChance` decides which exits get a door. In the grid an exit with a door is `Tile.Door` and one without is `Tile.Floor`. `corridors.doorChance` decides for the exits that the corridors open in ordinary rooms, and the `doorChance` of the rooms for the `Exit` and `OptionalExit` cells of templates, decided when the template is placed: an optional exit that the corridors open later keeps that answer.
- `Exit#door` tells which is which. To turn an exit without a door into a door, for example because a themed room requires one, use `Exit#position`; that tile is already open floor.
- `Room#exits` lists the exits of one room, and `Room#exitCount` and `Room#doorCount` give the totals.

```ts
const { rooms, exits } = generateRoomDungeon({
  width: 61,
  height: 41,
  corridors: { doorChance: 0.5 },
});

for (const room of rooms) {
  const openings = room.exits.map((index) => exits[index]);
  console.log(
    `room ${room.id}: ${room.exitCount} exits, ${room.doorCount} doors`,
    openings,
  );
}
```

## `DungeonResult`

The fields that every dungeon reports; the generators return a [`RoomDungeonResult`](#roomdungeonresult), which has them too.

| Field   | Description                                                                                                |
| ------- | ---------------------------------------------------------------------------------------------------------- |
| `grid`  | The map. Room and corridor floors are `Tile.Floor`, doors are `Tile.Door`, everything else is `Tile.Wall`. |
| `rooms` | The rooms, in the order they were placed. `rooms.length` is the total number of rooms.                     |
| `exits` | Every exit of every room, with or without a door. Filter on `door` for the doors alone.                    |
| `fill`  | The share of the map actually covered by room floors, from 0 to 1.                                         |
