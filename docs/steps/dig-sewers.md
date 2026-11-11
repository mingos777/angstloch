# `digSewers`

`digSewers(options?)` is a step that digs a sewer: a straight trunk canal along its area, with straight branches off it, or off earlier branches, at right angles. A branch meets its parent in a junction chamber, and may end in a head chamber; with `cisterns`, some of those chambers are cisterns, with a basin of water. The canals are `ShallowWater`, with a walkway of `Floor` one tile wide on each side, and `Bridge` tiles carry the walkways over the water. It digs no corridors: [`digCorridors`](dig-corridors.md) or [`digVeins`](dig-veins.md) joins the sewer to the rest of the map, on its walkways. Like `digPillarHalls` it needs a map that starts as wall, takes `area` and `count`, and checks every option when it is made.

```ts
import {
  digCorridors,
  digSewers,
  emptyMap,
  pipeline,
  placeScatteredRooms,
  Tile,
} from 'angstloch';

const { grid, rooms, roomGroups } = pipeline(
  emptyMap({ width: 80, height: 50, tile: Tile.Wall }),
  [
    digSewers(),
    // the rooms keep clear of the sewer, and the corridors reach its walkways
    placeScatteredRooms(),
    digCorridors(),
  ],
  { random: mulberry32(42) },
);
const sewer = roomGroups.find(({ kind }) => kind === 'sewer');
```

A sewer of 44 by 22 with a horizontal trunk two tiles wide, both ends of it outfalls, and two branches, before it is joined (`~` is water, `=` a bridge, `o` an outfall, still wall):

```
############################################
############################################
############################################
############################################
############################################
############################################
#..........................................#
#~=~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~=~~#
#~=~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~=~~#
o..............=.............=.............o
############...~....######...~....##########
############...~....######...~....##########
############...~....######...~....##########
##############.~.###########.~.#############
##############.~.###########.~.#############
##############.~.###########.~.#############
##############.~.###########.~.#############
##############.~.###########.~.#############
##############.~.###########.~.#############
############################################
############################################
############################################
```

| Option          | Default       | Meaning                                                                                                                                                                                                                                                                                                                                                                                      |
| --------------- | ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `orientation`   | `'any'`       | Which way the trunk runs: `'horizontal'`, `'vertical'`, or `'any'`, drawn for each sewer among the ways that fit its area.                                                                                                                                                                                                                                                                   |
| `trunkWidth`    | `{ 2, 3 }`    | The width of the trunk's water in whole tiles, 1 or more, drawn once per sewer and cut down to what the area has room for.                                                                                                                                                                                                                                                                   |
| `branchWidth`   | `{ 1, 1 }`    | The width of a branch's water in whole tiles, 1 or more, drawn for each branch.                                                                                                                                                                                                                                                                                                              |
| `branches`      | `{ 3, 6 }`    | How many branches each sewer gets, a `Range` of whole numbers, 0 or more. Each grows off the trunk or off an earlier branch, at a spot picked by the length of the canals. A branch that finds no room is left out, so a crowded area gets fewer: a sewer on 70 by 40 holds about 4.                                                                                                         |
| `branchLength`  | `{ 5, 12 }`   | The length of a branch's tunnel, from its junction chamber to its end or its head chamber, in whole tiles, 1 or more. A branch is cut down to the room it has, and left out below `min`.                                                                                                                                                                                                     |
| `chamberSize`   | `{ 5, 9 }`    | The width and the height of a chamber in whole tiles, each side drawn on its own, and raised to hold the tunnels that meet there: a junction chamber spans its parent's tunnel and reaches at least a tile past it on the branch's side and past the branch's walkways along the parent; a head chamber reaches a tile past the branch's walkways on each side and is at least 3 tiles long. |
| `headChance`    | 0.5           | The chance that a branch ends in a head chamber, from 0 to 1. A head chamber that finds no room is left out.                                                                                                                                                                                                                                                                                 |
| `cisterns`      | `{ 0, 0 }`    | How many cisterns each sewer gets, a `Range` of whole numbers, 0 or more. A cistern takes the place of the junction chamber or the head chamber of a branch, so a sewer has at most as many as it has branches, and one that finds no room is left out.                                                                                                                                      |
| `cisternSize`   | `{ 7, 11 }`   | The width and the height of a cistern in whole tiles, ledges included, each side drawn on its own and raised to hold the tunnels that meet there: at a junction as for a chamber, with a tile more across the parent's tunnel, for the basin; at a head as for a chamber, and to at least 4 tiles long.                                                                                      |
| `cisternLedges` | `{ 1, 4 }`    | How many sides of a cistern have a ledge, a `Range` of whole numbers from 1 to 4, drawn for each cistern and raised to the ledges its canals need (see cisterns below).                                                                                                                                                                                                                      |
| `columnChance`  | 0.5           | The chance that a cistern has columns standing in its water, from 0 to 1.                                                                                                                                                                                                                                                                                                                    |
| `columnSpacing` | `{ 2, 3 }`    | The water between two columns in whole tiles, 1 or more, drawn once for each cistern.                                                                                                                                                                                                                                                                                                        |
| `bridgeChance`  | 0.25          | The chance that a stretch of tunnel gets a bridge across its canal besides the ones that keep the walkways joined, from 0 to 1.                                                                                                                                                                                                                                                              |
| `outfalls`      | `{ 1, 2 }`    | How many ends of the trunk reach the border of the map as outfalls, a `Range` of whole numbers from 0 to 2. The trunk runs a way that allows the number drawn, or as many as its area allows. `{ 0, 0 }` keeps the sewer off the border.                                                                                                                                                     |
| `pierceBorder`  | `false`       | Whether the water of an outfall breaks through the border: `false` stops it at a mouth in the border wall, `true` runs it onto the border tile, off the map.                                                                                                                                                                                                                                 |
| `area`          | the whole map | The size of the part of the map to dig in, see [areas](../composing.md#areas). The sewer is closed in by a ring of wall inside it. Its smallest size must hold a trunk: 10 tiles along it and 5 across, or the step throws a `RangeError` before the first attempt.                                                                                                                          |
| `count`         | `{ 1, 1 }`    | How many sewers to dig, each in an area of its own.                                                                                                                                                                                                                                                                                                                                          |

With `orientation: 'horizontal'`, `branches: { min: 2, max: 3 }`, `cisterns: { min: 2, max: 2 }` and `columnChance: 1` on 50 by 26, a sewer gets a cistern at the junction of a branch on the left, its basin holding the trunk's water, and one at the head of a branch on the right, with ledges on all four sides, and an outfall at the left end of the trunk (the top rows of rock left out):

```
##################################################
##################################################
o..............................................###
#~~~~~~=~~~~~~~~~~~~~=~~~~~~~~~~~~~~~~~~~~~~~~~###
#~~~~~~=~~~~~~~~~~~~~=~~~~~~~~~~~~~~~~~~~~~~~~~###
#~~~~~~=~~~~~~~~~~~~~=~~~~~~~~~~~~~~~~~~~~~~~~~###
#.......~~~~~~~~...........=...................###
#######.~~~~~~~~#########..~...###################
#######.~#~~~#~~##########.~.#####################
#######.~~~~~~~~##########.~.#####################
#######.~~~~~~~~##########.~.#####################
#######....=....##########.~.#####################
##########.~.#############.~.#####################
##########.~.##########....=....##################
##########.~.##########.~~~~~~~.##################
##########.~.##########.~#~~~#~.##################
##########.~.##########.~~~~~~~.##################
##########.~.##########.~~~~~~~.##################
##########.~.##########.~~~~~~~.##################
##########.~.##########.~#~~~#~.##################
#######################.~~~~~~~.##################
#######################.........##################
##################################################
```

- **The trunk** runs the length of its area, along the middle half of it where it fits. An end that is no outfall stops 3 tiles short of the edge of the area: a wall and 2 tiles of rock behind its mouth.
- **Outfalls.** An outfall is an end of the trunk at the border of the map. Its walkways run up to the border wall; its water stops one tile short, at a mouth whose wall is the border, or, with `pierceBorder`, runs onto the border tile and leaves the map. The border tile at the end of one walkway, picked at random, is reserved `Openable`: the outfall, a way out that [`openExits`](open-exits.md) with `at: 'outfalls'` opens, and that stays wall otherwise. Water on the border is no exit and is not in `exits`; whether the game lets anything leave by it is the game's call. An outfall needs the area to touch the border at an end of the trunk, which an area as big as the map always does. A smaller area goes on a random spot (see [areas](../composing.md#areas)), so with `outfalls.min` above 0 most attempts fail and [`pipeline`](../composing.md#pipeline) often runs out of them: give such a sewer an `outfalls.min` of 0, or an area as wide or as tall as the map.
- **Chambers.** A junction chamber is a rectangle across the parent's tunnel where a branch leaves it, widened on the branch's side; the parent's water runs straight through it. The walkway beside the parent's water crosses the branch on a bridge there. A head chamber is a rectangle at the far end of a branch, and the branch's water runs through it to its far wall, as if it fell from above.
- **Cisterns.** A cistern is a large chamber with a rectangular basin of `ShallowWater` and a ledge of `Floor`, one tile wide, along some of its sides, always sides next to each other, so the ledges make one walkway. The canals and the corridors come in on a ledge, and where a canal crosses a ledge, the ledge is a bridge. A cistern at a head takes the branch's water in on its ledge, where the branch's canal ends at a mouth with no wall. A cistern at a junction holds its parent's water, which runs straight through its basin, with a ledge along the parent's walkway on the far side, one where the branch leaves, and one between them, so at least three; the branch's canal starts on its ledge. With `columnChance`, columns of wall, a tile each, stand in the basin in a grid `columnSpacing` apart, a tile clear of the ledges, the walls and the parent's water. A cistern still owed takes the first tries of the next branch, which is made without one when none fits. The game can turn the basin deep if it wants.
- **Always walkable.** Every walkway tile reaches every other without wading: besides the bridges in the junction chambers and on the ledges of the cisterns, bridges across the canals join the walkways that the water still keeps apart, at random spots, then each stretch of tunnel gets one more by `bridgeChance`. A random bridge keeps two tiles of water from the other bridges along its canal, unless only a bridge closer to one joins the walkways.
- **Every canal ends at a wall,** never in open floor: the end wall of its tunnel, the far wall of its head chamber, or the border wall at an outfall, unless the water pierces it, or else in the basin of its head cistern. Each end is a mouth in the group.
- **Apart.** Parts of the sewer that do not meet keep 3 tiles of rock between them, room for a corridor between two walls.
- **Reserved ground.** No part covers a [reserved](../composing.md#mapstate) tile or one that is not free. The walls beside the water are reserved `Solid`, so a corridor or a vein never ends in a canal, and so are the columns of a cistern and the 2 tiles of rock behind each mouth's wall, as wide as the canal, so no corridor is dug right behind it; a mouth into a cistern has no wall and no rock behind it. An outfall is `Openable`. Nothing else is reserved: the other walls are free for a joining step to open. No joining step reaches an outfall, since nothing lies beyond the border.
- **Fails** with an ordinary `Error` when the trunk finds no free room in its area, or its area reaches the border at fewer ends of a trunk than `outfalls.min`, which [`pipeline`](../composing.md#pipeline) answers with a new map. Run it before the steps that fill its area.
- **Rooms and the group.** Every chamber is a [`Room`](../rooms.md#room) of kind `'sewerChamber'`, every cistern one of kind `'cistern'`, and every stretch of tunnel between them, or between one and the end of its canal, one of kind `'sewerTunnel'`, walkways included. Each is a rectangle, and its shape in `roomShapes` is all its tiles but the columns of a cistern, so [`createRoomMap`](../rooms.md#createroommap) gives every tile of the sewer a room. Each sewer adds a `'sewer'` [group](../rooms.md#roomgroup) with its canals, mouths and outfalls. They are [features](dig-corridors.md#features), joined on their walkways and ledges and never dropped.
- **Uses** `rooms`, `roomShapes` and `roomGroups`, from the steps before it, and **adds** all three again with its own appended, the ids following on.
