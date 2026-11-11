# `digCatacombs`

`digCatacombs(options?)` is a step that digs one section of a catacomb: a lattice of straight galleries of `Floor` that cross at right angles, with junctions, turns and loops. A few of them are main galleries, wider than the side galleries and running the whole length of the lattice. Each straight stretch of gallery, a segment, has its walls lined with burial niches, lined with burial chambers behind doors, or left bare, and a dead end may be closed by a chamber. Crypts, rooms made from [templates](../room-templates.md), are placed first, and the galleries route round them, and round rooms placed before, and enter them by short passages. It can be mirrored or turned, as the [dungeons](../generators/dungeon.md#layout-symmetry) can. The section is a feature, not a room: the joining steps reach it on its boundary, and never dig through the rock between its galleries nor into a niche or a chamber.

```ts
import {
  digCatacombs,
  digCorridors,
  emptyMap,
  pipeline,
  placeScatteredRooms,
  Tile,
} from 'angstloch';

const { grid, roomGroups } = pipeline(
  emptyMap({ width: 71, height: 35, tile: Tile.Wall }),
  [
    digCatacombs({
      area: { width: { min: 36, max: 44 }, height: { min: 24, max: 28 } },
    }),
    // the rooms keep clear of the catacomb, and the corridors reach its galleries
    placeScatteredRooms(),
    digCorridors(),
  ],
  { random: mulberry32(30) },
);
const catacomb = roomGroups.find(({ kind }) => kind === 'catacomb');
```

A catacomb of 43 by 26 before it is joined, with two main galleries two tiles wide, the rest of its area rock. Chambers close the dead ends at the left of the top and the bottom gallery, two face each other in a pair across the gallery on the right with another below them, and one stands below the top gallery, that one and the lowest on the right with niches of their own. The other segments have niches, on one side or both, some 2 tiles deep, or are bare, as the top gallery is on the right:

```
###########################################
###########################################
###########################################
###########################################
##..#######################################
##..+.................................#####
##..######+####..#########..#########.#####
##..####.....#.....######...######..#.#..##
########.....##..#########..######..+.+..##
#########.#.##....######....######..#.#..##
###########.###..#########..#########.#####
#############......#####....#########.#...#
###############..#########..#########.+...#
##############.....#####....#########.#...#
###########.###..#########..#.###.###.##.##
##..###.#.#.#.#..#########..#.#.#.#.#.##.##
##..+............#########............#####
##..#########################.#.#.#.#######
##..#######################################
###########################################
###########################################
###########################################
###########################################
###########################################
###########################################
###########################################
```

| Option                 | Default                                | Meaning                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ---------------------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `mainGalleries`        | `{ 1, 2 }`                             | How many of the galleries are main galleries, a `Range` of whole numbers, 0 or more. They are picked among the rows and columns of the lattice, the inner ones first, never the outermost while an inner one is left.                                                                                                                                                                                                                                                                                   |
| `mainWidth`            | `{ 2, 3 }`                             | The width of a main gallery in whole tiles, 1 or more, drawn for each and cut down to the room the area has (see the lattice below).                                                                                                                                                                                                                                                                                                                                                                    |
| `sideWidth`            | `{ 1, 1 }`                             | The width of a side gallery in whole tiles, 1 or more, drawn for each.                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `spacing`              | `{ 1, 2 }`                             | The rock between two galleries side by side in whole tiles, 1 or more, drawn for each gap, besides the room for niches and chambers: when `segments` gives niches a weight, every gap is wider by twice `nicheDepth.max`, and when it gives chambers one, by twice `chamberSize.depth.max + 1`, a chamber and the wall with its door, whichever is wider. So it is the rock between the backs of the deepest niches or chambers.                                                                        |
| `segments`             | `{ niches: 3, chambers: 1, bare: 1 }`  | How likely each character of a segment is: `niches` lines its walls with niches, `chambers` with burial chambers, `bare` leaves them bare. Weights of 0 or more; only the ratio matters, a missing one is 0, and at least one must be above 0.                                                                                                                                                                                                                                                          |
| `nicheDepth`           | `{ 1, 2 }`                             | How deep a niche is in whole tiles, 1 or more, drawn for each niche and cut down to the rock it has.                                                                                                                                                                                                                                                                                                                                                                                                    |
| `nicheSpacing`         | `{ 1, 1 }`                             | The rock between two niches along a wall in whole tiles, 1 or more, drawn for each segment.                                                                                                                                                                                                                                                                                                                                                                                                             |
| `nicheSides`           | `{ 1, 2 }`                             | On how many sides of its gallery a segment with niches has them, 1 or 2, drawn for each segment; with 1, the side is drawn too.                                                                                                                                                                                                                                                                                                                                                                         |
| `chamberSize`          | `{ width: { 3, 5 }, depth: { 2, 3 } }` | The size of a chamber's floor in whole tiles, 1 or more: its `width` along its gallery, drawn for each segment, and its `depth` away from it, drawn for each chamber and cut down to the rock it has, but not below `depth.min`.                                                                                                                                                                                                                                                                        |
| `chamberSpacing`       | `{ 1, 2 }`                             | The rock between two chambers along a wall in whole tiles, 1 or more, drawn for each segment; at 1, they share a wall.                                                                                                                                                                                                                                                                                                                                                                                  |
| `chamberSides`         | `{ 1, 2 }`                             | On how many sides of its gallery a segment with chambers has them, 1 or 2, drawn for each segment; with 1, the side is drawn too, and with 2, the chambers face each other in pairs.                                                                                                                                                                                                                                                                                                                    |
| `chamberNicheChance`   | 0.5                                    | The chance that the walls of a chamber are lined with niches, from 0 to 1, drawn for each chamber.                                                                                                                                                                                                                                                                                                                                                                                                      |
| `templates`            | none                                   | Crypts: [`RoomTemplate`](../room-templates.md) objects, with the same `count`, `rotate`, `mirror`, `positions`, `areas` and `positionAccuracy` as the room steps take, placed in the area before the galleries. Their positions and areas are in the coordinates of the area. One that cannot be placed, or cannot be joined to the galleries, fails the attempt.                                                                                                                                       |
| `doorChance`           | 1                                      | The chance that a way into a room gets a door, from 0 to 1: an `Exit` or an opened `OptionalExit` of a crypt, and an opened wall of an ordinary room placed before. A `Door` cell always gets one, and a templated room placed before keeps the doors its step decided.                                                                                                                                                                                                                                 |
| `templateSymmetry`     | false                                  | Whether the crypts get mirror images, which follow `symmetry` always, whatever `symmetryChance` says (see the symmetry below). It has no effect without a `symmetry`.                                                                                                                                                                                                                                                                                                                                   |
| `deadEndChamberChance` | 0.5                                    | The chance that a dead end is closed by a chamber, from 0 to 1, drawn for each dead end.                                                                                                                                                                                                                                                                                                                                                                                                                |
| `loopChance`           | 0.3                                    | The chance that a stretch of side gallery between two crossings is kept although the galleries are joined without it, making a loop, from 0 to 1. 0 gives a tree of galleries, 1 the whole lattice.                                                                                                                                                                                                                                                                                                     |
| `deadEndChance`        | 0.1                                    | The chance that a dead end is kept, from 0 to 1. A dead end that is not kept is joined to a gallery next to it.                                                                                                                                                                                                                                                                                                                                                                                         |
| `symmetry`             | `'none'`                               | Mirrors or rotates the catacomb about the middle of its area: `'horizontal'` (left to right), `'vertical'` (top to bottom), `'both'` or `'rotational'` (by 180°). The galleries are always mirrored; the niches and chambers by `symmetryChance`.                                                                                                                                                                                                                                                       |
| `symmetryChance`       | 1                                      | How often the niches and chambers of a segment and its twins get their twins, from 0 (never) to 1 (always), rolled once for each segment and its twins, and once for each dead end and its twins.                                                                                                                                                                                                                                                                                                       |
| `area`                 | the whole map                          | The size of the part of the map to dig in, see [areas](../composing.md#areas). The catacomb is closed in by a ring of wall inside it. Its smallest size must hold two side galleries of the narrowest `sideWidth` each way, with the narrowest `spacing` between them, the room for niches and chambers between and round them, and the ring round it all (21 by 21 by default, 13 by 13 with niches but no chambers, 5 by 5 with neither), or the step throws a `RangeError` before the first attempt. |

- **One section per step.** The step takes no `count`: two catacombs are two copies of the step, each in an area of its own.
- **The lattice.** Rows and columns of side galleries are laid from the top and the left of the area, inside its ring of wall, as many as fit, with the rock between two of them drawn from `spacing`; where the next one does not fit, it is tried once more at the narrowest width and gap. When segments may get niches or chambers, every gap is wider by twice the room they need on a side, `nicheDepth.max` for niches and `chamberSize.depth.max + 1` for chambers, whichever is more, and the lattice keeps that room from the ring, for the niches and chambers of the outermost galleries. Then `mainGalleries` of them are widened to main galleries, from the room left over and from gaps wider than the narrowest, so a main gallery in a tight area is narrower than `mainWidth` asks, down to the width it had as a side gallery. What room is still left over is rock at the edges of the area.
- **Pruning.** Every stretch of a main gallery is dug, so a main gallery runs the whole length of the lattice. The stretches of the side galleries between two crossings are taken in a random order, and each is dug when it joins galleries still apart, or else by `loopChance`. A dead end, a crossing left with one stretch, stays by `deadEndChance`; otherwise one more stretch is dug from it. So every gallery is joined to every other, and the catacomb is one piece of floor.
- **Segments.** A segment is a straight stretch of gallery between two junctions, turns or dead ends (see [`CatacombSegment`](../rooms.md#roomgroup)). Each draws its character by the weights of `segments`: with `'niches'`, its walls are lined with niches, with `'chambers'`, with burial chambers, with `'bare'`, they are left bare. Best effort: a segment drawn with chambers where none fits gets niches instead, and one drawn with niches where none fits becomes `'bare'`; the group reports what each became. The segments are lined in a random order, so where the rock of two galleries meets, in the corners between them, neither way is favored.
- **Niches.** A niche is `Floor`, one tile wide and `nicheDepth` deep, straight out of the wall of its gallery; a niche is not a room. A segment's niches stand at a spacing drawn from `nicheSpacing`, as many as fit, centered along it and a tile clear of each end, on one side or both by `nicheSides`, the niches on both sides facing each other. A niche never touches other floor than its gallery, not even corner to corner, so it is cut shallower, or left out, where it would meet another niche or another gallery. That happens in the corners of the rock between galleries, where the niches of a row and of a column would meet, so a segment drawn with niches on both sides may get them on one only. Widen `spacing` to make room for both.
- **Burial chambers.** A chamber is a room of kind `'burialChamber'`: a floor of `Floor`, `chamberSize.width` along its gallery and `chamberSize.depth` deep, behind a `Door` in the wall of the gallery, centered on the chamber, which is its one exit. A segment's chambers stand at a spacing drawn from `chamberSpacing`, as many as fit, centered along it and a tile clear of each end, on one side or both by `chamberSides`; on both, they face each other in pairs across the gallery. A chamber is cut shallower where its rock runs out, down to `chamberSize.depth.min`, or left out. It touches no other floor but through its door, though two chambers side by side may share a wall.
- **Chambers at dead ends.** First, every dead end is closed by a chamber by `deadEndChamberChance`, where one fits: its door in the wall that ends the gallery, in the middle of it, and the chamber beyond, as wide as drawn from `chamberSize.width` and centered on the door. It belongs to the segment that ends there, whatever that segment's character, and does not count for it.
- **Niches inside chambers.** By `chamberNicheChance`, a chamber's walls but the one with its door are lined with niches, as a segment's are, at a spacing drawn from `nicheSpacing` for the chamber, `nicheDepth` deep and a tile clear of its corners, where the rock has room; the niches are listed with the group's, pointing to their chamber. The galleries are not spaced wider for them, so they fit where the chamber is shallower than the deepest, or in wider spacing.
- **Crypts.** The copies of `templates` are placed first, anywhere in the area clear of the ring of wall, of every tile that is not free and of the tile in front of the entrance of every [cell block](place-cell-blocks.md) not opened yet, or where their `positions` and `areas` say, as the [room steps](../room-templates.md#where-templates-go) place them, a tile of wall apart at least. They are carved as the room steps carve them, and reserved, `Openable` where they may be opened. A crypt is a [`Room`](../rooms.md#room) of kind `'room'`, with its `template`, `rotation` and `mirrored`, its box its whole template, walls included. With `templateSymmetry`, each copy brings its mirror images along (see the symmetry below).
- **Routing round rooms.** No gallery covers a [reserved](../composing.md#mapstate) tile or one that is not free, nor touches one: a stretch that would is left out, so the galleries go round the crypts, the rooms placed before and anything else built there. The lattice may be cut into pieces then.
- **Entering rooms.** The galleries enter every crypt, and every room placed before that lies wholly in the area and has no exit yet, through its [potential exits](../room-templates.md): every `Exit` and `Door` that leads outside, or, when it has none, the `OptionalExit` with the shortest way. A passage of `Floor`, one tile wide, is dug from the opened wall along the shortest way through free rock to a gallery, none when the wall faces one. More `OptionalExit` tiles are opened, shortest way first, where they join galleries or rooms still apart, so a room can join the pieces of the lattice that it cut apart, but never two side by side, not even corner to corner. Of what is joined then, only the piece with the most galleries is dug. An opened wall is a `Door` by `doorChance` in an ordinary room, an `Exit` or `OptionalExit` of a template as the step that placed it decided, and a `Door` cell always, and it is listed in `roomExits` and the room's `exits`. A crypt that is left out of that piece, or a fixed exit with no way to a gallery, fails the attempt with a [`TemplatePlacementError`](../room-templates.md); another room left out is not entered, and is left to [`digCorridors`](dig-corridors.md). Since a smaller area only goes where everything is free (see [areas](../composing.md#areas)), rooms placed before are only in it when the area is the whole map.
- **Symmetry.** With a `symmetry`, the catacomb is mirrored or turned about the middle of its area: `'horizontal'` mirrors its columns, `'vertical'` its rows, and `'both'` and `'rotational'` both.
  - _The lattice._ A mirrored row or column of galleries is laid from the middle outwards: a gallery or a gap in the middle, sized so that it is centered, then pairs of galleries at the same distance on both sides, with what room is left split between the two edges. Both a gallery and a gap in the middle are tried, and the one that fits more galleries is kept. When no size of `sideWidth` or `spacing` centers it, the gallery or the gap in the middle is one tile wider than their `max`. A main gallery brings its twin along, and the pair counts as one of `mainGalleries`.
  - _Pruning._ A stretch is pruned together with its twins, and they are all kept when any of them joins galleries still apart. A dead end is decided together with its twins. So the galleries are symmetric wherever the ground is free, but a stretch left out round a room placed before or a crypt that has no twin leaves its own twin alone.
  - _Niches and chambers._ `symmetryChance` is rolled once for a segment and its twins, and once for a dead end and its twins. When the roll holds, the twins take the first segment's character, and every chamber and niche dug off it is dug at its mirror images too, and a chamber's niches go with it. They are dug as deep as all of them fit, or not at all. A segment that is its own image, across the middle, is lined on one side of the middle and mirrored onto the other side, and a chamber or a niche that would overlap its own image there is left out. When the roll fails, each segment and dead end is lined on its own.
  - _Crypts._ With `templateSymmetry`, every crypt brings its mirror images along, always, and is placed only where they fit too, as with the [room steps](../room-templates.md#in-a-dungeon). A passage into a room is the mirror image of the one into its twin, where that is free rock and no longer, so twin crypts get twin passages. The extra `OptionalExit` tiles opened to join pieces, and their doors by `doorChance`, are not mirrored, and neither are rooms placed before.
  - At a `symmetryChance` of 1 (the default), a catacomb in free ground is exactly symmetric, and so are mirrored crypts nearly always. At 0, only the galleries are. A twin chamber of even width has its door a tile off the middle the other way, as a mirror image does.
- **Reserved ground.** Every free tile of rock in the box of the galleries is reserved `Solid`, and so is every free tile next to a niche, even corner to corner, and the shape of every chamber, its walls and its door, so [`digCorridors`](dig-corridors.md) and [`digVeins`](dig-veins.md) never dig between the galleries nor into a niche or a chamber, only reach the outermost galleries from the rock round them, and no later step builds there. They enter where a wall of an outermost gallery is clear of niches and chambers: at a crossing, or along a bare segment or a side without them.
- **Fails** with an ordinary `Error` when no gallery finds free room in its area, and with a [`TemplatePlacementError`](../room-templates.md) for a crypt that finds no place or cannot be joined, both of which [`pipeline`](../composing.md#pipeline) answers with a new map; a crypt that can never fit the area throws at once. Run it before the steps that fill its area, other than the rooms it should enter. Keep [cell blocks](place-cell-blocks.md) out of its area (give the catacomb an `area` beside them, or place the blocks after it): the galleries do not enter a block, and the reserved rock seals it in, so `digCorridors` fails the map and `digVeins` leaves the block cut off.
- **Rooms and the group.** Every chamber is a [`Room`](../rooms.md#room) of kind `'burialChamber'`, its box its floor, with its shape in `roomShapes`, its floor and the tiles of its niches inside a wall, and its door in `roomExits`, so it has an exit already: [`digCorridors`](dig-corridors.md) counts it as one with the gallery its door opens onto, and leaves it alone. Every crypt is a room with its shape in `roomShapes` and the exits it was entered by. Each catacomb adds a [`'catacomb'` group](../rooms.md#roomgroup) to `roomGroups`, which its chambers and crypts point to with `Room.group`, with its area, the segments of its galleries, its niches, its chambers and its crypts, in the coordinates of the map. A room placed before that the galleries enter keeps its id and gets the new exits appended.
- **Uses** `rooms`, `roomShapes`, `roomExits` and `roomGroups`, from the steps before it, and **adds** all four again with its own appended, the ids following on.

## Example map

The map this code makes with seed 1 (`mulberry32` is defined in the [quick start](../../README.md#quick-start)):

<!-- map: dig-catacombs -->

```ts
import { emptyMap, pipeline, Tile, digCatacombs } from 'angstloch';

const result = pipeline(
  emptyMap({ width: 80, height: 25, tile: Tile.Wall }),
  [digCatacombs()],
  { random: mulberry32(1) },
);
```

```text
################################################################################
################################################################################
################################################################################
##############################.#.###############################################
#############################.....##############################################
############################.......###########...###############################
#############################.....############...#################.#############
###############################+###############+################.#.#.#.#########
#######..............##########..#########...........#########...........#######
#######.#.#.#.#.##...##########..#########.#########.#########.#########.#######
#####...###.#.####...########.....########...####.##.#######....#######....#####
#######.##########...##########..#########.#####...#.#########.#########.#######
#####...##########...#########....########...#.....#.########...######....######
#######.##########...##########..#########.#####...+.#########.#########.#######
######..##########...#########....########..##.....#.#######....######....######
#######.##########...##########..#########.#####...#.#########.#########.#######
######..##########...#########.....#######...####.##.#######.....#######...#####
#######.#.########...###.###.##..#########.#########.#########.#####.#.#.#######
#######.#.#.#.#.##...#.#.#.#.##..#########.#########.#########.#.#.#.#.#.#######
#######..................................................................#######
#########.#.#.#.######################################.#.#.#.###.#.#.#.#########
#########.###.#.##########################################.#####.###############
################################################################################
################################################################################
################################################################################
```

<!-- /map -->
