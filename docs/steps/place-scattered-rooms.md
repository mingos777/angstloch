# `placeScatteredRooms`

`placeScatteredRooms(options?)` is a step that places the rooms of a dungeon, the default first step of [`generateRoomDungeon`](../generators/dungeon.md) (see [placement of rooms](../generators/dungeon.md#placement-of-rooms)): the templates first, then ordinary rooms tried at random spots, one after another, until `roomCount.max` rooms are placed, the `fill` is reached with at least `roomCount.min` rooms, or 100 rooms in a row do not fit. It carves the rooms but does not open them; joining them with corridors is a later step's job. It needs a map that starts as wall, and it checks every option and template when it is made.

```ts
import { emptyMap, pipeline, placeScatteredRooms, Tile } from 'angstloch';

const { grid, rooms, roomShapes, reserved } = pipeline(
  emptyMap({ width: 61, height: 41, tile: Tile.Wall }),
  [
    placeScatteredRooms({
      fill: 0.2,
      roomSpacing: 3,
      // closet is the template of the example under room templates
      templates: [closet],
    }),
  ],
  { random: mulberry32(42) },
);
```

| Option              | Default         | Meaning                                                                                                                                                                                                                                                                                             |
| ------------------- | --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `placement`         | `'free'`        | `'free'` or `'lattice'`, as for dungeons (see [`placement`](../generators/dungeon.md#placement)): lattice rooms start on odd coordinates and have odd sizes, and an even `roomSpacing` is rounded up to an odd one.                                                                                 |
| `roomWidth`         | `{ 3, 7 }`      | Room width in tiles, without the walls, 1 or more.                                                                                                                                                                                                                                                  |
| `roomHeight`        | `{ 3, 7 }`      | Room height in tiles, without the walls, 1 or more.                                                                                                                                                                                                                                                 |
| `sizeUniformity`    | 0               | How alike room sizes are, from 0 (anything within the ranges) to 1 (every room has the middle size).                                                                                                                                                                                                |
| `roomCount`         | `{ 1, no max }` | Number of rooms in each area, templated rooms and mirror images included, whole numbers of 0 or more. Placing stops at `max`; `fill` counts only once `min` is reached. Fewer are placed when no more fit.                                                                                          |
| `roomSpacing`       | 1               | Fewest wall tiles between the floors of two rooms, 1 or more. With 1 rooms may share a wall; with 3 or more a corridor fits between them.                                                                                                                                                           |
| `fill`              | 0.12            | Target share of each area covered by room floors, from 0 to 1. The last room may overshoot it.                                                                                                                                                                                                      |
| `spacingUniformity` | 0               | How evenly rooms are spread, from 0 to 1: several candidate rooms are tried at once and the one farthest from the other rooms is kept, one candidate at 0 and ten at 1.                                                                                                                             |
| `templates`         | none            | [`RoomTemplate`](../room-templates.md) objects, placed before the ordinary rooms. Their positions and areas are in the coordinates of the `area`. One that cannot be placed fails the attempt.                                                                                                      |
| `templateSymmetry`  | false           | Whether templated rooms get mirror images, which follow `symmetry` always, whatever `symmetryChance` says.                                                                                                                                                                                          |
| `doorChance`        | 1               | Chance that an `Exit` or `OptionalExit` cell of a template gets a door, from 0 to 1, decided when it is placed and kept by `digCorridors` and `digCatacombs` if they open an optional exit later. `Door` cells always do. The exits of ordinary rooms are decided by the step that joins the rooms. |
| `symmetry`          | `'none'`        | Mirrors or rotates the rooms about the middle of their area: `'horizontal'`, `'vertical'`, `'both'` or `'rotational'`, as [layout symmetry](../generators/dungeon.md#layout-symmetry) does for a dungeon. A room is put in the middle first.                                                        |
| `symmetryChance`    | 1               | How often a room gets its twins, from 0 (never) to 1 (always).                                                                                                                                                                                                                                      |
| `area`              | the map         | The size of the box each set of rooms goes in, an `AreaSpec` (see [Areas](../composing.md#areas)), on the lattice with `'lattice'` placement.                                                                                                                                                       |
| `count`             | `{ 1, 1 }`      | How many sets of rooms to place, each in its own box. More than one needs an `area` smaller than the map.                                                                                                                                                                                           |

- **What is in the way.** Ordinary rooms keep `roomSpacing` from each other, from the templates, from the tiles in front of the fixed exits of templates and of the entrances of [cell blocks](place-cell-blocks.md) that are not opened yet, and from every tile that is not free (see [`isFree`](../composing.md#mapstate)), such as a mine, a cave or the rooms of an earlier step; templates keep the same distance from those tiles. So rooms of an earlier step are at least two wall tiles away, with no shared wall.
- **Templates.** A template that cannot be placed throws a [`TemplatePlacementError`](../room-templates.md), which [`pipeline`](../composing.md#pipeline) answers with a new map, up to its `attempts`. `Room.template` is an index into the `templates` of the step that placed the room.
- **What it reserves.** Every room reserves its footprint, as [`placeMineRooms`](place-mine-rooms.md) does: walls, floor and inner doorways are `Reserve.Solid`, and potential exits are `Reserve.Openable`. The whole ring of an ordinary room, but its corners, is `Openable`. Where two rooms share a wall (`roomSpacing` 1) a tile stays `Openable` when it is a side of both rooms, and is `Solid` when it is the corner of either.
- **Uses** `rooms` and `roomShapes` from the steps before it, and the cell blocks in `roomGroups` (for the tiles in front of their entrances), and **adds** `rooms` and `roomShapes` again with its own appended, with ids that follow on: in each area, templated rooms first, then ordinary ones, each with a [`RoomShape`](place-mine-rooms.md) in `roomShapes`. Its rooms have no exits yet.

## Example map

The map this code makes with seed 1 (`mulberry32` is defined in the [quick start](../../README.md#quick-start)):

<!-- map: place-scattered-rooms -->

```ts
import { emptyMap, pipeline, Tile, placeScatteredRooms } from 'angstloch';

const result = pipeline(
  emptyMap({ width: 80, height: 25, tile: Tile.Wall }),
  [placeScatteredRooms()],
  { random: mulberry32(1) },
);
```

```text
################################################################################
##############......############################################################
##############......############################################################
##############......############################################################
##############......############################################################
##################################################################...###########
##########......##############.....#########################.....#...###########
##########......##############.....#########################.....#...###########
######...#......##############.....#########################.....#...###########
######...#......############################################.....#...####......#
######...#......############################################.....#...####......#
######...############.......#############################################......#
######...############.......#############################################......#
#####################.......#############################################......#
#####################.......#######...###....###################################
#####################.......#######...###....###################################
#####################.......#######...###....###################################
#####################.......#######...###....###################################
###################################...###....###################################
###################################...###....###################################
################################################################################
################################################################################
################################################################################
################################################################################
################################################################################
```

<!-- /map -->
