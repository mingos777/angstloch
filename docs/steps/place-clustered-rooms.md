# `placeClusteredRooms`

`placeClusteredRooms(options?)` is a step that grows the rooms of a dungeon from a seed, the first step of [`generateDigDungeon`](../generators/dungeon.md#grown-dungeons): each new room goes beyond a wall of a room there is, a `gap` of corridor away and facing it, so the rooms cluster and [`digCorridors`](dig-corridors.md) joins most of them to the room they were built off with a short corridor. It takes the options of [`placeScatteredRooms`](place-scattered-rooms.md) but `spacingUniformity`, and works the same way in templates, what is in the way, what it reserves and the extras. It needs a map that starts as wall, and it checks every option and template when it is made.

```ts
import {
  digCorridors,
  emptyMap,
  placeClusteredRooms,
  pipeline,
  Tile,
} from 'angstloch';

const { grid, rooms, roomExits } = pipeline(
  emptyMap({ width: 61, height: 41, tile: Tile.Wall }),
  [placeClusteredRooms({ gap: { min: 1, max: 4 } }), digCorridors()],
  { random: mulberry32(42) },
);
```

| Option           | Default    | Meaning                                                                                                                                                                                                                                                                                   |
| ---------------- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `gap`            | `{ 1, 4 }` | Tiles of corridor between the wall of a new room and the wall of the room it is built off, whole numbers of 0 or more. 0 puts the new room against the wall, sharing it, which needs a `roomSpacing` of 1. With `'lattice'` placement a gap is rounded to an odd length (2 to 1, 4 to 3). |
| `horizontalBias` | 0          | Weight of the left and right walls, which new rooms are built beyond, against `verticalBias`. Only the ratio matters, so set both; a lone value against 0 means always.                                                                                                                   |
| `verticalBias`   | 0          | Weight of the top and bottom walls against `horizontalBias`.                                                                                                                                                                                                                              |
| the rest         |            | As for [`placeScatteredRooms`](place-scattered-rooms.md): `placement`, `roomWidth`, `roomHeight`, `sizeUniformity`, `roomCount`, `roomSpacing`, `fill`, `templates`, `templateSymmetry`, `doorChance`, `symmetry`, `symmetryChance`, `area` and `count`.                                  |

- **The seed.** When the area is the whole map and earlier steps placed rooms, the new ones grow from those. Otherwise they grow from the first template, which goes in the middle unless it has `positions` or `areas` of its own, or else from an ordinary room in the middle. When something is in the way there, that room moves to the nearest spot that fits; with a `symmetry` it must be its own mirror image, so nothing grows. The other templates are placed first, wherever they fit, and are joined later by the corridors, not grown from.
- **Growing.** Each try picks a room, a wall of it by the biases, a gap, a size and a spot along the wall, off its corners, and the new room is placed so that its floor faces that spot. A room from which 20 tries in a row failed is crowded, and is only picked again when every room is. Growing stops at `roomCount.max`, at the `fill` once `roomCount.min` is reached, or when 300 tries in a row fail.
- **Gaps and spacing.** The floors of two rooms a gap of `n` apart are `n + 2` tiles apart (a wall, the corridor and a wall), and 1 tile for a gap of 0. A gap whose rooms would be closer than `roomSpacing` is left out of the range, and a range with nothing left throws a `RangeError` when the step is made. Rooms keep `roomSpacing` from every other room too, not only from the one they are built off, and from the rooms of an earlier step two wall tiles at least, as in `placeScatteredRooms`, so a gap of 0 never joins them.
- **Symmetry.** With a `symmetry`, a new room brings its mirror images along as often as `symmetryChance` says, and all of them must fit.

## Example map

The map this code makes with seed 1 (`mulberry32` is defined in the [quick start](../../README.md#quick-start)):

<!-- map: place-clustered-rooms -->

```ts
import { emptyMap, pipeline, Tile, placeClusteredRooms } from 'angstloch';

const result = pipeline(
  emptyMap({ width: 80, height: 25, tile: Tile.Wall }),
  [placeClusteredRooms()],
  { random: mulberry32(1) },
);
```

```text
################################################################################
################################################################################
################################################################################
################################################################################
####################################################################....########
####################################################################....########
####################################################################....########
####################################################################....########
################################################......##############....########
##############.....#####......######.......#####......####....######....########
##############.....#####......######.......#####......####....######....########
##############.....#####......######.......#####......####....##################
##############.....#####......######.......#####################################
##############.....#################.......####...###......#####################
##############.....#################.......####...###......#####################
####################################.......####...###......#####################
###############################################...###......#####################
################################################################################
##############################################.......###########################
#####################################......###.......###########################
#####################################......###.......###########################
#####################################......###.......###########################
#####################################......#####################################
################################################################################
################################################################################
```

<!-- /map -->
