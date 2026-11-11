# Mines

```ts
import { generateMine } from 'angstloch';

const { grid, passages, exits } = generateMine({
  width: 80,
  height: 50,
  fishbone: { density: 0.25 },
  exits: { count: { min: 2, max: 2 } },
});
console.log(grid.toString());
```

A mine is a solid map with tunnels dug into it. In a [dungeon](dungeon.md) the rooms are the content and the corridors only join them. In a mine it is the other way round: the tunnels are the structure. Tiles are `Tile.Wall` and `Tile.Floor`, and `Tile.Door` for the doors of rooms and the exits on the border. The map is closed in by a ring of wall, and the mine is always one connected piece, since every tunnel, cavern and room is joined to the rest.

`generateMine` is a preset: a ready-made composition of [steps](../composing.md) on a map of `Tile.Wall`, with one key of its options per step, each holding the options of that step. A mine is made in this order:

1. **The layout**, one of four steps, picked by its key: `fishbone` ([`digFishbone`](../steps/dig-fishbone.md), the default), `veins` ([`digVeins`](../steps/dig-veins.md)), `pillars` ([`digPillarHalls`](../steps/dig-pillar-halls.md), followed by [`digVeins`](../steps/dig-veins.md) for its `hallVeins` key) or `rings` ([`digRings`](../steps/dig-rings.md)). At most one of the four may be given, and none means a fishbone with its defaults; two or more throw a `RangeError`. Each layout has options of its own, among them its `density`, described below and in its step's section.
2. **[Caverns](#caverns)** when `caverns` is given: [`digNoiseCave`](../steps/dig-noise-cave.md), followed by [`digVeins`](../steps/dig-veins.md) to join them, with its options under `tunnels` (`false` leaves the caverns apart).
3. **[Rooms and templates](#rooms-and-templates)** when `rooms` is given: [`placeMineRooms`](../steps/place-mine-rooms.md).
4. **[Exits](#exits)** on the border when `exits` is given: [`openExits`](../steps/open-exits.md).

When a step throws, as a template that finds no place does, the map is built again, up to 3 times in all, before the error is thrown; `attempts` and `failures` in the result say how it went. Two layouts in one map, a mine in part of a map, or any other order are compositions of your own: run the steps with [`pipeline`](../composing.md#pipeline).

```ts
// two layouts side by side, each in an area of its own, joined by tunnels
const { grid } = pipeline(
  emptyMap({ width: 120, height: 50, tile: Tile.Wall }),
  [
    digFishbone({ area: { width: { min: 40, max: 40 } } }),
    digRings({ area: { width: { min: 40, max: 40 } } }),
    digVeins({ density: 0 }),
  ],
);
```

## Example map

The map this code makes with seed 1 (`mulberry32` is defined in the [quick start](../../README.md#quick-start)):

<!-- map: generate-mine -->

```ts
import { generateMine } from 'angstloch';

const result = generateMine({ width: 80, height: 25, random: mulberry32(1) });
```

```text
################################################################################
#####################################################......#####################
####################################################........####################
##################################################...........###################
################################################........##....##################
###############################################........####....#################
#############################################........#######....################
###########################################........##########...################
#########################################.........############...###############
########################################........##############....##############
#######################################.......#################....#############
#####################################.......####################....############
#####################################.......#####################....###########
###################################.......#..#####################....##########
##################################......####..#####################....#########
#################################.........###..#####################....########
################################...........###..#####################....#######
#############################........###....###..#####################....######
###########################.........#####....###...####################.....####
##########################.........#######....####...###################.....###
########################........###########.....####..####################....##
######################........##############....#####..####################....#
#####################........#################....####...###################...#
#####################......###################....######.#######################
################################################################################
```

<!-- /map -->

## The fishbone layout

A fishbone is how a mine is dug when exploring for ore. First comes the **main shaft**: a wide tunnel that is straight, or nearly so, through a point near the middle of the map. It runs in both directions from that point, until it meets the edge of the map. Then **adits** are dug: narrower side tunnels that each leave a random spot of the shaft, the ribs of the fish, and wind a little as they go. Adits only leave the shaft, never another adit, so the mine reads as a herringbone that cuts across the strike of an ore vein.

The ribs run roughly parallel. Each mine picks one rib angle from `branchAngle` and one forward direction, one end of the shaft or the other, at random. The adits on one side of the shaft follow the forward direction turned by the rib angle one way, those on the other side turned the other way, so the two sides mirror each other across the shaft and both lean forward, like the bones of a fish. Each adit starts up to `aditSpread` degrees off the line of its side, either way, and `aditWindiness` bends it a little from there, so the ribs are roughly parallel, not ruled.

An adit is picked one after another until the `density`, the share of the map that is floor, is reached. It is a target and is met as far as there is room: when no more adits fit, the generator stops short of it without an error. The main shaft is always dug, so a `density` of 0 gives the shaft alone, and a shaft that is wider than the target leaves the density above it.

Tunnels keep apart. An adit that comes near another tunnel stops short of it, with a wall between them, even at a corner, and ends in a dead end. Where an adit forks off the shaft, the tip of the rock between them is dug out if it would touch the rest of the rock at a corner only, so no walker who moves diagonally slips between two walls. An adit that ends up shorter than the minimum of `aditLength` is not dug.

**Crosscuts** join the ribs once they are all dug. Each pair of neighboring adits on the same side of the shaft, next to each other along it, gets a crosscut with the chance `crosscuts` (0.1 by default, so about a tenth of the pairs are joined), whatever the length of the ribs. A crosscut is a straight tunnel one tile wide that runs the shortest way across, roughly square to the ribs, from a random spot of the stretch where the two run side by side. Crosscuts make loops in the mine. A pair gets no crosscut where it would come near another tunnel, the shaft included, or where the two adits do not run side by side, so the share of joined pairs comes out a little below the chance. With `crosscuts: 0` every adit ends in a dead end and the mine is a tree.

`angle` is the direction of the main shaft in degrees, clockwise from east, like the `rotation` of [noise](../noise.md) and the `angle` of [roads](forest.md#roads): 0 runs from left to right, 90 from top to bottom. `'random'` picks one. The shaft winds as far as `shaftWindiness` says, which is a little by default, and the adits as far as `aditWindiness` says, which is a little too, so that the ribs still read as parallel. A windiness is from 0 (straight) to 1, and works as the `windiness` of roads does: the tunnel is pushed to either side by smooth noise, so it bends gently and does not jitter. A shaft that winds off the map is cut where it leaves, and the part that holds its middle is dug.

Widths are `Range`s of whole tiles. The shaft gets one width, and every adit its own. A tunnel two tiles wide or more has rounded corners. `aditLength` is measured along the line that the adit follows, so an adit that runs at a diagonal covers up to about 40% more tiles than its length. `branchAngle` is the rib angle between the adits and the forward direction of the shaft, in whole degrees from 1 to 179, picked once per mine: a small angle makes ribs that lean far forward, 90 ribs at right angles to the shaft, and above 90 ribs that lean back. The angle is taken from the overall direction of the shaft (`angle`), not from the bends of a winding shaft, so the ribs of a side stay parallel however the shaft winds. `aditSpread` is in whole degrees from 0 to 90; 0 starts every adit exactly on the line of its side.

## The veins layout

```ts
const { grid } = generateMine({ width: 80, height: 50, veins: {} });
```

Veins are how a mine looks that follows the veins of an ore, which run where they please: an irregular web of winding tunnels, like a labyrinth or the edges of a Voronoi diagram. The generator spreads **junctions** over the map: it cuts the map into cells about `veinSpacing` tiles across and puts one junction at a random spot well inside each cell, which spreads them out evenly without lining them up. The tunnels between junctions are the **veins**, and each one winds as far as `veinWindiness` says, on its own bends.

On an empty map the web grows from one junction, the one nearest the middle. The junction nearest the web is joined next, by a vein to the nearest tile of anything dug so far, veins included, so a vein may end on another vein in a T, and so on until the `density` is reached. A map that has no room left for a junction, or a `density` too high for the junctions, gets finer junctions in between, then extra veins that make loops, and stops there. So a higher `density` makes a bigger web, and every vein is routed through free rock and never across another.

The veins have no main shaft: `passages` lists the veins in the order they were dug, each with the `kind` `'vein'`. The default `density` of 0.15 gives a sparse web on an 80 by 50 map, and 0.25 a dense one. `veinSpacing` sets the scale of the first junctions: with 8 the veins are short and the web is fine, with 30 there are a few long ones. A map smaller than the spacing gets two junctions at least, and one smaller than 3 tiles inside its border has no floor. The same step joins any floor that is on the map already, see [`digVeins`](../steps/dig-veins.md).

## The pillars layout

```ts
const { grid, rooms } = generateMine({ width: 80, height: 50, pillars: {} });
```

Pillars are how a coal seam is mined, with room and pillar: large halls are dug out, and islands of untouched rock are left standing in them to hold up the roof, which gives a pattern of polka dots. The result is a few big halls joined by winding tunnels. Two steps make it, as two keys of the preset: `pillars` digs the halls and the pillars ([`digPillarHalls`](../steps/dig-pillar-halls.md)), and `hallVeins` joins the halls ([`digVeins`](../steps/dig-veins.md)), with the defaults of that step when it is left out, a `density` of 0.15 among them, so the web grows some junctions of its own in the rock round the halls. A `density` of 0 joins the halls and digs nothing else. The veins are dug after the pillars, so a vein starts only from the outer boundary of a hall.

**Halls.** The number of halls is picked from `halls` (2 to 4 by default), and each is a rough rectangle with a jagged edge, placed at random with at least 4 tiles of rock between it and any other. A hall that finds no room is left out, so a crowded map gets fewer than asked for, and at least one is always dug. The size of each side of a hall is picked from `hallSize`. Without it, a size is worked out from the `density`: the halls together fill about that share of the map once the pillars are taken out, in a shape that is a little wide or tall. A derived hall that finds no room shrinks until it does, and one with a size of its own is left out instead. `hallRagged`, from 0 to 1, sets how jagged the edges are: at 0 a hall is a clean rectangle, and at 1 its sides are cut back by up to 4 tiles, a depth that does not grow with the hall. The corners come out rounded and cut.

**Joining** (`hallVeins`). The halls are joined into one network of veins that grows from a first vein. The two halls nearest each other are joined first. Then the hall nearest the network is joined to it, and so on until every hall is in. A hall is joined by one vein to the nearest tile on the boundary of any hall or vein that is in the network already, so halls need not be joined directly: a vein may end on another vein, in a T. A vein never crosses another one. So a mine of `n` halls has `n - 1` veins at least, and a single hall has none. What `density` asks for beyond that, the junctions and the loops, is described under [`digVeins`](../steps/dig-veins.md).

**Entrances.** A vein starts and ends on the boundary of a hall or a vein: a floor tile that has rock next to it, never a tile in the inside, and never one that only touches a pillar (the rock outside the halls is told from the rock the floor shuts in), so a vein never crosses a hall and takes no pillars. `hallEntrances` says where a vein starts on its hall. With `'facing'` (the default) it starts along the side that faces the nearest part of the network: the band of boundary tiles, about 3 deep, that lies furthest in the direction from the middle of the hall to that nearest tile. A hall to the east of the network is left by its east side, and one that lies diagonally by a corner. With `'edge'` it starts anywhere on the boundary, on any side. Several tiles are tried, and the one furthest from the entrances and ends of veins already there wins, so veins do not leave side by side. The end is the nearest tile of the network to the start, and it avoids the ends of other veins by at least 3 tiles where it can.

```ts
// veins that leave each hall from any side, not only the one that faces the next
generateMine({
  width: 80,
  height: 50,
  pillars: {},
  hallVeins: { hallEntrances: 'edge' },
});
```

**Routing.** A vein is not a straight line between its two ends. It is routed through the rock with a shortest-path search that may not use any floor, so it goes around the halls that lie in its way. The route keeps a wall between the vein and every hall and every earlier vein, a wall that is at least one tile thick however wide the vein is, except close to its own two ends, where it has to leave and arrive. So veins never overlap, and they run side by side with a wall between them or not at all. A vein is also never much longer than the way between its ends: a route of more than 1.5 times the distance between its ends along the grid, plus 8 tiles, is rejected, so a vein does not run round a whole hall to reach the far side of it. The route is then given a natural look: its corners are smoothed, and noise pushes it sideways by up to 3 tiles, the more so the higher `veinWindiness` is, without ever pushing it onto a hall or another vein. `veinWidth` (of `hallVeins`) applies, with a width picked for every attempt.

**When a vein finds no route.** The halls may be too close for a vein to fit, earlier veins may have taken the way, or the route may be too long. Then the vein is tried again from another start, up to 10 times in all. With `'facing'`, the first 5 tries keep to the facing side and the rest may use any side, so that a vein can go round a hall when the way between the two is taken. An extra vein that still finds no route is left out. A piece of floor that finds no route is tried again once the other halls are in, since the network is larger then, and if that fails too, one last time with the rules relaxed: only floor blocks the route, there is no limit to its length, and the veins may run close to a hall or another vein. That squeezes a vein through a gap of one tile, so a hall that is boxed in joins whatever it is boxed in by. A piece that no route reaches at all, even so, is left as it is.

**Pillars.** Pillars are islands of wall, each of a width and a height picked from `pillarSize` (2 to 5 by default), arranged in a pattern in each hall. The pattern is a lattice with cells as wide as the largest pillar plus the gap between pillars, and the gap is picked from `pillarSpacing` (2 to 4) once for each hall, so a hall has its own rhythm. The lattice is centered in the hall and kept clear of the hall's ragged edge, and every pillar sits in its own cell. `pillarJitter`, from 0 to 1, moves the pillars off the grid: at 0 it is perfect, and at 1 each pillar strays as far as it can without getting closer than a tile to its neighbors. `pillarRagged`, from 0 to 1, makes the edges of the pillars ragged: at 0 they are clean rectangles. Pillars that are 2 tiles wide or tall are too small to be ragged on that side. A pillar is left out where it would touch the wall of the hall or another pillar, so there is always floor all around a pillar and the floor of a hall stays in one piece. That means a hall may have fewer pillars than the lattice has cells, most of all at the edge, and a hall that is too small for a pillar has none.

Here `density` only sizes the halls, with its default raised to 0.35, since a hall needs room to show its pillars. The halls together fill about that share of the map once the pillars are taken out, as far as the pillars can be estimated in advance, so the share of floor you get is approximate, and the veins add to it. It does nothing when you give a `hallSize`.

Every hall is a [`Room`](../rooms.md#room) of kind `'pillarHall'` in the result's `rooms`, with its shape and its group: see [`MineResult`](#mineresult).

## The rings layout

```ts
const { grid, passages } = generateMine({ width: 80, height: 50, rings: {} });
```

Some mines are dug in rings, such as a bore driven round a shaft level after level. Here it is a flat map of concentric loops of tunnel, joined by spokes.

**Rings.** The rings are ovals around the middle of the map, as tall and wide as the map is, so a ring is round on a square map and long on a wide one. They are evenly spaced, from the innermost out to the outermost, which lies near the border. A ring's width is picked from `ringWidth` (2 to 3 by default), one for each ring. The rock inside the innermost ring is left as it is. `rings` is how many to dig, a `Range`. Without it, the count is the one whose rings come closest to filling the `density` of the map, at most 10 and as many as have room for their width and a gap of 2 tiles; with it, the `density` is not used. A map that is too small for the count gets as many as fit, and one with no room for a ring of 3 tiles' radius gets none, and so no floor.

**Shape.** `ringShape` is `'oval'` (the default) or `'circle'`. With `'circle'` the rings are round: as large as the shorter side of the map allows, and centered, so on a wide or tall map the ends are left as rock (caverns and rooms can still go there). On a square map the two shapes are the same. `density` keeps its meaning, the share of the whole map that is floor, so a circle on a very wide map may be unable to reach it, and then stops short with the count of rings that comes closest.

```ts
const { grid } = generateMine({
  width: 100,
  height: 50,
  rings: { ringShape: 'circle' },
});
```

**Wobble.** A ring is not a perfect oval: smooth noise pushes it in and out as it goes round, and it is still a closed loop. `ringWobble`, from 0 to 1, sets how far. At 1 a ring strays up to a quarter of the distance between rings, so that rings do not meet, and at 0 it is a perfect oval. The corners are not sharp, since the noise is smooth.

**Spokes.** Between every ring and the next, at least one spoke runs outwards at a random angle, so the mine is one piece. `spokes` is how many join each pair, a `Range` (1 to 3 by default) picked once for each pair, and a pair always gets one, so a minimum of 0 is the same as 1. The spokes of a pair are spread round the rings at about even distances, with a little shuffling, and they wind as far as `veinWindiness` says. Their width is picked from `veinWidth`. With one ring there are no spokes. Where a spoke meets a ring, a sliver of rock that would touch the rest at a corner only, which a walker who moves diagonally could slip past, is dug out, even if that leaves a pillar standing free.

`passages` lists the rings first, from the innermost out, with the `kind` `'ring'`, then the spokes, with the kind `'spoke'`. The first and last tile of a ring are the same tile.

## Caverns

```ts
const { grid, rooms, roomGroups } = generateMine({
  width: 80,
  height: 50,
  caverns: { count: { min: 1, max: 2 } },
});
```

Some mines break into natural caverns. With `caverns`, any layout gets them, dug into the rock beside the tunnels once the layout is done. `caverns` takes the options of [`digNoiseCave`](../steps/dig-noise-cave.md), with four defaults of its own that make each cavern one blob beside the mine:

| Option             | Default here                                                 | The step's default |
| ------------------ | ------------------------------------------------------------ | ------------------ |
| `placement`        | `'beside'`                                                   | `'free'`           |
| `area`             | sides of 12 to 24 tiles, cut down to the map less its border | the whole map      |
| `scaleX`, `scaleY` | 7                                                            | 12                 |
| `largestOnly`      | true                                                         | false              |

The rest are the step's defaults: `count` is 1 to 1, so `caverns: {}` digs one cavern, and `fill` is 0.45, the share of the box that is wall (a lower share makes a larger, rounder cavern, and a higher one a smaller, thinner one). Without `caverns`, there are none.

**Where a cavern goes.** With `placement: 'beside'` (see [`digCellularCave`](../steps/dig-cellular-cave.md)), the cavern is made first on its own, and then up to 100 random spots are tried; a spot fits when the cavern's floor, and every tile round it, is rock, so there is always a wall between the cavern and the mine, while its box may overlap the tunnels. Of the spots that fit, the one nearest the mine wins. Then [`digVeins`](../steps/dig-veins.md) joins every cavern to the mine, with the defaults of the preset (veins 1 tile wide and a `density` of 0, so it only joins) or the options under `tunnels`; `tunnels: false` leaves the caverns apart. The tunnels are not listed in `passages`.

**A cavern that finds no spot.** A layout that fills the map leaves no room: a `rings` mine has none for a cavern of the default size, and a dense `veins` mine little. The caverns up to `count.min` fail the map, which is built again up to 3 times in all, and then the error is thrown. The caverns above `count.min` are left out. So `count: { min: 0, max: 2 }` never fails, and `placement: 'overlap'` puts a cavern into the tunnels instead, like a cave-in; its `overlapShare` sets how far the cavern may break into them (any amount by default).

Every cavern is a [`Room`](../rooms.md#room) of kind `'cavern'` in the result's `rooms`, in a `'cave'` group of its own with the box it was made in: see [`MineResult`](#mineresult).

## Rooms and templates

```ts
import { generateMine, TemplateCell, type RoomTemplate } from 'angstloch';

const { Floor: F, Wall: W, Exit: E } = TemplateCell;

const closet: RoomTemplate = {
  cells: [
    [W, E, W],
    [W, F, W],
    [W, W, W],
  ],
};

const { grid, rooms, roomExits } = generateMine({
  width: 80,
  height: 50,
  rooms: {
    roomCount: { min: 2, max: 4 },
    roomWidth: { min: 4, max: 8 },
    templates: [closet],
    doorChance: 0.5,
  },
});
```

Any layout can get rooms: a store, a chapel, a shaft office. They are dug into the rock beside the tunnels once the rest of the mine is done, after the caverns, and joined to the mine by tunnels. `rooms` takes the options of [`placeMineRooms`](../steps/place-mine-rooms.md), with its defaults, and without `rooms` there are none.

**Ordinary rooms.** `roomCount` is how many (1 to 1, so `rooms: {}` places one), `roomWidth` and `roomHeight` their size (3 to 7), and `sizeUniformity` how alike they are (0), as for the [maze's](maze.md#rooms-in-mazes) rooms. Sizes are the floor, without the wall, and any size is allowed, since a mine has no lattice. A room is a rectangle of floor inside a ring of wall, which a gap can open anywhere along. For templates alone, set `roomCount` to `{ min: 0, max: 0 }`.

**Templates.** `templates` under `rooms` takes the same [`RoomTemplate`](../room-templates.md) objects as the dungeons and mazes, with the same `count`, `rotate`, `mirror`, `positions`, `areas` and `positionAccuracy`. They are placed before the ordinary rooms. Placement is anywhere in the rock the template fits, or where its `positions` and `areas` say, and a template that cannot be placed, or cannot be joined to the mine, gets a new mine, up to three in all, before a [`TemplatePlacementError`](../room-templates.md) is thrown (see [Room templates](../room-templates.md)). A template is never left out. The cells of a template that stand for the wall around a room are part of it, so keep them in the design. There is no `templateSymmetry`.

**Where rooms go.** A room, with its wall, keeps at least 2 tiles of rock from the tunnels, halls, pillars and caverns, and from other rooms, and it never overlaps them. A room that finds no spot is left out, so a crowded map gets fewer rooms than asked for, and templates are the exception and throw. An ordinary room is put at the best of up to 20 places that fit, the nearest to the mine, which keeps its tunnels short.

**Openings.** A room opens onto the mine at its exits. `exitsPerRoom` (1 to 3) is how many, picked for each room: the `Exit` and `Door` cells of a template that lead outside always open and count, and `OptionalExit` cells open as far as the count asks for beyond them, nearest the mine first. An ordinary room has an optional exit all round its wall. There is at least one opening in every room, and no two openings are next to each other, diagonals included: an optional exit beside an opening that is open already stays a wall, so a room may get fewer openings than `exitsPerRoom` asks for. Fixed `Exit` and `Door` cells are always opened, so a template that puts two of them side by side gets two openings side by side. Every opening is a gap in the wall that gets a door with the chance `doorChance` (1 by default), and is a plain opening otherwise. `Door` cells of a template are always doors. The `Exit` and `OptionalExit` cells of a template are decided when it is placed, and an opened one follows what its shape's `doors` in `roomShapes` say.

From each opening, a tunnel runs to the nearest floor of the mine, which may be another room's tunnel but never a room. It winds as veins do, in the width and windiness of the `veinWidth` and `veinWindiness` of `rooms`, and when that would cross a room, it follows the shortest way round instead. The tunnels are listed in `passages` after all the others, with the `kind` `'tunnel'`. A room that cannot be joined, for want of a free way, is left out, and a template that cannot be joined throws.

The rooms are in `rooms`, templated ones first, with `template`, `rotation` and `mirrored` set, and their openings are in `roomExits`, as for [mazes](maze.md#mazeresult): see [`MineResult`](#mineresult). An ordinary room's `x`, `y`, `width` and `height` describe its floor, and a templated room's its bounding box, walls included. A door is a `Tile.Door`, so a room is not part of the same group of floor tiles as the mine for a check that goes by `Tile.Floor` alone.

## Exits

`exits` adds mouths to the mine on the border of the map, like the exits of a [cave](cave.md#exits): a `Tile.Door` on the border and a straight tunnel from it to the nearest floor, found by going straight in. It takes the options of [`openExits`](../steps/open-exits.md): a number is picked from `count`, and fewer are made when the mine has no more places for them. The doors are listed in `exits`, and no two of them are side by side. Without `exits`, there are none.

## `MineOptions`

| Option      | Default           | Meaning                                                                                                                                                                                         |
| ----------- | ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `width`     |                   | Map width in tiles. Required.                                                                                                                                                                   |
| `height`    |                   | Map height in tiles. Required.                                                                                                                                                                  |
| `random`    | `Math.random`     | Source of randomness. It seeds the noise that bends the tunnels and rolls everything else.                                                                                                      |
| `fishbone`  | the layout        | A fishbone: the options of [`digFishbone`](../steps/dig-fishbone.md). The layout when no other is given.                                                                                        |
| `veins`     | none              | A web of veins: the options of [`digVeins`](../steps/dig-veins.md).                                                                                                                             |
| `pillars`   | none              | Pillar halls: the options of [`digPillarHalls`](../steps/dig-pillar-halls.md).                                                                                                                  |
| `hallVeins` | on with `pillars` | The veins that join the pillar halls: the options of [`digVeins`](../steps/dig-veins.md). A `RangeError` without `pillars`.                                                                     |
| `rings`     | none              | Rings and spokes: the options of [`digRings`](../steps/dig-rings.md).                                                                                                                           |
| `caverns`   | none              | Caverns beside the mine: the options of [`digNoiseCave`](../steps/dig-noise-cave.md), with `placement`, `area`, the scales and `largestOnly` defaulting as described under [caverns](#caverns). |
| `tunnels`   | on                | Only used with `caverns`: the options of [`digVeins`](../steps/dig-veins.md), which joins the caverns to the mine, with `veinWidth` 1 and `density` 0 as defaults. `false` leaves them apart.   |
| `rooms`     | none              | Rooms and templates: the options of [`placeMineRooms`](../steps/place-mine-rooms.md).                                                                                                           |
| `exits`     | none              | Exits on the border: the options of [`openExits`](../steps/open-exits.md).                                                                                                                      |

The options of each step are in its section, with their defaults: [`digFishbone`](../steps/dig-fishbone.md), [`digVeins`](../steps/dig-veins.md), [`digPillarHalls`](../steps/dig-pillar-halls.md), [`digRings`](../steps/dig-rings.md), [`digNoiseCave`](../steps/dig-noise-cave.md), [`digVeins`](../steps/dig-veins.md), [`placeMineRooms`](../steps/place-mine-rooms.md) and [`openExits`](../steps/open-exits.md). Every option is checked before anything is dug, and a `RangeError` is thrown for a non-positive or non-integer size, for more than one layout, and for a bad option of any step, as that step's section says.

## `MineResult`

| Field        | Meaning                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `grid`       | The map.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `passages`   | The tunnels of the layout in the order they were dug, the main shaft first, then the tunnels that join the rooms, as `MinePassage` objects: `kind` (`'shaft'`, `'adit'` or `'crosscut'` for a fishbone, `'vein'` for veins and for the veins between halls, `'ring'` and `'spoke'` for rings, `'tunnel'` for a tunnel that joins a room), `width` and `tiles`, the tiles along the middle of the tunnel from where it starts to where it ends, each touching the one before along an edge. An adit starts on the shaft, a crosscut runs from one adit to the other, and a vein runs from one junction to another. The tunnels that join the caverns are not listed. |
| `rooms`      | The rooms, as [`Room`](../rooms.md#room) objects, with ids in this order: the halls of a `pillars` mine (kind `'pillarHall'`), then the caverns (kind `'cavern'`), then the rooms of `rooms` (kind `'room'`), templated ones first. A hall's box is the rectangle it was dug in and a cavern's the smallest one that holds its floor, so their corners may be wall; their exits are where the veins and tunnels enter them. Empty when the mine has none of them.                                                                                                                                                                                                   |
| `roomShapes` | The shape of every room, by its id. A hall's or cavern's is its floor, as `Floor` cells, every other cell of its box `Unused`; see [`RoomShape`](../steps/place-mine-rooms.md) for the rest.                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `roomGroups` | The [groups](../rooms.md#roomgroup) of the rooms: a `'pillarHalls'` group for the halls, and a `'cave'` group for each cavern.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `roomExits`  | The openings of the rooms, as [`Exit`](../rooms.md#exit) objects, with `door` saying whether each got a door, the places where a vein or a tunnel enters a hall or a cavern included. They are not the `exits` on the border.                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `exits`      | The door tiles on the map border, one per exit. Empty without `exits`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `attempts`   | How many times the mine was built, 1 or more: a map is built again when a step throws, up to 3 in all.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `failures`   | One entry per failed attempt, as for [`pipeline`](../composing.md#pipeline), also when a later attempt succeeded.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
