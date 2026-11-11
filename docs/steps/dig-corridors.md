# `digCorridors`

`digCorridors(options?)` is a step that joins the rooms of a dungeon with corridors and doors, the second step of [`generateRoomDungeon`](../generators/dungeon.md) (see [connections](../generators/dungeon.md#connections)): the rooms of [`placeScatteredRooms`](place-scattered-rooms.md), [`placePartitionedRooms`](place-partitioned-rooms.md) or [`placeClusteredRooms`](place-clustered-rooms.md), or of a step of your own that adds `rooms` and `roomShapes`. Only rooms that have no exits yet are joined by their own exits; a room opened by another step counts as one with the floor its doors open onto, and is joined with it as a [feature](#features). It needs a map that starts as wall, and it checks every option when it is made.

```ts
import {
  digCorridors,
  emptyMap,
  pipeline,
  placeScatteredRooms,
  Tile,
} from 'angstloch';

const { grid, rooms, roomExits } = pipeline(
  emptyMap({ width: 61, height: 41, tile: Tile.Wall }),
  [
    placeScatteredRooms({ symmetry: 'horizontal' }),
    digCorridors({ symmetry: 'horizontal', loopChance: 0.3 }),
  ],
  { random: mulberry32(42) },
);
```

| Option                   | Default     | Meaning                                                                                                                                                                                                                                    |
| ------------------------ | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `connection`             | `'nearest'` | How rooms are joined: `'nearest'`, `'bsp'` or `'bsp-random'`, as for dungeons (see [connections](../generators/dungeon.md#connections)).                                                                                                   |
| `exitsPerRoom`           | `{ 1, 3 }`  | Number of exits per room, doors or not, a `Range` of 1 or more. Each room draws its own number. A room with fewer links gets more, which makes loops; a room with more shares its exits and the corridors branch off outside. Best effort. |
| `loopChance`             | 0.1         | Chance of an extra corridor between two nearby rooms that are joined already, from 0 to 1, one roll for each pair of neighbors.                                                                                                            |
| `deadEndChance`          | 0           | Chance that a corridor sprouts a branch that leads nowhere, from 0 to 1.                                                                                                                                                                   |
| `doorChance`             | 1           | Chance that an exit gets a door, from 0 to 1. Exits without a door are plain openings. The doors of templates, their optional exits included, were decided by the step that placed them.                                                   |
| `straight`               | 0.5         | Preference of corridors for going straight, from 0 (they wander) to 1 (they turn as little as possible).                                                                                                                                   |
| `horizontalBias`         | 0           | Weight of horizontal corridor sections against `verticalBias`. Only the ratio matters; a lone value against 0 means always.                                                                                                                |
| `verticalBias`           | 0           | Weight of vertical corridor sections against `horizontalBias`.                                                                                                                                                                             |
| `placement`              | `'free'`    | `'lattice'` keeps corridors and exits on odd coordinates, like a maze, for rooms placed on the lattice.                                                                                                                                    |
| `symmetry`               | `'none'`    | Mirrors or rotates corridors, exits and doors about the middle of the map: `'horizontal'`, `'vertical'`, `'both'` or `'rotational'`. A corridor gets its twins only where the rooms it joins have theirs.                                  |
| `symmetryChance`         | 1           | How often a corridor gets its twins, from 0 (never) to 1 (always).                                                                                                                                                                         |
| `corridorSymmetry`       | `'none'`    | Makes corridors follow the pattern of a maze: `'whirlpool'` twirls them around the middle of the map and `'snowflake'` makes them radiate from it (see [corridor symmetry](../generators/dungeon.md#corridor-symmetry)).                   |
| `corridorSymmetryChance` | 1           | How strongly corridors follow `corridorSymmetry`, from 0 (not at all) to 1 (every choice of direction does).                                                                                                                               |

- **Symmetry is per step.** The rooms are mirrored by the step that places them, the corridors by this one, so a symmetric dungeon passes the same `symmetry`, `symmetryChance` and `placement` to both. Symmetric rooms with free corridors, or the other way round, are fine.
- **Where a room opens.** Exits come from each room's shape in `roomShapes`, at the potential exits that are still `Reserve.Openable`. Two ordinary rooms that share a wall (`roomSpacing` 1) are joined by one door in it, which both rooms count. Every fixed exit of a template gets a corridor.
- **What is in the way.** Corridors keep off every tile that is not free (see [`isFree`](../composing.md#mapstate)): reserved tiles, and the floor, roads or water of earlier steps, so they route round them.
- **Features join too.** Every piece of floor outside the shapes of the rooms it joins is joined as well, as a stand-in room: a cavern of [`digNoiseCave`](dig-noise-cave.md) or [`digCellularCave`](dig-cellular-cave.md), a hall of [`digPillarHalls`](dig-pillar-halls.md), a whole mine, a maze, or the corridors of an earlier `digCorridors` (see [features](#features)). Where a corridor enters a hall or a cavern, that is an exit of it (see [ways into halls and caverns](../rooms.md#ways-into-halls-and-caverns)); where it enters any other stand-in, it is a plain opening and no exit.
- **Rooms that cannot be joined.** An ordinary room that cannot be joined is dropped, with its mirror images: its tiles go back to the base tile and its reservation is cleared. A templated room is never dropped: the corridors are routed again with new draws, up to 3 times in all, and then the step throws a [`TemplatePlacementError`](../room-templates.md), which [`pipeline`](../composing.md#pipeline) answers with a new map, rooms included.
- **What it reserves.** Every exit of a room goes through [`openReserved`](../composing.md#mapstate), so it and the potential exits round it become `Reserve.Solid`. Corridors reserve nothing.
- **Needs no rooms.** It **uses** `rooms`, `roomShapes` and `roomExits` from the steps before it, if any, and **adds** all three again: the dropped rooms left out, the rest renumbered with their shapes and the exits, and the new exits appended to `roomExits` (an [`Exit`](../rooms.md#exit) each, listed on its rooms). With no rooms to join, it joins the [features](#features) alone, such as the halls of [`digPillarHalls`](dig-pillar-halls.md).

## Example map

The map this code makes with seed 1 (`mulberry32` is defined in the [quick start](../../README.md#quick-start)), before and after `digCorridors`:

<!-- map: dig-corridors -->

```ts
import {
  emptyMap,
  pipeline,
  Tile,
  placeScatteredRooms,
  digCorridors,
} from 'angstloch';

const result = pipeline(
  emptyMap({ width: 38, height: 22, tile: Tile.Wall }),
  [placeScatteredRooms(), digCorridors()],
  { random: mulberry32(1) },
);
```

```text
before                                    after
######################################    ######################################
######################################    ######################################
######################################    ######################################
######################################    ######################################
######################################    ######################################
#############.....####################    #############.....####################
#############.....####################    #######.....+.....####################
###...#######.....####################    ###...+.#####.....+.##################
###...#########################......#    ###...#######+#####.###########......#
###...###.......###############......#    ###...###.......###...........+......#
###...###.......###############......#    ###...###.......###.###########......#
###...###.......###############......#    ###...+.#.......###.###########......#
#########.......###############......#    ###+###.+.......###.###########......#
#########.......######################    ###.#####.......###.##################
#########.......######################    ###.#####.......###.##################
#########.......######################    ###.#####.......###.##################
######################################    ###.###############.##################
######################################    ###.................##################
######################################    ######################################
######################################    ######################################
######################################    ######################################
######################################    ######################################
```

<!-- /map -->

## Features

Any tile outside the shapes of the rooms that have no exits yet that is not the base tile is floor of a feature, and the pieces it makes, joined along edges, are joined like rooms. A room that has exits already, such as a cell of a [cell block](place-cell-blocks.md) or a room of [`openMazeRooms`](open-maze-rooms.md), is part of the piece its doors open onto: rooms and floor joined by open doors count as one thing to join. A feature need not say what it is: whatever made it, `digCorridors` finds it on the map. The halls of `digPillarHalls`, the caverns of the cave steps and the chambers, cisterns and tunnels of [`digSewers`](dig-sewers.md) are listed in `rooms` all the same, by their kinds `'pillarHall'`, `'cavern'`, `'sewerChamber'`, `'cistern'` and `'sewerTunnel'`, but are joined as features, on their floor (see [halls and caverns](../rooms.md#room)), and get an exit wherever a corridor enters them (see [ways into halls and caverns](../rooms.md#ways-into-halls-and-caverns)). This makes "rooms round a cavern and a pillar hall" a list of steps:

```ts
import {
  digCorridors,
  digNoiseCave,
  digPillarHalls,
  emptyMap,
  pipeline,
  placeScatteredRooms,
  Tile,
} from 'angstloch';

const { grid, rooms } = pipeline(
  emptyMap({ width: 61, height: 41, tile: Tile.Wall }),
  [
    digPillarHalls({
      area: { width: { min: 16, max: 16 }, height: { min: 12, max: 12 } },
    }),
    digNoiseCave({
      largestOnly: true,
      area: { width: { min: 14, max: 18 }, height: { min: 10, max: 14 } },
    }),
    // the rooms keep clear of the hall and the cavern, and the corridors join all of them
    placeScatteredRooms(),
    digCorridors(),
  ],
  { random: mulberry32(42) },
);
```

- **The shape of a feature.** Its floor, and the walls that touch it from outside, which are its potential exits: a wall of rock that is free (not reserved), or one reserved `Openable` that the shape of no room to join holds, such as the entrance of a [cell block](place-cell-blocks.md), or a potential exit of a room that has exits already, such as the entrance in the far wall of a [guard room](place-cell-blocks.md#guard-rooms) the block is entered through. A wall that touches another feature corner to corner is no exit, since opening it would join the two through the corner. Rock that the feature encloses and that nothing else reaches, such as a pillar, is no exit, and corridors stay out of it.
- **No slipping past a corner.** The wall off a corner of a feature's floor, which touches the floor corner to corner only, is part of its shape, and corridors stay out of it too, so a corridor never meets a feature, a chamber of a sewer or the edge of a cavern, diagonally, where a walker who moves diagonally could slip between them past the wall. The distance to a feature, which orders the links, is measured to its nearest wall, not to the box round it, since the box of a whole mine covers the map.
- **How it is joined.** Like a templated room: corridors route round its floor and walls, never through it, and it gets the exits that `exitsPerRoom` draws, loops and dead ends like any room. It is never joined by a door in a shared wall.
- **Where a corridor reaches it,** the wall turns into floor: no door, whatever `doorChance` says, and no entry in `roomExits`, which stays about rooms. Nothing is reserved there, since features reserve nothing. A wall that was reserved `Openable` is the exception: it is an entrance that a step left on purpose, so it gets a door by `doorChance` and is opened through [`openReserved`](../composing.md#mapstate). It gets no entry in `roomExits`, unless it is in the shape of a room that had exits already: then it is an [`Exit`](../rooms.md#exit) of that room, appended to `roomExits` and listed on the room, so the room keeps a list of all its ways in. The same holds for such a wall opened with no corridor, because floor reaches it from beyond, or because floor comes within two tiles of it.
- **An entrance a tile or two short.** When a feature built after a [cell block](place-cell-blocks.md) stops a tile short of the tile in front of its entrance, that tile is a potential exit of both, or touches the feature corner to corner, and no corridor fits there. So before routing, an `Openable` wall with floor on one side and, straight out on the other side through at most two tiles of free rock, the floor of another piece that the last of those tiles touches along an edge, is opened, and the tiles out to that floor become floor, with no corridor.
- **It is never dropped.** A feature that cannot be joined to the largest group of rooms fails like a templated room: the corridors are routed again, up to 3 times, and then the step throws an `Error` that names a tile of its floor, which [`pipeline`](../composing.md#pipeline) answers with a new map. `digCorridors` adds no feature to `rooms`; the halls and caverns that are there already stay there, with their shapes, their ids following the renumbering.
- **Over 200 seeds** of the run above with 0, 2 and 5 templated rooms (`npm run check:dungeon`), no map failed; at 5 templated rooms, 6 seeds needed a second map, and a map took 6 to 20 ms on average.
