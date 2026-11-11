# Caves

```ts
import { generateCave } from 'angstloch';

const { grid, rooms } = generateCave({ width: 60, height: 30 });
console.log(grid.toString());
console.log(`the automaton left ${String(rooms.length)} caverns`);
```

`generateCave` is a ready-made composition of [steps](../composing.md) on a map of wall: [`digCellularCave`](../steps/dig-cellular-cave.md) grows the caverns, [`digVeins`](../steps/dig-veins.md) joins them into one with tunnels, and [`openExits`](../steps/open-exits.md) carves exits into the border. Its options are nested, one key per step, each holding the options of that step: `cave`, `tunnels` and `exits`. Every key is optional, and the steps' defaults apply. A step that is left out adds nothing: `tunnels: false` leaves the caverns apart, and without `exits` there are none. The `tunnels` key takes the options of `digVeins`, with two defaults of the preset: `veinWidth` is `{ min: 1, max: 1 }` and `density` is 0, so the veins only join the caverns. For other compositions, such as a cave in part of a map or beside a mine, run the steps with `pipeline`.

```ts
const { grid, rooms, exits } = generateCave({
  width: 60,
  height: 30,
  cave: { fillChance: 0.48, minRegionSize: 20 },
  tunnels: { veinWidth: { min: 2, max: 2 }, veinWindiness: 0.2, density: 0.05 },
  exits: { count: { min: 1, max: 2 } },
});
```

A cave is grown with a cellular automaton. The map starts as random noise, with each tile a wall with the chance `cave.fillChance`. Then it is smoothed over `cave.iterations` passes. In each pass, every tile counts its neighbors that are walls, and all tiles change at the same time:

- a floor tile turns into a wall when it has at least `birthLimit` wall neighbors;
- a wall tile stays a wall when it has at least `survivalLimit` wall neighbors, and turns into floor otherwise.

Tiles outside the map count as walls. The default limits are the classic 4-5 rule on 8 neighbors (`neighborhood: 'moore'`), which gives open, rounded caverns, and 3-2 on 4 neighbors (`'von-neumann'`). The limits are counted out of the neighbors there are, so a limit above that can never be reached, and a `birthLimit` of 9 stops floor from ever turning into a wall. Raising `fillChance` or lowering the limits gives more wall. Fewer `iterations` gives rougher caves. All the options of `cave` are those of [`digCellularCave`](../steps/dig-cellular-cave.md).

The automaton usually leaves several caverns that are not joined to each other. Caverns are groups of floor tiles that touch along an edge; tiles that only touch diagonally are separate caverns. `cave.minRegionSize` fills in the small pockets, and `cave.largestOnly` keeps only the largest cavern. Both apply as the cave is grown, before the tunnels.

## Example map

The map this code makes with seed 1 (`mulberry32` is defined in the [quick start](../../README.md#quick-start)):

<!-- map: generate-cave -->

```ts
import { generateCave } from 'angstloch';

const result = generateCave({ width: 80, height: 25, random: mulberry32(1) });
```

```text
################################################################################
###########################..###################################################
##########################....####################....#####..#####.......#######
#########..#####..####........###...###...###..........###....###.........######
#########...###....###........###....#.................##.....###.............##
###########.###................#......................####.....#.........#....##
###########.###......................................#######..........#####...##
#########...###........###...........................########.........####....##
#########.####........#####.........................##########................##
######....###.......#######.........................##########...............###
#####..............########..........................#########...............###
#####..........###########.............................#######................##
##..#.........#########................................########...............##
#.............########...........................#####..########..............##
#.............####.............................########..##..####.............##
#.............###..........................#############......#######........###
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

## Joining the caverns

The tunnels are on by default, and join every cavern into one network. They are the veins of [`digVeins`](../steps/dig-veins.md), with its pieces, ports and routing: the two caverns nearest each other are joined first, then the cavern nearest the network, and so on, so a tunnel may end on another tunnel. A tunnel runs through free rock round the other caverns, never across one, and keeps a wall between itself and them. Where the rock between two caverns is a single wall thick, there is no room for a wall on each side, so the tunnel is let through it as a last resort, and a cavern shut in by the others is entered through the rock that shuts it in. It only ever turns rock into floor, so no floor tile is lost.

`tunnels: false` leaves the caverns as the automaton made them, and with `cave: { largestOnly: true }` as well, the map is the largest cavern alone. A pocket that `minRegionSize` fills in never gets a tunnel. The shape of tunnels is set by the options of `digVeins`: `tunnels.veinWidth` (1 tile by default, wider for roomy caves) and `tunnels.veinWindiness` (how much a tunnel wanders, from 0 to 1, 0.5 by default). With `tunnels.density` above 0 the network also grows tunnels of its own in the rock between the caverns, and loops, which lets a cave have more than one way between two caverns; see [`digVeins`](../steps/dig-veins.md). All the options of `tunnels` are those of `digVeins`.

## Symmetry

A cave can look the same when mirrored or turned. Symmetry is an option of each step, so a symmetric cave passes the same `symmetry` to each: `'none'` (the default), `'horizontal'` (left to right), `'vertical'` (top to bottom), `'both'` (four mirrored quarters) or `'rotational'` (turned by 180°, so it looks the same upside down), the same values as the [dungeons](dungeon.md#layout-symmetry) take. The axes run through the center of the map; on a map with an odd width or height, the middle column or row is its own mirror image. A step can also be left without it, for a symmetric cave with tunnels of its own, for example.

```ts
const { grid } = generateCave({
  width: 61,
  height: 41,
  cave: { symmetry: 'both', symmetryChance: 0.9 },
  tunnels: { symmetry: 'both' },
  exits: { symmetry: 'both', count: { min: 2, max: 4 } },
});
```

`cave.symmetry` is made in the starting noise. The tiles are filled in row by row. The first tile of each set of mirror images is random, as usual, and each of its twins copies it with the chance `cave.symmetryChance`, and is random otherwise. Then the automaton runs as usual. Its rules treat all directions alike, so a symmetric start stays symmetric. At 1 (the default) the cave is perfectly symmetric. At 0 the noise is plain random, and the symmetry has no effect. In between, the cave is roughly symmetric: the stray tiles are mostly smoothed over, so it looks more balanced than the chance suggests, and a value near 0.9 gives a cave that is clearly symmetric but not exact.

### Symmetric tunnels

A symmetric start still leaves caverns to join, and a tunnel dug at random would spoil the symmetry. With `tunnels.symmetry`, every tunnel is copied onto its twins: once it is dug, every tile it turned into floor is turned into floor at its mirror images, too. The copy is made with the chance `tunnels.symmetryChance`, rolled once for every tunnel, so a tunnel either gets all its twins or none. A twin tile that would land on a tile a tunnel may not dig is left out. A cave whose tunnels are symmetric comes out nearly symmetric but not always exactly: the tunnels join the caverns in a different order than their twins do, and a twin can be cut short. See [`digVeins`](../steps/dig-veins.md) for the details. How strictly the tunnels follow the symmetry is a matter of taste, so you can have a cave with a symmetric look and tunnels of its own, or a symmetric cave with a few stray tunnels.

Things to know:

- Symmetry changes what the generator makes, so the same seed gives another cave than without it.
- `minRegionSize` keeps the symmetry, since twin caverns are equally large. `largestOnly` keeps one cavern, so it also fills in the twin of the one it keeps, and the result is symmetric only if the largest cavern is its own twin, for example because it crosses an axis.
- Exits follow a symmetry of their own, see [Exits](#exits).

## Exits

`exits` adds openings on the map border, for a game to join the cave to its surroundings. `exits.count` is a [range](../concepts.md#ranges), and the number of exits is picked from it. An exit is a `Door` tile on the border and, unless a cavern already reaches the border, a straight tunnel from it to the nearest floor. All the options of `exits` are those of [`openExits`](../steps/open-exits.md).

Each exit goes on a random side of the map. On that side, the exit is put where the tunnel is shortest, going straight in from the border. Exits are never next to each other, corners are never used, and a side with no floor in line with its border is skipped. When no side can reach any floor, fewer exits than asked for are made, which happens on a map with no floor at all. Exit tunnels are one tile wide whatever the width of the other tunnels, and they are part of the cavern that they reach.

With `exits.symmetry`, an exit gets twins with the chance `exits.symmetryChance`: an exit and its twins are dug together, one at each mirror image of the exit, and each twin gets the straight tunnel of its own. An exit on an axis is its own twin. The number of exits counts the twins, so the most that `count` allows is never exceeded, and a set of twins that would not fit in the exits that are left, or that would put two doors side by side (the two middle tiles of a side of even length, for example), is left out. The step then draws another exit, and gives up after ten such failures in a row, so a cave can have fewer exits than `count` asks for. A twin that has no floor in line with its border is left out, which can only happen when the cave is not perfectly symmetric.

## `CaveOptions`

| Option    | Default       | Meaning                                                                                                                                                        |
| --------- | ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `width`   |               | Map width in tiles. Required.                                                                                                                                  |
| `height`  |               | Map height in tiles. Required.                                                                                                                                 |
| `random`  | `Math.random` | Source of randomness.                                                                                                                                          |
| `cave`    | `{}`          | The options of [`digCellularCave`](../steps/dig-cellular-cave.md): the noise, the smoothing, the symmetry and which caverns to keep.                           |
| `tunnels` | `{}`          | The options of [`digVeins`](../steps/dig-veins.md), which joins the caverns, with `veinWidth` 1 and `density` 0 as defaults. `false` leaves the caverns apart. |
| `exits`   | none          | The options of [`openExits`](../steps/open-exits.md). Without it, the cave has no exits.                                                                       |

Every option is checked before the cave is made: a non-positive or non-integer size, or a bad option of a step, throws a `RangeError`, as the step itself would.

## `CaveResult`

- `grid`: the map, made of `Wall` and `Floor` tiles, and a `Door` tile for each exit.
- `rooms`: the caverns, as the cave step dug them ([`digCellularCave`](../steps/dig-cellular-cave.md), or [`digNoiseCave`](../steps/dig-noise-cave.md) for a [noise cave](#noise-caves)), before the tunnels joined them: a [`Room`](../rooms.md#room) of kind `'cavern'` each, its `x`, `y`, `width` and `height` the smallest rectangle that holds its floor, and its `exits` the places where the tunnels enter it. Caverns that `minRegionSize` or `largestOnly` filled in are not listed. The list is empty when the map has no floor.
- `roomShapes`: the shape of every cavern, by its id: its floor tiles are `Floor` cells, every other cell of its box `Unused`.
- `roomGroups`: the `'cave'` [group](../rooms.md#roomgroup) of the caverns, with the box the cave was dug in, the whole map. Empty when there are no caverns.
- `roomExits`: where the tunnels enter the caverns, an [`Exit`](../rooms.md#exit) each (see [ways into halls and caverns](../rooms.md#ways-into-halls-and-caverns)); a tunnel that ends on another tunnel makes none. Empty without `tunnels`. They are not the `exits` on the map border.

- `exits`: the door tiles on the map border, one per exit. Empty without `exits`.
- `attempts`: how many times the cave was built. A cave's steps do not fail, so it is 1.
- `failures`: one entry per failed attempt, as [`pipeline`](../composing.md#pipeline) reports them. Empty for a cave.

```ts
const { grid, rooms } = generateCave({
  width: 60,
  height: 30,
  cave: { largestOnly: true },
  tunnels: false,
});
const [cavern] = rooms; // the one cavern left, with its box
```

## Noise caves

```ts
import { generateNoiseCave } from 'angstloch';

const { grid, rooms } = generateNoiseCave({ width: 60, height: 30 });
const { grid: tunnels } = generateNoiseCave({
  width: 60,
  height: 30,
  cave: { shape: 'veins', fill: 0.8 },
});
```

`generateNoiseCave` makes a cave from [noise](../noise.md) instead of an automaton. It is the same composition as `generateCave`, with [`digNoiseCave`](../steps/dig-noise-cave.md) in place of `digCellularCave`: the options of `cave` are those of `digNoiseCave`, and `tunnels`, `exits`, the symmetry and the result work as described above. Every tile gets a score from the noise at its center, and the tiles with the lowest scores become walls.

`cave.fill` is the share of the tiles that become wall, from 0 to 1. It is not a chance per tile, and not a threshold of the noise: the step looks at the noise of all the tiles and picks the threshold that gives that share, so `fill: 0.45` gives about 45% wall (to within a tile) whatever the scales, the octaves or the noise. With `borderWalls`, the outer ring is walled on top of that, and `fill` counts the inner tiles only.

`cave.shape` says which part of the noise becomes floor:

- `'blobs'` (the default) makes floor of the high part of the noise, which gives rounded caverns with ragged edges.
- `'veins'` makes floor of the part nearest the midpoint of the noise, so the floor follows the places where the noise crosses 0. That gives a network of winding corridors of about even width, with junctions and dead ends, instead of caverns. `fill` still sets the share of walls, so a higher `fill` makes thinner veins: try 0.7 to 0.9. Veins can leave pockets, which the tunnels and `minRegionSize` deal with as for any cave.

`cave.cornerBias` rounds off the corners of the map. Without it, the noise knows nothing about the map, so a cavern can run right into a corner and end in a sharp wedge. With it, the score of every tile near a corner is lowered, by more than the whole range of the noise in the corner itself and by less and less further out, so the corners turn into wall whatever the noise says, and the caverns close off smoothly in a curve before they get there. The value is a distance in tiles from the corner: 4 (the default) pulls the walls in from a quarter circle of radius 4 around each corner, and 0 turns it off and gives the plain threshold. The distance is round, so the corners come out rounded, and straight edges are left alone, so a cavern can still run along the border. The pull applies before `fill` picks the threshold, so `fill` stays the share of walls and a stronger pull leaves less wall elsewhere, and it keeps a symmetry exact. It works without `borderWalls` as well, and with both shapes.

The look of the noise is set with the same options as the [forest](../steps/plant-trees.md) has: `scaleX` and `scaleY` (the size of a feature in tiles, 12 by default, which suits caverns; larger values make broader ones), `rotation` in degrees, and the layers of the built-in noise, `octaves` (3 by default, which roughens the edges; with 1 the shapes are smooth blobs), `persistence` (0.5) and `lacunarity` (2). Different scales on the two axes and a rotation stretch the caverns, which makes passages that run in one direction. A `noise` function replaces the built-in simplex noise: it takes positions in noise units and returns a number from -1 to 1. The scales and the rotation apply to it, and the octaves do not, so wrap it in `createFractalNoise` for layers. A custom noise should vary over the map, since the tiles that tie at the threshold all become floor, and a constant noise gives a map of floor, or of walls at a `fill` of 1.

`cave.iterations` runs that many passes of the cave automaton over the thresholded noise (the 4-5 rule on 8 neighbors), which rounds off specks and corners. It defaults to 0, which leaves the noise as it is. The smoothing eats thin corridors, so it suits `'blobs'` and spoils `'veins'`.

`cave.symmetry` works by sampling: a tile reads the noise at its first twin (row by row) with the chance `cave.symmetryChance`, and at its own position otherwise. The walls are picked after that, so `fill` stays accurate. At 1 (the default) the noise itself is symmetric, and so is the cave, and the tunnels and exits keep it so when they are given the same symmetry (see [Symmetry](#symmetry)).

### Example map

The map this code makes with seed 1 (`mulberry32` is defined in the [quick start](../../README.md#quick-start)):

<!-- map: generate-noise-cave -->

```ts
import { generateNoiseCave } from 'angstloch';

const result = generateNoiseCave({
  width: 80,
  height: 25,
  random: mulberry32(1),
});
```

```text
################################################################################
###########......##.......#####...............................#######.......####
######.####...............#####......................##.......########.......###
##..#...###.......###.....#####...............##....######...########..........#
##.....####......#####....####...............###...#######...#############.....#
#.....######...#######...#####..............##.....#######...##.##########.##..#
#......#####.....####....#####.............###...#..######.###..#.##.#####..####
#.......###......#######.#######..........####...##..#######..........####..####
##.....#####.....#######.########........#####..####.#####..........#....##.####
###....##.##############..#######.......######...#########............#####.##.#
###...#...#############.....######..#....#.##....#########...........######....#
##......#.#############......#####..##...........##########..........####.##..##
#...........###########......#####...............##########...........#........#
#............########.........#...................#########..............#.....#
#...............###...............##..............#########............###.....#
#...............#.................#####...........########...####......####....#
###.#..........#...................######.........#######....####......#####...#
#######........#...................######..........######.....###.....####.....#
########..............#...###.......######.........#####.....####.....####..##.#
#######....####......#...######.....#######.......#####......#####.##..####..###
#######....####......############....#..#####......####......#######...#########
######......###......#############........####......#.......########...#########
#####......#######..##############............................###......#########
####........######################.......##.##..............#####.#.....########
################################################################################
```

<!-- /map -->

### `NoiseCaveOptions`

| Option    | Default       | Meaning                                                                                                                                           |
| --------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `width`   |               | Map width in tiles. Required.                                                                                                                     |
| `height`  |               | Map height in tiles. Required.                                                                                                                    |
| `random`  | `Math.random` | Source of randomness. It seeds the built-in noise and rolls the symmetry, the tunnels and the exits.                                              |
| `cave`    | `{}`          | The options of [`digNoiseCave`](../steps/dig-noise-cave.md): the shape, the fill, the corners, the noise, the symmetry and which caverns to keep. |
| `tunnels` | `{}`          | As in [`CaveOptions`](#caveoptions).                                                                                                              |
| `exits`   | none          | As in `CaveOptions`.                                                                                                                              |

It returns a [`CaveResult`](#caveresult), and throws a `RangeError` for a bad option as `generateCave` does.
