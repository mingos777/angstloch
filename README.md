# angstloch

A suite of map generators for roguelike games, on a 2D square grid. Written in TypeScript, ESM only, with no runtime dependencies. The generators use no DOM or Node APIs, so they run in a browser, Node or a web worker.

Currently available:

- [`generateMaze`](#mazes): perfect and braid mazes.
- [`generateCave`](#caves): organic caves, grown with a cellular automaton.
- [`generateNoiseCave`](#noise-caves): caves cut out of noise, as rounded caverns or winding corridors.
- [`createSimplexNoise`](#noise): smooth 2D noise that can be stretched and turned, for terrain-like maps. Forests are built on it.
- [`generateForest`](#forests): forests of scattered trees with clearings and denser stands, from noise, with roads, crossroads and paths through them, and streams and rivers that the roads bridge.
- [`generateMine`](#mines): mines, as a main shaft with side tunnels branching off it, a web of winding veins, halls with pillars left standing, or concentric rings, dug until the map is as full as you want.
- [`generateRoomDungeon`](#dungeons): room-first dungeons: rooms are placed first and joined by corridors afterwards.
- [`generateDigDungeon`](#grown-dungeons): dungeons that grow out of a first room: each room is built beyond a wall of one there is, and corridors join them.
- [`pipeline`](#composing-maps): builds a map from an empty base and a list of steps, with retries. The generators are being rebuilt on it, one at a time.
- [`placeCellBlocks`](#placecellblocks): the cell blocks of a prison, rows of cells along a corridor, for a dungeon of your own.
- [`measureDistances`](#walking-distances): the walk between rooms or any other places of a finished map, for putting the stairs far apart.
- [`createRoomMap`](#createroommap): the room each tile of a finished map belongs to, halls and caverns included.

## Concepts

### Grid and tiles

Every generator returns a result object whose `grid` is a `Grid`: a flat `Uint8Array` of tiles with a few helpers.

```ts
grid.width; // number of columns
grid.height; // number of rows
grid.get(x, y); // the tile at the position; anything outside the grid is a Wall
grid.set(x, y, Tile.Floor); // throws a RangeError outside the grid
grid.inBounds(x, y);
grid.clone();
grid.toString(); // '#' wall, '.' floor, '+' door, '"' grass, 'T' tree, '=' road, '~' shallow water, '≈' deep water, '%' bridge, one line per row
```

Positions are plain `{ x, y }` objects (`Point`). `x` grows to the right and `y` grows downwards.

The numeric values of `Tile` are part of the public contract and never change; new kinds may be added.

| Tile                | Value | Meaning                                                                                                                           |
| ------------------- | ----- | --------------------------------------------------------------------------------------------------------------------------------- |
| `Tile.Wall`         | 0     | Solid rock.                                                                                                                       |
| `Tile.Floor`        | 1     | Passable floor.                                                                                                                   |
| `Tile.Door`         | 2     | A potential door placement. What to put there is yours.                                                                           |
| `Tile.Grass`        | 3     | Open ground of an outdoor map.                                                                                                    |
| `Tile.Tree`         | 4     | A tree. Whether it blocks movement or sight is yours.                                                                             |
| `Tile.Road`         | 5     | A road or a path. They differ only in how wide they are.                                                                          |
| `Tile.ShallowWater` | 6     | The banks of a stream: water that can be waded, at the cost of getting wet.                                                       |
| `Tile.DeepWater`    | 7     | The middle of a wide stream, where the current or the depth needs a swimmer. A game may treat both kinds of water as plain water. |
| `Tile.Bridge`       | 8     | A road where it crosses water.                                                                                                    |

### Options

Each generator is a function `generateX(options)` that takes a single options object. `width` and `height` are required, everything else is optional and has a documented default. A non-positive or non-integer dimension throws a `RangeError`, as does any other out-of-range option.

Generators are pure: they never mutate the options you pass in and keep no global state.

### Randomness and seeds

Every generator accepts `random`, a function returning a float in `[0, 1)` with the same contract as `Math.random`, which is the default. To get reproducible maps, pass the output of any seedable PRNG:

```ts
import { generateMaze } from 'angstloch';

const { grid } = generateMaze({
  width: 41,
  height: 21,
  random: mulberry32(42),
});
```

The same options and the same random sequence always produce the same map.

### Ranges

Some options take a `Range`: an object `{ min, max }` of whole numbers, both ends inclusive. `{ min: 2, max: 2 }` means exactly 2.

## Mazes

```ts
import { generateMaze } from 'angstloch';

const { grid, start, exits } = generateMaze({
  width: 41,
  height: 21,
  maze: { loopChance: 0.1 },
  exits: { count: { min: 2, max: 2 }, lattice: true },
});
console.log(grid.toString());
```

A maze is carved with a recursive backtracker. Corridors run along odd coordinates, which are the cells of the maze, so odd dimensions leave a single-tile wall frame. Tiles are `Tile.Wall` and `Tile.Floor`, and `Tile.Door` for the doors of rooms and the exits on the border.

`generateMaze` is a preset: a ready-made composition of [steps](#composing-maps) on a map of `Tile.Wall`, with one key of its options per step, each holding the options of that step. A maze is made in this order:

1. **[Rooms and templates](#rooms-in-mazes)** when `rooms` is given: [`placeMazeRooms`](#placemazerooms), with its options under `rooms`.
2. **The maze** itself: [`digMaze`](#digmaze), with its options under `maze`, on the whole map. It goes round the rooms.
3. **The openings** of the rooms when there are `rooms`: [`openMazeRooms`](#openmazerooms), with its options under `openings`.
4. **Exits** on the border when `exits` is given: [`openExits`](#openexits), with its options under `exits`.

Each step takes only its own options, with the defaults of that step; nothing passes from one key to another. So a maze with a given `start` and rooms gives the same point to `rooms.keepClear`, or a room may cover the start and the attempt fails, and exits whose doors face the cells of the maze want `exits: { lattice: true }`.

When a step throws, as a template that finds no place or covers the start does, the map is built again, up to 3 times in all, before the error is thrown; `attempts` and `failures` in the result say how it went. A maze in part of a map, several mazes, or any other order are compositions of your own: run the steps with [`pipeline`](#pipeline). Every option is checked before the first map is built, and a bad one throws a `RangeError` named after the option of its step.

### `MazeOptions`

| Option            | Default       | Description                                                                                                                                                                   |
| ----------------- | ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `width`, `height` | required      | Map size in tiles, at least 3.                                                                                                                                                |
| `random`          | `Math.random` | Source of randomness.                                                                                                                                                         |
| `maze`            | `{}`          | The options of [`digMaze`](#digmaze) but its `area` and `count`: the biases, `loopChance`, `fill`, `straight`, `pattern`, `patternChance` and `start`.                        |
| `rooms`           | none          | The options of [`placeMazeRooms`](#placemazerooms): ordinary rooms (`roomCount`, `roomWidth`, `roomHeight`, `sizeUniformity`), `templates` and their `doorChance`. See below. |
| `openings`        | `{}`          | The options of [`openMazeRooms`](#openmazerooms): `exitsPerRoom` and `doorChance`. Only used with `rooms`.                                                                    |
| `exits`           | none          | The options of [`openExits`](#openexits): `count` (how many exits), `lattice`, `symmetry`, `symmetryChance` and `tile`.                                                       |

### `MazeResult`

| Field       | Description                                                                                                                                                        |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `grid`      | The maze.                                                                                                                                                          |
| `start`     | The cell where carving started.                                                                                                                                    |
| `exits`     | Door tiles on the map border, one per exit. Empty without `exits`.                                                                                                 |
| `rooms`     | The [rooms](#rooms-in-mazes), templated ones first, with ids in that order. Empty without `rooms`. Each is a [`Room`](#room) whose `exits` index into `roomExits`. |
| `roomExits` | The openings of the rooms into the maze, each an [`Exit`](#exit) whose `door` says whether it got a door. They are not the `exits` on the map border.              |
| `attempts`  | How many times the maze was built, 1 or more: a map is built again when a step throws, up to 3 in all.                                                             |
| `failures`  | One entry per failed attempt, with the step that threw and what it threw, also when a later attempt succeeded.                                                     |

### Rooms in mazes

```ts
import { generateMaze } from 'angstloch';

const { grid, rooms, roomExits } = generateMaze({
  width: 61,
  height: 41,
  rooms: { roomCount: { min: 3, max: 5 }, roomWidth: { min: 5, max: 9 } },
  openings: { doorChance: 0.5 },
});
```

Rooms are placed first and the maze is carved around them. Rooms sit on the lattice of the maze: they start on odd coordinates and have odd dimensions. At least three wall tiles separate the floors of two rooms, which leaves room for a maze cell between them. A room's walls are part of the maze's walls, and it opens onto the maze through gaps in them.

The room options are those of [`placeMazeRooms`](#placemazerooms): `roomCount` is how many (1 to 1, so `rooms: {}` places one), `roomWidth` and `roomHeight` their size (3 to 7, odd sizes only), and `sizeUniformity` how alike they are (0). For templates alone, set `roomCount` to `{ min: 0, max: 0 }`.

Each room draws its number of openings from `openings.exitsPerRoom`, and every opening is a gap in the wall that leads to a maze cell, opened as a door with the chance `openings.doorChance`. The result stays connected: when a room cuts off a stretch of the maze, or leaves a room that nobody reaches, extra openings are made where they join the parts, so a room may have more openings than `exitsPerRoom` asks for. A room gets fewer when no carved maze cell is next to its walls, which happens with a low `fill`.

Rooms may be combined with a `pattern`, which then steers the corridors round them: the rooms themselves are not mirrored. `fill` counts only the cells outside the rooms. Without a `start`, the maze starts at the free cell nearest the middle, outside the rooms.

### Templates in mazes

```ts
import { generateMaze, TemplateCell, type RoomTemplate } from 'angstloch';

const { Floor: F, Wall: W, Exit: E } = TemplateCell;

const closet: RoomTemplate = {
  cells: [
    [W, E, W],
    [W, F, W],
    [W, W, W],
  ],
  count: { min: 2, max: 4 },
};

const { grid, rooms } = generateMaze({
  width: 61,
  height: 41,
  rooms: { roomCount: { min: 0, max: 0 }, templates: [closet] },
});
```

`rooms.templates` takes the same [`RoomTemplate`](#room-templates) objects as the dungeons, with the same `count`, `rotate`, `mirror`, `positions`, `areas` and `positionAccuracy`. They are placed first, before the ordinary rooms, which keep away from them, and the maze is carved around them. `templateSymmetry` does not exist for mazes.

A maze is a lattice, so templates are placed [on the lattice](#placement): a template's bounding box starts on even coordinates, its dimensions must be odd, and every `Exit` and `Door` that leads outside must face a tile with odd coordinates, which is where the maze has its cells. A template that has no variant that fits throws a `RangeError` at once. At least three wall tiles separate a template's footprint from another room's.

- The exit cells of a template open straight onto a maze cell. `Door` cells are always doors and `Exit` cells are doors with the chance `rooms.doorChance`. Every `Exit` and `Door` is opened, and if `fill` left the cell in front of it uncarved, a passage is carved from the nearest carved cell.
- `OptionalExit` cells are opened as far as `openings.exitsPerRoom` asks, counting the fixed exits. More are opened where they join parts of the map that would be cut off.
- The maze never digs through a template's walls or floors. `Unused` cells are free space like any other, so the maze may wind into a notch of a template's bounding box that is open to the outside.
- **Failures.** A template that finds no place, covers `rooms.keepClear`, or has an exit that cannot be joined to the maze fails the attempt, and a new map is built, up to three in all, before a [`TemplatePlacementError`](#room-templates) is thrown. A template is never left out.

Templated rooms are in `rooms`, listed before the ordinary ones, with `template`, `rotation` and `mirrored` set, and their openings are in `roomExits`. `roomCount` counts only ordinary rooms.

## Caves

```ts
import { generateCave } from 'angstloch';

const { grid, rooms } = generateCave({ width: 60, height: 30 });
console.log(grid.toString());
console.log(`the automaton left ${String(rooms.length)} caverns`);
```

`generateCave` is a ready-made composition of [steps](#composing-maps) on a map of wall: [`digCellularCave`](#digcellularcave) grows the caverns, [`digVeins`](#digveins) joins them into one with tunnels, and [`openExits`](#openexits) carves exits into the border. Its options are nested, one key per step, each holding the options of that step: `cave`, `tunnels` and `exits`. Every key is optional, and the steps' defaults apply. A step that is left out adds nothing: `tunnels: false` leaves the caverns apart, and without `exits` there are none. The `tunnels` key takes the options of `digVeins`, with two defaults of the preset: `veinWidth` is `{ min: 1, max: 1 }` and `density` is 0, so the veins only join the caverns. For other compositions, such as a cave in part of a map or beside a mine, run the steps with `pipeline`.

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

Tiles outside the map count as walls. The default limits are the classic 4-5 rule on 8 neighbors (`neighborhood: 'moore'`), which gives open, rounded caverns, and 3-2 on 4 neighbors (`'von-neumann'`). The limits are counted out of the neighbors there are, so a limit above that can never be reached, and a `birthLimit` of 9 stops floor from ever turning into a wall. Raising `fillChance` or lowering the limits gives more wall. Fewer `iterations` gives rougher caves. All the options of `cave` are those of [`digCellularCave`](#digcellularcave).

The automaton usually leaves several caverns that are not joined to each other. Caverns are groups of floor tiles that touch along an edge; tiles that only touch diagonally are separate caverns. `cave.minRegionSize` fills in the small pockets, and `cave.largestOnly` keeps only the largest cavern. Both apply as the cave is grown, before the tunnels.

### Joining the caverns

The tunnels are on by default, and join every cavern into one network. They are the veins of [`digVeins`](#digveins), with its pieces, ports and routing: the two caverns nearest each other are joined first, then the cavern nearest the network, and so on, so a tunnel may end on another tunnel. A tunnel runs through free rock round the other caverns, never across one, and keeps a wall between itself and them. Where the rock between two caverns is a single wall thick, there is no room for a wall on each side, so the tunnel is let through it as a last resort, and a cavern shut in by the others is entered through the rock that shuts it in. It only ever turns rock into floor, so no floor tile is lost.

`tunnels: false` leaves the caverns as the automaton made them, and with `cave: { largestOnly: true }` as well, the map is the largest cavern alone. A pocket that `minRegionSize` fills in never gets a tunnel. The shape of tunnels is set by the options of `digVeins`: `tunnels.veinWidth` (1 tile by default, wider for roomy caves) and `tunnels.veinWindiness` (how much a tunnel wanders, from 0 to 1, 0.5 by default). With `tunnels.density` above 0 the network also grows tunnels of its own in the rock between the caverns, and loops, which lets a cave have more than one way between two caverns; see [`digVeins`](#digveins). All the options of `tunnels` are those of `digVeins`.

### Symmetry

A cave can look the same when mirrored or turned. Symmetry is an option of each step, so a symmetric cave passes the same `symmetry` to each: `'none'` (the default), `'horizontal'` (left to right), `'vertical'` (top to bottom), `'both'` (four mirrored quarters) or `'rotational'` (turned by 180°, so it looks the same upside down), the same values as the [dungeons](#layout-symmetry) take. The axes run through the center of the map; on a map with an odd width or height, the middle column or row is its own mirror image. A step can also be left without it, for a symmetric cave with tunnels of its own, for example.

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

#### Symmetric tunnels

A symmetric start still leaves caverns to join, and a tunnel dug at random would spoil the symmetry. With `tunnels.symmetry`, every tunnel is copied onto its twins: once it is dug, every tile it turned into floor is turned into floor at its mirror images, too. The copy is made with the chance `tunnels.symmetryChance`, rolled once for every tunnel, so a tunnel either gets all its twins or none. A twin tile that would land on a tile a tunnel may not dig is left out. A cave whose tunnels are symmetric comes out nearly symmetric but not always exactly: the tunnels join the caverns in a different order than their twins do, and a twin can be cut short. See [`digVeins`](#digveins) for the details. How strictly the tunnels follow the symmetry is a matter of taste, so you can have a cave with a symmetric look and tunnels of its own, or a symmetric cave with a few stray tunnels.

Things to know:

- Symmetry changes what the generator makes, so the same seed gives another cave than without it.
- `minRegionSize` keeps the symmetry, since twin caverns are equally large. `largestOnly` keeps one cavern, so it also fills in the twin of the one it keeps, and the result is symmetric only if the largest cavern is its own twin, for example because it crosses an axis.
- Exits follow a symmetry of their own, see [Exits](#exits).

### Exits

`exits` adds openings on the map border, for a game to join the cave to its surroundings. `exits.count` is a [range](#ranges), and the number of exits is picked from it. An exit is a `Door` tile on the border and, unless a cavern already reaches the border, a straight tunnel from it to the nearest floor. All the options of `exits` are those of [`openExits`](#openexits).

Each exit goes on a random side of the map. On that side, the exit is put where the tunnel is shortest, going straight in from the border. Exits are never next to each other, corners are never used, and a side with no floor in line with its border is skipped. When no side can reach any floor, fewer exits than asked for are made, which happens on a map with no floor at all. Exit tunnels are one tile wide whatever the width of the other tunnels, and they are part of the cavern that they reach.

With `exits.symmetry`, an exit gets twins with the chance `exits.symmetryChance`: an exit and its twins are dug together, one at each mirror image of the exit, and each twin gets the straight tunnel of its own. An exit on an axis is its own twin. The number of exits counts the twins, so the most that `count` allows is never exceeded, and a set of twins that would not fit in the exits that are left, or that would put two doors side by side (the two middle tiles of a side of even length, for example), is left out. The step then draws another exit, and gives up after ten such failures in a row, so a cave can have fewer exits than `count` asks for. A twin that has no floor in line with its border is left out, which can only happen when the cave is not perfectly symmetric.

### `CaveOptions`

| Option    | Default       | Meaning                                                                                                                                            |
| --------- | ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `width`   |               | Map width in tiles. Required.                                                                                                                      |
| `height`  |               | Map height in tiles. Required.                                                                                                                     |
| `random`  | `Math.random` | Source of randomness.                                                                                                                              |
| `cave`    | `{}`          | The options of [`digCellularCave`](#digcellularcave): the noise, the smoothing, the symmetry and which caverns to keep.                            |
| `tunnels` | `{}`          | The options of [`digVeins`](#digveins), which joins the caverns, with `veinWidth` 1 and `density` 0 as defaults. `false` leaves the caverns apart. |
| `exits`   | none          | The options of [`openExits`](#openexits). Without it, the cave has no exits.                                                                       |

Every option is checked before the cave is made: a non-positive or non-integer size, or a bad option of a step, throws a `RangeError`, as the step itself would.

### `CaveResult`

- `grid`: the map, made of `Wall` and `Floor` tiles, and a `Door` tile for each exit.
- `rooms`: the caverns, as the cave step dug them ([`digCellularCave`](#digcellularcave), or [`digNoiseCave`](#dignoisecave) for a [noise cave](#noise-caves)), before the tunnels joined them: a [`Room`](#room) of kind `'cavern'` each, its `x`, `y`, `width` and `height` the smallest rectangle that holds its floor, and its `exits` the places where the tunnels enter it. Caverns that `minRegionSize` or `largestOnly` filled in are not listed. The list is empty when the map has no floor.
- `roomShapes`: the shape of every cavern, by its id: its floor tiles are `Floor` cells, every other cell of its box `Unused`.
- `roomGroups`: the `'cave'` [group](#roomgroup) of the caverns, with the box the cave was dug in, the whole map. Empty when there are no caverns.
- `roomExits`: where the tunnels enter the caverns, an [`Exit`](#exit) each (see [ways into halls and caverns](#ways-into-halls-and-caverns)); a tunnel that ends on another tunnel makes none. Empty without `tunnels`. They are not the `exits` on the map border.

- `exits`: the door tiles on the map border, one per exit. Empty without `exits`.
- `attempts`: how many times the cave was built. A cave's steps do not fail, so it is 1.
- `failures`: one entry per failed attempt, as [`pipeline`](#pipeline) reports them. Empty for a cave.

```ts
const { grid, rooms } = generateCave({
  width: 60,
  height: 30,
  cave: { largestOnly: true },
  tunnels: false,
});
const [cavern] = rooms; // the one cavern left, with its box
```

### Noise caves

```ts
import { generateNoiseCave } from 'angstloch';

const { grid, rooms } = generateNoiseCave({ width: 60, height: 30 });
const { grid: tunnels } = generateNoiseCave({
  width: 60,
  height: 30,
  cave: { shape: 'veins', fill: 0.8 },
});
```

`generateNoiseCave` makes a cave from [noise](#noise) instead of an automaton. It is the same composition as `generateCave`, with [`digNoiseCave`](#dignoisecave) in place of `digCellularCave`: the options of `cave` are those of `digNoiseCave`, and `tunnels`, `exits`, the symmetry and the result work as described above. Every tile gets a score from the noise at its center, and the tiles with the lowest scores become walls.

`cave.fill` is the share of the tiles that become wall, from 0 to 1. It is not a chance per tile, and not a threshold of the noise: the step looks at the noise of all the tiles and picks the threshold that gives that share, so `fill: 0.45` gives about 45% wall (to within a tile) whatever the scales, the octaves or the noise. With `borderWalls`, the outer ring is walled on top of that, and `fill` counts the inner tiles only.

`cave.shape` says which part of the noise becomes floor:

- `'blobs'` (the default) makes floor of the high part of the noise, which gives rounded caverns with ragged edges.
- `'veins'` makes floor of the part nearest the midpoint of the noise, so the floor follows the places where the noise crosses 0. That gives a network of winding corridors of about even width, with junctions and dead ends, instead of caverns. `fill` still sets the share of walls, so a higher `fill` makes thinner veins: try 0.7 to 0.9. Veins can leave pockets, which the tunnels and `minRegionSize` deal with as for any cave.

`cave.cornerBias` rounds off the corners of the map. Without it, the noise knows nothing about the map, so a cavern can run right into a corner and end in a sharp wedge. With it, the score of every tile near a corner is lowered, by more than the whole range of the noise in the corner itself and by less and less further out, so the corners turn into wall whatever the noise says, and the caverns close off smoothly in a curve before they get there. The value is a distance in tiles from the corner: 4 (the default) pulls the walls in from a quarter circle of radius 4 around each corner, and 0 turns it off and gives the plain threshold. The distance is round, so the corners come out rounded, and straight edges are left alone, so a cavern can still run along the border. The pull applies before `fill` picks the threshold, so `fill` stays the share of walls and a stronger pull leaves less wall elsewhere, and it keeps a symmetry exact. It works without `borderWalls` as well, and with both shapes.

The look of the noise is set with the same options as the [forest](#planttrees) has: `scaleX` and `scaleY` (the size of a feature in tiles, 12 by default, which suits caverns; larger values make broader ones), `rotation` in degrees, and the layers of the built-in noise, `octaves` (3 by default, which roughens the edges; with 1 the shapes are smooth blobs), `persistence` (0.5) and `lacunarity` (2). Different scales on the two axes and a rotation stretch the caverns, which makes passages that run in one direction. A `noise` function replaces the built-in simplex noise: it takes positions in noise units and returns a number from -1 to 1. The scales and the rotation apply to it, and the octaves do not, so wrap it in `createFractalNoise` for layers. A custom noise should vary over the map, since the tiles that tie at the threshold all become floor, and a constant noise gives a map of floor, or of walls at a `fill` of 1.

`cave.iterations` runs that many passes of the cave automaton over the thresholded noise (the 4-5 rule on 8 neighbors), which rounds off specks and corners. It defaults to 0, which leaves the noise as it is. The smoothing eats thin corridors, so it suits `'blobs'` and spoils `'veins'`.

`cave.symmetry` works by sampling: a tile reads the noise at its first twin (row by row) with the chance `cave.symmetryChance`, and at its own position otherwise. The walls are picked after that, so `fill` stays accurate. At 1 (the default) the noise itself is symmetric, and so is the cave, and the tunnels and exits keep it so when they are given the same symmetry (see [Symmetry](#symmetry)).

#### `NoiseCaveOptions`

| Option    | Default       | Meaning                                                                                                                              |
| --------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `width`   |               | Map width in tiles. Required.                                                                                                        |
| `height`  |               | Map height in tiles. Required.                                                                                                       |
| `random`  | `Math.random` | Source of randomness. It seeds the built-in noise and rolls the symmetry, the tunnels and the exits.                                 |
| `cave`    | `{}`          | The options of [`digNoiseCave`](#dignoisecave): the shape, the fill, the corners, the noise, the symmetry and which caverns to keep. |
| `tunnels` | `{}`          | As in [`CaveOptions`](#caveoptions).                                                                                                 |
| `exits`   | none          | As in `CaveOptions`.                                                                                                                 |

It returns a [`CaveResult`](#caveresult), and throws a `RangeError` for a bad option as `generateCave` does.

## Noise

Noise is a smooth, random-looking landscape of values: neighboring positions get similar values, so it forms hills and valleys, not static. It is the basis of outdoor maps, where it can say how dense the trees are or how high the ground is.

```ts
import {
  createFractalNoise,
  createSimplexNoise,
  transformNoise,
} from 'angstloch';

const noise = transformNoise(
  createFractalNoise(createSimplexNoise(random), { octaves: 2 }),
  { scaleX: 60, scaleY: 20, rotation: 30 },
);
const height = noise(x, y); // x and y are tile positions
```

A `NoiseFunction` is `(x, y) => number`. It returns a float from -1 to 1 for any position, including negative ones, and the same position always gives the same value. Positions are in noise units, not tiles: the noise has features about one unit wide, so tile coordinates have to be divided by a number to zoom the noise to a useful size. `transformNoise` does that, and can stretch and turn the noise as well. Generators that take a noise function treat it this way too, and apply the transform to it. You can pass any function with that shape, such as one from another noise library.

- `createSimplexNoise(random?)` creates 2D simplex noise. The `Random` shuffles the table that the noise is built from, so a given random source always gives the same landscape and another one gives a different landscape. The random source is not used when the noise is sampled. It defaults to `Math.random`. The values are spread over almost the whole range from -1 to 1 and average out around 0.
- `createFractalNoise(noise, options?)` adds layers of `noise` together, each finer and weaker than the one before, so there is fine detail on top of broad shapes. The result stays within -1 and 1.

| Option        | Default | Meaning                                                                                                       |
| ------------- | ------- | ------------------------------------------------------------------------------------------------------------- |
| `octaves`     | 3       | Number of layers. 1 is the plain noise. A whole number, 1 or more.                                            |
| `persistence` | 0.5     | How much each layer counts against the one before it, from 0 (only the first layer) to 1 (all layers alike).  |
| `lacunarity`  | 2       | How much finer each layer is than the one before it: its positions are multiplied by this. A positive number. |

Invalid `FractalNoiseOptions` throw a `RangeError`.

- `transformNoise(noise, options?)` turns noise into a function of tile positions. A position is rotated clockwise about the origin (the top-left corner of the map, with y growing downwards) and then divided by the scales along the rotated axes.

| Option     | Default | Meaning                                                                          |
| ---------- | ------- | -------------------------------------------------------------------------------- |
| `scaleX`   | 1       | Size in tiles of a feature along the x axis, before rotation. A positive number. |
| `scaleY`   | 1       | Size in tiles of a feature along the y axis, before rotation. A positive number. |
| `rotation` | 0       | Clockwise rotation in degrees, any number. The stretched axes turn with it.      |

Different scales stretch the shapes: with `scaleX: 80` and `scaleY: 20` they are four times as long as they are wide, and they run left to right. A `rotation` of 90 makes them run top to bottom, and 45 makes them run diagonally, down and to the right. Positions are rotated before they are scaled, so the shapes turn without being sheared. Rotating about the origin only changes which part of the endless noise is seen, and the seed already decides that. An invalid scale or a rotation that is not a finite number throws a `RangeError`.

## Forests

```ts
import { generateForest } from 'angstloch';

const { grid } = generateForest({ width: 120, height: 70 });
console.log(grid.toString());
```

A forest is made from a [noise](#noise) map that says how dense the trees are: dense where the noise is high and open where it is low. Every tile then gets a tree with the chance that the map gives it. So a wood is a place where trees are likely, not a solid block, and its edge is ragged. Trees are `Tile.Tree` and the ground between them is `Tile.Grass`. Whether a tree blocks movement or sight is for the game to decide; the generator makes no connectivity guarantee.

`generateForest` is a ready-made composition of the [steps](#composing-maps) of this library, and its options are nested, one key for each step: `trees` for [`plantTrees`](#planttrees), `streams` for [`layStreams`](#laystreams), `roads` for [`layRoads`](#layroads), `clearings` for [`placeClearings`](#placeclearings), `templates` for [`placeTemplates`](#placetemplates) and `footbridges` for [`layFootbridges`](#layfootbridges). Each key holds the options of its step, so everything those sections say about a step is true of the key. A step whose key is missing is left out (`trees` is the exception: the trees are always planted, with the defaults when the key is missing). The steps run in this order:

1. `plantTrees` plants the trees over the grass.
2. `layStreams`, laid first, since a natural feature has priority.
3. `layRoads`, which bend to cross the streams.
4. `placeClearings` and 5. `placeTemplates`.
5. `layClearingPaths`, when a clearing asks for a path, with its options under `paths`.
6. `layFootbridges`, when there are `streams`, unless `footbridges` is `false`.

Each step takes only its own options, with the defaults of that step; nothing passes from one key to another. So paths that should look like the roads get the same `roadTile`, `bridgeTile`, `clearance`, `falloff` and `distance` under `paths` as under `roads`.

Every step that lays something clears the trees from its own [verge](#verges-and-pruneverge), so the trees fill in around roads, water and clearings. When a step throws, which happens to a template that finds no room, the forest is built again from the start, up to 3 times in all, and only then is the error thrown; see [`pipeline`](#pipeline). The result reports `attempts` and `failures`. For a forest that is not this composition, run the steps yourself with `pipeline`, in any order they allow: that is what this function does.

The chance of a tree is set at the two ends of the noise: `trees.density` is a `Range` of fractions, `min` where the noise is at its lowest and `max` where it is at its highest. In between the chance rises evenly with the noise. With the defaults, 0 and 0.25, the lowest parts are bare and the thickest woods are a quarter full of trees, so the trees stand apart. Raise `max` for tighter woods: 1 packs the thickest parts solid. Both can be anything from 0 to 1, and `min` may be the larger of the two, which puts the trees where the noise is low. The noise is sampled at the center of each tile, and `random` both seeds the built-in noise and rolls the chance for each tile, so the same seed always gives the same forest. The noise rarely reaches the very ends of its range, so the chances rarely do either. There is no `density` in the result: count the trees, or sample the noise yourself.

### Roads

```ts
const { grid, roads, exits } = generateForest({
  width: 120,
  height: 70,
  roads: { angle: 20, width: { min: 3, max: 4 }, windiness: 0.5 },
});
```

Without `roads` the forest has no roads. With it, a main road runs through the forest from one edge of the map to the opposite one, and no trees grow on it: road tiles are `Tile.Road` (or `roadTile`). The trees are planted first and the roads laid over them, so the trees fill in around the roads.

The road is laid through a random point near the middle of the map, at the `angle`, and is then followed in both directions until it leaves the map. The angle is in degrees, clockwise from east, like `rotation`: 0 runs from left to right, 90 from top to bottom and 45 from the top left towards the bottom right. `'random'` picks an angle. The road winds as far as `windiness` says: its centerline is pushed to either side by smooth noise, which makes gentle bends and not jitter. At 1 it strays up to 12 tiles from the straight line. Its width is picked from the `width` range, in whole tiles, and the road is rounded at its edges when it is wide. Where a road leaves the map, it is laid as if it went on a little past the border, so the border cuts it at the angle it leaves at instead of ending it in a block; a road that leaves at a shallow angle tapers along the edge. Its centerline in `roads` and its tile in `exits` stay on the map.

| Road option | Default              | Meaning                                                                                           |
| ----------- | -------------------- | ------------------------------------------------------------------------------------------------- |
| `angle`     | `'random'`           | Direction of the main road in degrees, clockwise from east, or `'random'`.                        |
| `width`     | `{ min: 3, max: 3 }` | Width of the main road, and of the crossings, in tiles, a `Range` of whole numbers of at least 1. |
| `windiness` | 0.3                  | How much every road winds, from 0 (straight) to 1.                                                |

An invalid angle, width or windiness throws a `RangeError`.

#### Clearance, falloff and distance

By default the trees grow right up to the road, which can look like a hedge. The [verge](#verges-and-pruneverge) of `roads` keeps a strip beside every road free of trees: the main road, the crossings and the branches. The paths to clearings have a verge of their own, under `paths`. It has three fields, `clearance`, `falloff` and `distance`, which sit among the options of `roads`:

```ts
generateForest({
  width: 120,
  height: 70,
  roads: { clearance: 1, falloff: 3, distance: 'euclidean' },
});
```

- `clearance` is a number of tiles, 0 by default. No tree grows within `clearance` tiles of a road tile, in any direction. With the default `distance`, a step to a diagonal neighbor counts as one tile, so a clearance of 1 keeps trees off all eight neighbors of every road tile, diagonals included, and a clearance of 2 clears a strip two tiles wide on either side. The strip has a hard edge: beyond it the trees grow as thick as they would have anyway.
- `falloff` softens that edge: beyond the clear strip, the trees thicken gradually until they are at full density again. It is a number of tiles, 0 by default, and the chance of a tree grows in equal steps over them, so with a `falloff` of 3 the first tile past the clearance has a quarter of its chance, the next half, the next three quarters, and the one after that all of it. The two are independent: a `falloff` with a `clearance` of 0 thins the trees right next to the road, and a `clearance` with no `falloff` is the hard strip.
- `distance` says how the distance to a road is measured: `'chebyshev'` (the default) counts a diagonal step as one tile, which makes square verges; `'manhattan'` counts only orthogonal steps, which makes diamonds and suits games where diagonal movement is not possible; `'euclidean'` measures the straight line between tile centers, so a diagonal step is about 1.41 tiles, which makes round verges and a continuous falloff.

The verges of the other features are those of their steps, each with its own values: `streams` has the same three fields for the banks (see [Banks](#banks)), `clearings` has `falloff` and `distance`, since a clearing is bare inside its edge (see [Clearings](#clearings)), and `templates` has a `distance` for the `margin` of its templates. Where two verges overlap, slightly more is cleared than either alone would. A `clearance` or `falloff` that is not a whole number of at least 0, or a `distance` that is not one of the three, throws a `RangeError`.

#### Clearings

`clearings` makes glades: patches with no trees, a good place for a camp, a hut or a hamlet. Each clearing is a `ClearingSpec`. It has a center of its own, so the caller decides where it goes, or it leaves the center out and is placed at random, or it is placed at the end of a branch (see [below](#clearings-at-branch-ends)) or on a stream (see [Clearings on a stream](#clearings-on-a-stream)):

```ts
const { grid, clearings } = generateForest({
  width: 120,
  height: 80,
  clearings: {
    clearings: [
      {
        x: 60,
        y: 40,
        radiusX: { min: 12, max: 12 },
        radiusY: { min: 7, max: 7 },
        angle: 30,
      },
      { x: 20, y: 15, radiusX: { min: 4, max: 4 }, irregularity: 0.8 },
      { radiusX: { min: 3, max: 6 } }, // placed at random, radius 3 to 6
      { radiusX: { min: 4, max: 4 } },
    ],
    spacing: 2,
    falloff: 3,
  },
});
```

| Clearing option | Default               | Meaning                                                                                                                                                                                                                            |
| --------------- | --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `x`, `y`        |                       | The tile of the center, whole numbers inside the map. Required.                                                                                                                                                                    |
| `at`            | none                  | `'branch-end'` puts the clearing at the end of a branch, and `'stream'` on a stream, instead of giving it a center. See [Clearings at branch ends](#clearings-at-branch-ends) and [Clearings on a stream](#clearings-on-a-stream). |
| `radiusX`       |                       | The approximate radius in tiles along the x axis, before `angle`, a `Range` of whole numbers, 1 or more. One is picked at random. Required.                                                                                        |
| `radiusY`       | `radiusX`             | The approximate radius along the y axis, a `Range` like `radiusX`. Different radii make an oval.                                                                                                                                   |
| `angle`         | 0                     | Clockwise rotation of the oval in degrees, any number.                                                                                                                                                                             |
| `irregularity`  | 0.5                   | How ragged the edge is, from 0 (a plain oval) to 1 (very ragged).                                                                                                                                                                  |
| `roadDistance`  | `{ min: 8, max: 25 }` | How far from the nearest road tile a clearing placed at random lies, a `Range` of whole numbers, 0 or more. See below.                                                                                                             |
| `path`          | none                  | `true` or `{ width?, windiness? }` leads a path to the clearing. See [Paths to clearings](#paths-to-clearings).                                                                                                                    |

The edge is not a clean oval. Noise shifts every tile before its distance to the center is measured, so the edge bulges and pinches, and every clearing gets its own outline, even when they are given the same shape. The radii are the radii of the plain oval, and the ragged edge wanders around them, so the real size is only approximately what you asked for. A tile only belongs to the clearing if it joins the center through other tiles of the clearing, so a clearing is always one piece, with no detached specks of bare ground beyond its edge. The center is always part of the clearing, and the part that falls outside the map is cut off.

No tree grows in a clearing. Beyond its edge the `falloff` of `clearings` thins the trees out, measured with its `distance`, as the falloff of a [verge](#verges-and-pruneverge) does beside a road. There is no `clearance`, since the inside of a clearing is always bare. A road that runs through a clearing stays a road. The noise of the clearings is separate from the noise that sets the density of the trees, so adding a clearing never changes where the woods are thick.

A clearing without a center is placed after the ones that have a center, in the order of the list. Its center is picked at random, with these rules: the whole plain oval stays inside the map, and it keeps away from every clearing placed before it by at least the sum of their larger radii, so the plain ovals do not overlap (the ragged edges can still touch). `spacing` (an option of `clearings`, next to the list) adds tiles to that distance: a whole number, default 0. It does not move clearings that have a center, and it does not apply to them. A clearing that finds no room after a number of tries, or that is too large for the map, is left out and no error is thrown, so the `clearings` in the result may be fewer than asked for, always in the order of the list. Random placement uses the `random` source, so the same seed gives the same places.

With roads, a clearing placed at random also keeps its `roadDistance` from the roads that are laid when it is placed: its center lies at least `min` and at most `max` tiles from the nearest road tile, measured with `distance`. The default range of 8 to 25 puts it near enough to reach but off the road. When no tile on the map fits, the clearing is left out, as above. `roadDistance` does nothing without roads, and for a clearing with a center of its own. Paths to clearings are laid after all clearings are placed, so they do not count as roads for this distance.

#### Clearings at branch ends

A road that ends in a clearing: give a clearing `at: 'branch-end'` and no `x` or `y`, and it is centered on the dead end of a [branch](#crossings-and-branches). It works best with a `branchLength`, which makes branches stop in the forest and not run to the border.

```ts
const { grid, clearings } = generateForest({
  width: 120,
  height: 80,
  roads: { branches: { min: 3, max: 3 }, branchLength: { min: 15, max: 30 } },
  clearings: {
    clearings: [
      { at: 'branch-end', radiusX: { min: 3, max: 6 } },
      { at: 'branch-end', radiusX: { min: 3, max: 6 } },
    ],
  },
});
```

- Each such clearing takes the next branch end, in the order the branches were laid, so two of them fill two dead ends. A clearing that finds no branch end is left out, with no error, so there may be fewer `clearings` than asked for. That is also the case without roads.
- Only the ends that lie inside the map count. A branch that runs to the border is an exit and gets no clearing, and neither do the [paths to clearings](#paths-to-clearings), which already end in a clearing.
- These clearings never keep away from others: `spacing` does not apply to them, and none is dropped for overlapping another. Two that touch merge into one bare patch, which suits several paths that lead to one glade.
- The `clearings` in the result list them after all the others, in the order of their branches.
- The other options (radii, `angle`, `irregularity`) work as for any clearing, and so do `falloff` and `distance`. `roadDistance` does nothing for them. A `path` does nothing either, since the center is on a road already.

An `at` that is not `'branch-end'` or `'stream'`, or one that comes with an `x` or `y`, throws a `RangeError`.

#### Clearings on a stream

Streams often run through the middle of a meadow, and a clearing with `at: 'stream'` does the same: it is centered on a random tile of the centerline of a [stream](#streams-and-rivers), a tributary included.

```ts
const { grid, clearings } = generateForest({
  width: 120,
  height: 80,
  streams: { width: { min: 2, max: 3 } },
  clearings: { clearings: [{ at: 'stream', radiusX: { min: 5, max: 8 } }] },
});
```

- No tree grows in the clearing, as in any other, but the water in it stays water, so the stream flows through the glade, and the roads and bridges in it stay as they are.
- It is placed like a clearing at a random place: it keeps `spacing` tiles beyond the radii from the clearings placed before it, the whole plain oval stays inside the map, and the clearings are placed in the order of the list, after the ones with a center. A clearing that finds no room, or when there is no stream, is left out with no error.
- `roadDistance` does nothing for it, and neither does a `path`, since its center is in the water.

#### Paths to clearings

A clearing can have a path: set `path` to `true`, or to `{ width, windiness }`. The path is a narrow track that starts at the nearest tile on the centerline of a road and ends in the center of the clearing. Without roads it starts at the nearest tile on the border of the map, so the clearing is reached from outside the map, and the tile on the border is one of the `exits`. Both ends are fixed, and the path winds gently in between, more with a higher `windiness`.

| Path option | Default | Meaning                                                |
| ----------- | ------- | ------------------------------------------------------ |
| `width`     | 1       | Width of the path in tiles, a whole number, 1 or more. |
| `windiness` | 0.3     | How much the path winds, from 0 (straight) to 1.       |

The path is a road of kind `'branch'` in `roads`, after the roads of the `roads` option and in the order of the clearings, so it shows up in `junctions` (where it meets a road) and in `exits` (where it reaches the border) like any branch. The paths are laid by [`layClearingPaths`](#layclearingpaths) after the templates, with the `roadTile`, `bridgeTile` and verge of `paths`; give them the same values as `roads` for paths that look like the roads. This works with or without the `roads` option, and with clearings that have a center of their own as well as random ones. A later path may start at an earlier path if that is the nearest road. A path that stops at the template on its clearing, and a path that runs through another template, are described under [`layClearingPaths`](#layclearingpaths). A clearing whose center is on a road already gets no path. A clearing that was left out gets none either. The default is no path, since a glade can just as well be in the middle of the forest with no way in.

A clearing with a center outside the map, an `x` or `y` that is not a whole number, only one of the two given, a radius that is not a `Range` of whole numbers of at least 1, an angle that is not finite, an `irregularity` outside 0 to 1, an invalid `roadDistance` range, or a path with a `width` that is not a whole number of at least 1 or a `windiness` outside 0 to 1 throws a `RangeError`.

#### Crossings and branches

More roads can be attached to the main road, which makes a network. Every new road is laid on a place of a road that is there already, so the network is always joined up, and no road stands on its own.

- A **crossing** is a road that passes through a place on a road and runs on to both edges of the map, which makes a crossroads. It has the same `width` as the main road, and it meets the road at an angle picked from `crossingAngle`, turned to the left or to the right.
- A **branch** is a thinner path that leaves a road at a place on it and goes on one side only, so it forks away from the road. It leaves at an angle picked from `branchAngle` to the road, along it or against it. It has a width from `branchWidth` and a length from `branchLength`. A branch with no `branchLength` runs to the edge of the map. A branch that is not long enough to get there ends in the forest, which is a good place for a clearing, a camp or a hut. A branch may leave a crossing or another branch, and a crossing may cross a branch.

Crossings are laid first and branches after them. A place on a road is chosen at random, but never close to the ends of the road or to a junction, so roads do not pile up in one spot, and longer roads are more likely to be chosen. When the map is too small to find such a place, fewer roads are made than asked for, and no error is thrown. Each road winds with its own pattern of bends, at the same `windiness`.

| Road option     | Default                | Meaning                                                                                                                          |
| --------------- | ---------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `crossings`     | none                   | Number of crossings, a `Range` of whole numbers, 0 or more.                                                                      |
| `crossingAngle` | `{ min: 45, max: 90 }` | The angle in whole degrees, 1 to 179, at which a crossing meets the road. 90 is a right angle.                                   |
| `branches`      | none                   | Number of branches, a `Range` of whole numbers, 0 or more.                                                                       |
| `branchWidth`   | `{ min: 1, max: 1 }`   | Width of a branch in tiles, a `Range` of whole numbers of at least 1.                                                            |
| `branchAngle`   | `{ min: 20, max: 70 }` | Fishbone only. The angle in whole degrees, 1 to 179, between a branch and the road it leaves. A small angle makes a gentle fork. |
| `branchLength`  | to the edge            | Length of a branch in tiles, a `Range` of whole numbers of at least 1.                                                           |

The result lists every road, in the order they were laid: the main road, then the crossings (all of kind `'road'`), then the branches (kind `'branch'`). `junctions` lists the places where roads meet, and not only the ones that were planned: wherever the centerlines of two roads touch, that is a junction too, and where two roads share a stretch of tiles it counts as one junction, at the first of them. `exits` lists the places where roads reach the border. A branch that ends in the forest has no exit. An invalid range or an angle outside 1 to 179 throws a `RangeError`.

#### Exact roads

For full control, `specs` lists the roads one by one. When it is given, it replaces the generated network: `angle`, `width`, `crossings`, `crossingAngle`, `branches`, `branchWidth`, `branchAngle` and `branchLength` are ignored, and `windiness` is only the default of the entries. An empty list lays no roads. The roads are laid in the order of the list, and the result lists them in that order.

```ts
const { grid, roads } = generateForest({
  width: 100,
  height: 70,
  roads: {
    specs: [
      { origin: { x: 50, y: 35 }, angle: 0, width: 3 }, // 0: the main road
      { parent: 0, at: 0.3, angle: 90 }, // 1: a crossing at 30% of the main road
      { kind: 'branch', parent: 1, at: 0.7, length: 20 }, // 2: a branch off the crossing
      { kind: 'branch', origin: { x: 5, y: 5 }, to: { x: 40, y: 30 } }, // 3: a path between two points
    ],
  },
});
```

| Entry field | Default                                | Meaning                                                                                                                         |
| ----------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `kind`      | `'road'`                               | A `'road'` passes through its start in both directions. A `'branch'` leaves it in one.                                          |
| `width`     | 3 for a road, 1 for a branch           | Width in tiles, a whole number, 1 or more.                                                                                      |
| `windiness` | `windiness` of the road options        | How much this road winds, from 0 to 1.                                                                                          |
| `parent`    | none                                   | The index of an earlier entry. The road starts at a tile of that road, and the two make a junction.                             |
| `at`        | 0.5                                    | Where along the parent the road starts, from 0 (its first tile) to 1 (its last).                                                |
| `origin`    | a random point near the middle         | Where a free-standing road starts or passes, in tiles. Ignored with a `parent`.                                                 |
| `angle`     | random, or a right angle to the parent | Direction in degrees, clockwise from east. Ignored with `to`.                                                                   |
| `length`    | to the edge                            | The most tiles a branch runs. Ignored with `to`.                                                                                |
| `to`        | none                                   | Where the road ends, in tiles. The road then runs from its start to this point and ends there. Needs an `origin` or a `parent`. |

Placement is best effort and never an error: an `origin` or `to` outside the map is moved onto it, a road runs only as far as the map goes, and a winding road strays a little from its straight line. A `parent` that is not the index of an earlier entry, a `width` or `length` that is not a whole number of at least 1, a `windiness` or `at` outside 0 to 1, an angle or point that is not finite, an unknown `kind`, or a `to` with neither an `origin` nor a `parent` throws a `RangeError`.

### Streams and rivers

`streams` lays a stream through the forest, and a river is the same thing, only wider. A stream is a road made of water, so it winds like one and has a width in tiles. It is laid before the roads, as a natural feature has priority, and the roads then cross it:

```ts
const { grid, streams, bridges } = generateForest({
  width: 120,
  height: 70,
  streams: { width: { min: 3, max: 3 } },
  roads: { crossings: { min: 1, max: 2 } },
});
```

The stream runs from one border of the map to the opposite one through a point near the middle (or, with `spring`, rises at that point, see [below](#springs)), and the water flows the way of its `angle`, so the first point of its centerline in `streams` is upstream and the last is the mouth. Its banks are `Tile.ShallowWater`, which can be waded at the cost of getting wet. A stream wide enough has `Tile.DeepWater` in the middle, which a game may gate behind a swimming ability, or it may treat both as plain water. No tree grows in the water, and where a stream flows off the map there is no bank at the edge. Like a road, a stream goes on a little past the border, so the edge cuts it cleanly, deep water included.

| Stream option                      | Default                               | Meaning                                                                                                                                                                                                                                                                                                                                      |
| ---------------------------------- | ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `angle`                            | `'random'`                            | Direction of the flow in degrees, clockwise from east, so 0 flows left to right and 90 top to bottom. `'random'` picks one.                                                                                                                                                                                                                  |
| `width`                            | `{ min: 1, max: 2 }`                  | Width in tiles, a `Range` of whole numbers, 1 or more. A whole number in it is picked at random.                                                                                                                                                                                                                                             |
| `windiness`                        | 0.5                                   | How much the stream winds, from 0 (straight) to 1 (it may stray up to 12 tiles to either side of the straight line).                                                                                                                                                                                                                         |
| `shoreWidth`                       | 1                                     | How many tiles of shallow water the stream has on each side, a whole number, 0 or more. The rest, in the middle, is deep. A stream no wider than twice this has no deep water: with the default, widths 1 and 2 are all shallow and width 3 has a single band of deep water along its middle, and each extra tile of width widens that band. |
| `spring`                           | `false`                               | Whether the stream rises at a spring inside the map and flows from it to the edge, see [Springs](#springs).                                                                                                                                                                                                                                  |
| `shallowTile`, `deepTile`          | `Tile.ShallowWater`, `Tile.DeepWater` | The tiles of the shallow and the deep water.                                                                                                                                                                                                                                                                                                 |
| `clearance`, `falloff`, `distance` | 0, 0, `'chebyshev'`                   | The verge kept clear of trees beside the water, see [Banks](#banks).                                                                                                                                                                                                                                                                         |

The bridges are the business of the other steps: the angle at which roads meet the stream is `bridgeAngle` among the `roads` options, and the footbridges are the `footbridges` key (see [Bridges](#bridges) and [Footbridges](#footbridges)).

#### Springs

With `spring: true` the stream does not run from edge to edge. It rises at a point near the middle of the map, the first point of its centerline in `streams`, and flows from there to the edge of the map the way of its `angle`, with no water upstream of the spring. The land can then be walked round it, so it needs no footbridge. Tributaries can join it as they join any stream.

#### Tributaries

`tributaries` adds thinner streams that flow into the stream from the side. Each leaves a point of a stream, away from its ends and from the other confluences, and runs upstream, at an angle from `tributaryAngle` to the flow of the stream it joins, to either side, so the two meet at an acute angle as real streams do. A tributary may join another tributary. It runs to the edge of the map, or, with a `tributaryLength`, stops in the forest, which makes a spring.

| Stream option     | Default                | Meaning                                                                                                                   |
| ----------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `tributaries`     | none                   | How many tributaries, a `Range` of whole numbers, 0 or more. Fewer are made when the map is too small to place them.      |
| `tributaryWidth`  | `{ min: 1, max: 1 }`   | Width in tiles, a `Range` of whole numbers, 1 or more.                                                                    |
| `tributaryAngle`  | `{ min: 30, max: 60 }` | The angle in whole degrees, from 1 to 179, between a tributary and the flow of the stream it joins, as a `Range`.         |
| `tributaryLength` | to the edge            | The length in tiles, a `Range` of whole numbers, 1 or more. A tributary too short to reach the edge starts in the forest. |

In `streams` a tributary is a `Road` of `kind` `'branch'`, after the main stream, in the order they were laid, and its `points` run with the water: from its source to the tile where it joins the stream. Its water has the same banks and deep water as the stream's, and where it joins, the water of the two is one. Roads are planned across a tributary as they are across the stream, see [Bridges](#bridges).

#### Banks

By default trees grow right up to the water, as they often do. The `clearance`, `falloff` and `distance` of `streams` thin them out beside it, exactly as those of `roads` do beside a road ([see above](#clearance-falloff-and-distance)), for the water of every stream and with their own values: `clearance` tiles are bare and the trees then thicken over `falloff` tiles. They default to 0, 0 and `'chebyshev'`, and `clearance` and `falloff` must be whole numbers of at least 0, or a `RangeError` is thrown.

#### Bridges

Where a road meets water, the road wins: its tiles over the water become `Tile.Bridge`, as wide as the road, and the water under it is not shown. A generated road (the main road, the crossings and the branches of `roads`, which keep the `bridgeAngle` of `roads` and `bridgeTile`) is first grown as described above, and if it comes near water (within half its width and a tile of it), its way across the streams is planned and the road is laid again through the plan:

- **Ends.** An end on the edge of the map that lies in or beside the water slides along the edge to the nearest tile clear of it, preferably on the same side and on the land the road reaches first (within 30 tiles), so a road and a stream that leave the map at the same place do not overlap. An end on the edge may also slide up to 30 tiles along its side when that lets the road reach its first crossing, or leave its last one, with a gentler turn and leave the edge squarely, so the road's `angle` is a best effort near streams. An end inside the map, such as the start of a branch, does not move.
- **Route.** The road goes over the same land as it was grown over, crossing from each piece of land that the water cuts the map into to the next, a stream crossed back and forth only once. Where that means crossing a tributary and then the stream it joins, the road may instead cross the stream once below where the two meet, whichever turns the road less; a crossing of that kind is looked for within 20 tiles of the grown road only.
- **Crossings.** Each crossing is a straight bridge at an angle from `bridgeAngle` to the stream, never longer than the stream across allows, so it never runs along a stream, with 4 tiles of straight road on either bank (fewer near the edge of the map). Of the possible places, the one picked asks the road to turn least on its way to the bridge and on from it, lies near the road as grown (within 10 tiles if it can, then 20), away from the place where another stream joins, and over a single band of water, and the road must be able to get there over land without a long detour. No way of the road turns more sharply than about 6 degrees a tile where there is a gentler one.
- **Laying.** Between the waypoints (the ends of the road and both ends of the straight run onto each bridge) the road is laid as a smooth curve that winds by the road's `windiness`, as a grown road does, with the bends fading out at every waypoint so that every bridge is met square on. A road whose way was free at an end of the map arcs evenly into its first crossing. Every stretch keeps the middle of the road at least half its width and a tile from the water, so that the road never touches the water except on its bridges; never comes back within its width of itself; never runs along the edge of the map; and turns no more sharply than about 45 degrees over 9 tiles where a gentler curve keeps the other rules. Where no curve fits, because the road has to go round the end of a stream, say, it follows the shortest way round the water, near the straight line, off the edge of the map where it can be, and rounded off. A road that crosses no stream keeps its course and is laid again only where it came near the water, or from end to end when that would turn too sharply.

A road that cannot be planned is left as it was grown. The roads of `roads.specs` and the [paths to clearings](#paths-to-clearings) are not planned, since they are placed exactly, and they are bridged wherever they happen to span the stream. A planned road is a bridge over the whole width of its straight run onto each bridge, and touches no water anywhere else. Any other road over water that does not span it, because it clips a bank, runs along the bank of the stream or ends in it, gives way to the water: a group of bridge tiles is laid only when it joins two different pieces of land, those that the water cuts the map into. A bridge is as wide as the road that crosses: where the road is wider than the crossing line, the lanes at its sides are bridge too, not water.

#### Footbridges

Footbridges join the land where water that a walker cannot step through cuts it apart. A stream that runs from edge to edge, and tributaries that reach the border, split the map into pieces, and the roads may not cross them all. So where the land (every tile that is not water, with roads and their bridges counting as land) falls into pieces, the nearest two are joined by a footbridge by the shortest crossing there is, and this is repeated until there is one piece. Only a stream at least 2 tiles wide cuts the land: even when it is all shallow, crossing it means wading. A stream 1 tile wide can be stepped through and never gets a footbridge of its own. A piece of land smaller than 20 tiles, such as a scrap cut off where a tributary and its stream leave the map side by side, stays an island and is not joined.

A footbridge is one tile of `Tile.Bridge` wide and goes square across the stream, so where the stream runs at a slant it is a staircase of tiles that touch along edges, which can be walked without diagonal steps. Where it cannot go square, it slants by up to 20 degrees. It is never longer than the stream is wide plus two tiles, so it never runs along a stream, and never lies on the edge of the map. Pieces that no such footbridge can join are left apart, which did not happen in 800 random maps with streams 2 to 4 tiles wide and up to four tributaries. Trees are taken to be passable, as the generator does elsewhere. A stream with a `spring` does not cut the land and needs none.

`footbridges` is on by default whenever there are `streams`, and `footbridges: false` turns it off, for a forest whose streams may cut the land. Its `minimum` (0 by default) asks for more: it is the least number of bridges the map has, roads included. If the roads and the footbridges that join the land make fewer, more footbridges are added, each across a stream at a random place, at least 8 tiles from another bridge. These may cross a stream of any width, 1 included, and go square across it as above. When there is no room, the map has fewer than `minimum`. Footbridges are not bent to `bridgeAngle`; that is for roads.

`bridges` in the result has one point for every bridge, footbridges included: a group of bridge tiles that touch along an edge, at the tile nearest to its middle. The roads and `junctions` are not changed by a bridge, and a stream never makes a junction.

`shallowTile` and `deepTile` of `streams` and the `bridgeTile` of `roads` and `footbridges` replace the tiles of the water and the bridge, for instance `Tile.Floor` for shallow water and `Tile.Wall` for deep water in a game that makes no distinction. Give the same `bridgeTile` to every step that has one.

A `minimum` that is not a whole number of at least 0, a `width`, `tributaryWidth` or `tributaryLength` that is not a `Range` of whole numbers of at least 1, `tributaries` that is not a `Range` of whole numbers of at least 0, a `tributaryAngle` that is not a `Range` of whole degrees from 1 to 179, a `windiness` outside 0 to 1, a `shoreWidth` that is not a whole number of at least 0, an `angle` that is not finite or `'random'`, a `bridgeAngle` that is not a `Range` of whole degrees from 1 to 179, or a `shallowTile`, `deepTile` or `bridgeTile` that is not a `Tile` value throws a `RangeError`.

### Templates in forests

Put a ruin, a camp or a boss arena in the forest with `templates: { templates }`, the options of [`placeTemplates`](#placetemplates): a list of the same [`RoomTemplate`](#room-templates) objects as the dungeons take. A forest has no tunnels, so a template has no exits: it is a design of `Floor`, `Wall` and `Unused` cells. A template with an `Exit`, `Door` or `OptionalExit` cell, or with `positions` or `areas`, throws a `RangeError`, as does an invalid `count`, `chance`, `margin` or `rotate`.

```ts
import { TemplateCell, generateForest, type RoomTemplate } from 'angstloch';

const { Unused: _, Floor: F, Wall: W } = TemplateCell;

const ruin: RoomTemplate = {
  name: 'ruin',
  cells: [
    [_, W, W, W, _],
    [W, F, F, F, W],
    [W, F, F, F, W],
    [W, F, F, F, W],
    [_, W, F, W, _],
  ],
  rotate: [0, 90, 180, 270],
  clearing: true,
  margin: 3,
};

const { grid, templates } = generateForest({
  width: 120,
  height: 80,
  roads: {},
  clearings: { clearings: [{ radiusX: { min: 8, max: 8 }, path: true }] },
  templates: { templates: [ruin] },
});
```

| Template field     | Default        | Meaning                                                                                                                                                                           |
| ------------------ | -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `clearing`         | `false`        | Whether the template needs a clearing. A template that does not goes to a random spot, and the trees stay round it and in its `Unused` cells.                                     |
| `chance`           | 1              | The chance that each copy is placed at all, from 0 to 1. With 1 every copy is placed, which is what a boss arena needs. With a lower chance it can happen that no copy is placed. |
| `margin`           | 0              | For a template on a clearing of its own: how many tiles beyond its box the trees take to thicken from none to full density, a whole number, 0 or more. See below.                 |
| `count`            | exactly 1      | Number of copies, a `Range` of at least 0. Each copy is rolled against `chance` on its own and goes on a clearing of its own.                                                     |
| `rotate`, `mirror` | `[0]`, `false` | The variants a copy may be placed in, as for dungeons.                                                                                                                            |

**Where a template goes.** A template with `clearing: true` is centered on a free clearing from `clearings`, picked at random among those where it fits. The clearing is never grown: ask for clearings of a fitting size. A clearing holds one template at most. When no free clearing has room for it, because there are none or all are taken or blocked, the template gets a clearing of its own: it goes to a random spot, and the whole box of the template is free of trees. The `margin` makes the trees thicken over that many tiles beyond the box, with the same ramp as a [verge](#verges-and-pruneverge)'s falloff (with a `margin` of 3 the first tile beyond the box has a quarter of the chance of a tree, the next half, the next three quarters), so a template leaves no bare rectangle. That clearing is not in `clearings`: `ownClearing` of the template says so.

**Which tiles a template changes.** `Floor` cells become `Tile.Floor` and `Wall` cells `Tile.Wall`, over trees and ground. `Unused` cells leave whatever the map has there: a tree, grass, a road or water. A template never covers a road, a path or water: it is placed only where none of its `Floor` or `Wall` cells lies on one, and where it overlaps no other template. A path to the clearing it stands on (see [Paths to clearings](#paths-to-clearings)) stops at the edge of the template. A road that a template cannot be placed clear of makes that forest fail, see below.

**A template always appears, or it throws.** A template is requested because the map needs it, so it is never quietly left out. A template that finds no place gets a new forest, up to three forests in all, and only after the third a [`TemplatePlacementError`](#room-templates) is thrown. Since every forest failed, the input is at fault (a template that fills the map, say) and not the map. A template that is bigger than the map throws at once. A `chance` below 1 is the only way a template is left out, and it is no error.

The `templates` result lists the templates that were placed, in the order of the list and of their copies, each with its `template` (the index in `templates`), the box it fills (`x`, `y`, `width`, `height`), its `rotation` and `mirrored`, the `clearing` it stands on (the index in the `clearings` result, left out for a template placed anywhere or on a clearing of its own) and `ownClearing`.

### `ForestOptions`

| Option        | Default         | Meaning                                                                                                                                                                                                                                                               |
| ------------- | --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `width`       |                 | Map width in tiles. Required.                                                                                                                                                                                                                                         |
| `height`      |                 | Map height in tiles. Required.                                                                                                                                                                                                                                        |
| `random`      | `Math.random`   | Source of randomness, shared by all the steps.                                                                                                                                                                                                                        |
| `trees`       | the defaults    | The options of [`plantTrees`](#planttrees): `scaleX`, `scaleY`, `rotation`, `octaves`, `persistence`, `lacunarity`, `noise`, `density` (a `Range` of fractions, default `{ min: 0, max: 0.25 }`) and `tile` (default `Tile.Tree`). The ground is always `Tile.Grass`. |
| `streams`     | no streams      | The options of [`layStreams`](#laystreams), a stream or a river: see [Streams and rivers](#streams-and-rivers). Includes the tiles of the water and the verge beside it.                                                                                              |
| `roads`       | no roads        | The options of [`layRoads`](#layroads): see [Roads](#roads). Includes `roadTile`, `bridgeTile`, `bridgeAngle` and the verge (`clearance`, `falloff`, `distance`).                                                                                                     |
| `clearings`   | no clearings    | The options of [`placeClearings`](#placeclearings): `{ clearings, spacing, falloff, distance }`, where `clearings` is the list of `ClearingSpec`: see [Clearings](#clearings).                                                                                        |
| `templates`   | no templates    | The options of [`placeTemplates`](#placetemplates): `{ templates, distance }`, where `templates` is the list of [`RoomTemplate`](#room-templates)s: see [Templates in forests](#templates-in-forests).                                                                |
| `paths`       | the defaults    | The options of [`layClearingPaths`](#layclearingpaths): `roadTile`, `bridgeTile` and the verge (`clearance`, `falloff`, `distance`) of the paths to clearings. Used only when a clearing asks for a path. Nothing is taken from `roads`.                              |
| `footbridges` | on with streams | The options of [`layFootbridges`](#layfootbridges): `{ minimum, bridgeTile }`. Used only when there are `streams`, and then on by default; `false` leaves the footbridges out.                                                                                        |

Anything the steps check throws a `RangeError` before the forest is made, as does a width or height that is not a positive whole number. A template that is bigger than the map throws a `TemplatePlacementError` just as early.

### `ForestResult`

- `grid`: the map.
- `roads`: the roads that were laid, the main road first. Each is a `Road` with its `kind` (`'road'` for the main road and crossings, `'branch'` for branches and for the [paths to clearings](#paths-to-clearings)), its `width` in tiles and its `points`, the tiles of its centerline from one end to the other, each next to the one before. Empty without the `roads` option and without paths.
- `junctions`: the places where roads meet or cross, which are good places for a signpost or an inn. Empty while there is a single road. See [Crossings and branches](#crossings-and-branches).
- `exits`: the tiles on the map border where a road leaves the map, as for a [maze](#mazes). A game can join the maps on the other sides there.
- `streams`: the streams that were laid, as `Road`s: `width` in tiles and `points`, the tiles of the centerline from upstream to the mouth. Empty without the `streams` option. See [Streams and rivers](#streams-and-rivers).
- `bridges`: the bridges, one point for each place where a road or a footbridge crosses water. Empty without streams.
- `clearings`: the clearings that were made, each with its center `x` and `y`, `radiusX`, `radiusY` (the radii that were picked, plain numbers) and `angle`, the defaults filled in, and the `path` it asked for with its width and windiness. Empty without the `clearings` option. See [Clearings](#clearings).
- `templates`: the templates that were placed, each with its `template` index, its box (`x`, `y`, `width`, `height`), `rotation`, `mirrored`, the `clearing` it stands on and `ownClearing`. Empty without the `templates` option. See [Templates in forests](#templates-in-forests).
- `attempts` and `failures`: how many times the forest was built (1 to 3) and one `{ attempt, step, error }` for each attempt that failed, also when a later one worked. See [`pipeline`](#pipeline).

There is no `density` in the result, since the chance of a tree belongs to `plantTrees` and nothing else needs it.

```ts
const { grid, roads, bridges, attempts } = generateForest({
  width: 200,
  height: 100,
  trees: {
    scaleX: 80,
    scaleY: 20,
    rotation: 30,
    density: { min: 0, max: 0.45 },
  },
  streams: { width: { min: 2, max: 3 } },
  roads: { windiness: 0.5, clearance: 1, falloff: 2 },
  footbridges: { minimum: 2 },
});
```

## Mines

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

A mine is a solid map with tunnels dug into it. In a [dungeon](#dungeons) the rooms are the content and the corridors only join them. In a mine it is the other way round: the tunnels are the structure. Tiles are `Tile.Wall` and `Tile.Floor`, and `Tile.Door` for the doors of rooms and the exits on the border. The map is closed in by a ring of wall, and the mine is always one connected piece, since every tunnel, cavern and room is joined to the rest.

`generateMine` is a preset: a ready-made composition of [steps](#composing-maps) on a map of `Tile.Wall`, with one key of its options per step, each holding the options of that step. A mine is made in this order:

1. **The layout**, one of four steps, picked by its key: `fishbone` ([`digFishbone`](#digfishbone), the default), `veins` ([`digVeins`](#digveins)), `pillars` ([`digPillarHalls`](#digpillarhalls), followed by [`digVeins`](#digveins) for its `hallVeins` key) or `rings` ([`digRings`](#digrings)). At most one of the four may be given, and none means a fishbone with its defaults; two or more throw a `RangeError`. Each layout has options of its own, among them its `density`, described below and in its step's section.
2. **[Caverns](#caverns)** when `caverns` is given: [`digNoiseCave`](#dignoisecave), followed by [`digVeins`](#digveins) to join them, with its options under `tunnels` (`false` leaves the caverns apart).
3. **[Rooms and templates](#rooms-and-templates)** when `rooms` is given: [`placeMineRooms`](#placeminerooms).
4. **[Exits](#exits-1)** on the border when `exits` is given: [`openExits`](#openexits).

When a step throws, as a template that finds no place does, the map is built again, up to 3 times in all, before the error is thrown; `attempts` and `failures` in the result say how it went. Two layouts in one map, a mine in part of a map, or any other order are compositions of your own: run the steps with [`pipeline`](#pipeline).

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

### The fishbone layout

A fishbone is how a mine is dug when exploring for ore. First comes the **main shaft**: a wide tunnel that is straight, or nearly so, through a point near the middle of the map. It runs in both directions from that point, until it meets the edge of the map. Then **adits** are dug: narrower side tunnels that each leave a random spot of a tunnel that exists, the shaft or another adit, at some angle, and wind a little as they go. They branch off one another as well as off the shaft, so the mine grows into a tree.

An adit is picked one after another until the `density`, the share of the map that is floor, is reached. It is a target and is met as far as there is room: when no more adits fit, the generator stops short of it without an error. The main shaft is always dug, so a `density` of 0 gives the shaft alone, and a shaft that is wider than the target leaves the density above it.

Tunnels keep apart. An adit that comes near another tunnel stops short of it, with a wall between them, and ends in a dead end. An adit that ends up shorter than the minimum of `aditLength` is not dug. With `loops`, an adit that comes up against another tunnel breaks through into it with that chance instead, which joins the two and makes a loop in the mine.

`angle` is the direction of the main shaft in degrees, clockwise from east, like the `rotation` of [noise](#noise) and the `angle` of [roads](#roads): 0 runs from left to right, 90 from top to bottom. `'random'` picks one. The shaft winds as far as `shaftWindiness` says, which is a little by default, and the adits as far as `aditWindiness` says. A windiness is from 0 (straight) to 1, and works as the `windiness` of roads does: the tunnel is pushed to either side by smooth noise, so it bends gently and does not jitter. A shaft that winds off the map is cut where it leaves, and the part that holds its middle is dug.

Widths are `Range`s of whole tiles. The shaft gets one width, and every adit its own. A tunnel two tiles wide or more has rounded corners. `aditLength` is measured along the line that the adit follows, so an adit that runs at a diagonal covers up to about 40% more tiles than its length. `branchAngle` is the angle between an adit and the tunnel it leaves, in whole degrees from 1 to 179. The adit leaves along the tunnel or against it, to its left or its right, so a small angle forks away gently and 90 is a right angle.

### The veins layout

```ts
const { grid } = generateMine({ width: 80, height: 50, veins: {} });
```

Veins are how a mine looks that follows the veins of an ore, which run where they please: an irregular web of winding tunnels, like a labyrinth or the edges of a Voronoi diagram. The generator spreads **junctions** over the map: it cuts the map into cells about `veinSpacing` tiles across and puts one junction at a random spot well inside each cell, which spreads them out evenly without lining them up. The tunnels between junctions are the **veins**, and each one winds as far as `veinWindiness` says, on its own bends.

On an empty map the web grows from one junction, the one nearest the middle. The junction nearest the web is joined next, by a vein to the nearest tile of anything dug so far, veins included, so a vein may end on another vein in a T, and so on until the `density` is reached. A map that has no room left for a junction, or a `density` too high for the junctions, gets finer junctions in between, then extra veins that make loops, and stops there. So a higher `density` makes a bigger web, and every vein is routed through free rock and never across another.

The veins have no main shaft: `passages` lists the veins in the order they were dug, each with the `kind` `'vein'`. The default `density` of 0.15 gives a sparse web on an 80 by 50 map, and 0.25 a dense one. `veinSpacing` sets the scale of the first junctions: with 8 the veins are short and the web is fine, with 30 there are a few long ones. A map smaller than the spacing gets two junctions at least, and one smaller than 3 tiles inside its border has no floor. The same step joins any floor that is on the map already, see [`digVeins`](#digveins).

### The pillars layout

```ts
const { grid, rooms } = generateMine({ width: 80, height: 50, pillars: {} });
```

Pillars are how a coal seam is mined, with room and pillar: large halls are dug out, and islands of untouched rock are left standing in them to hold up the roof, which gives a pattern of polka dots. The result is a few big halls joined by winding tunnels. Two steps make it, as two keys of the preset: `pillars` digs the halls and the pillars ([`digPillarHalls`](#digpillarhalls)), and `hallVeins` joins the halls ([`digVeins`](#digveins)), with the defaults of that step when it is left out, a `density` of 0.15 among them, so the web grows some junctions of its own in the rock round the halls. A `density` of 0 joins the halls and digs nothing else. The veins are dug after the pillars, so a vein starts only from the outer boundary of a hall.

**Halls.** The number of halls is picked from `halls` (2 to 4 by default), and each is a rough rectangle with a jagged edge, placed at random with at least 4 tiles of rock between it and any other. A hall that finds no room is left out, so a crowded map gets fewer than asked for, and at least one is always dug. The size of each side of a hall is picked from `hallSize`. Without it, a size is worked out from the `density`: the halls together fill about that share of the map once the pillars are taken out, in a shape that is a little wide or tall. A derived hall that finds no room shrinks until it does, and one with a size of its own is left out instead. `hallRagged`, from 0 to 1, sets how jagged the edges are: at 0 a hall is a clean rectangle, and at 1 its sides are cut back by up to 4 tiles, a depth that does not grow with the hall. The corners come out rounded and cut.

**Joining** (`hallVeins`). The halls are joined into one network of veins that grows from a first vein. The two halls nearest each other are joined first. Then the hall nearest the network is joined to it, and so on until every hall is in. A hall is joined by one vein to the nearest tile on the boundary of any hall or vein that is in the network already, so halls need not be joined directly: a vein may end on another vein, in a T. A vein never crosses another one. So a mine of `n` halls has `n - 1` veins at least, and a single hall has none. What `density` asks for beyond that, the junctions and the loops, is described under [`digVeins`](#digveins).

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

Every hall is a [`Room`](#room) of kind `'pillarHall'` in the result's `rooms`, with its shape and its group: see [`MineResult`](#mineresult).

### The rings layout

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

**Spokes.** Between every ring and the next, at least one spoke runs outwards at a random angle, so the mine is one piece. `spokes` is how many join each pair, a `Range` (1 to 3 by default) picked once for each pair, and a pair always gets one, so a minimum of 0 is the same as 1. The spokes of a pair are spread round the rings at about even distances, with a little shuffling, and they wind as far as `veinWindiness` says. Their width is picked from `veinWidth`. With one ring there are no spokes.

`passages` lists the rings first, from the innermost out, with the `kind` `'ring'`, then the spokes, with the kind `'spoke'`. The first and last tile of a ring are the same tile.

### Caverns

```ts
const { grid, rooms, roomGroups } = generateMine({
  width: 80,
  height: 50,
  caverns: { count: { min: 1, max: 2 } },
});
```

Some mines break into natural caverns. With `caverns`, any layout gets them, dug into the rock beside the tunnels once the layout is done. `caverns` takes the options of [`digNoiseCave`](#dignoisecave), with four defaults of its own that make each cavern one blob beside the mine:

| Option             | Default here                                                 | The step's default |
| ------------------ | ------------------------------------------------------------ | ------------------ |
| `placement`        | `'beside'`                                                   | `'free'`           |
| `area`             | sides of 12 to 24 tiles, cut down to the map less its border | the whole map      |
| `scaleX`, `scaleY` | 7                                                            | 12                 |
| `largestOnly`      | true                                                         | false              |

The rest are the step's defaults: `count` is 1 to 1, so `caverns: {}` digs one cavern, and `fill` is 0.45, the share of the box that is wall (a lower share makes a larger, rounder cavern, and a higher one a smaller, thinner one). Without `caverns`, there are none.

**Where a cavern goes.** With `placement: 'beside'` (see [`digCellularCave`](#digcellularcave)), the cavern is made first on its own, and then up to 100 random spots are tried; a spot fits when the cavern's floor, and every tile round it, is rock, so there is always a wall between the cavern and the mine, while its box may overlap the tunnels. Of the spots that fit, the one nearest the mine wins. Then [`digVeins`](#digveins) joins every cavern to the mine, with the defaults of the preset (veins 1 tile wide and a `density` of 0, so it only joins) or the options under `tunnels`; `tunnels: false` leaves the caverns apart. The tunnels are not listed in `passages`.

**A cavern that finds no spot.** A layout that fills the map leaves no room: a `rings` mine has none for a cavern of the default size, and a dense `veins` mine little. The caverns up to `count.min` fail the map, which is built again up to 3 times in all, and then the error is thrown. The caverns above `count.min` are left out. So `count: { min: 0, max: 2 }` never fails, and `placement: 'overlap'` puts a cavern into the tunnels instead, like a cave-in.

Every cavern is a [`Room`](#room) of kind `'cavern'` in the result's `rooms`, in a `'cave'` group of its own with the box it was made in: see [`MineResult`](#mineresult).

### Rooms and templates

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

Any layout can get rooms: a store, a chapel, a shaft office. They are dug into the rock beside the tunnels once the rest of the mine is done, after the caverns, and joined to the mine by tunnels. `rooms` takes the options of [`placeMineRooms`](#placeminerooms), with its defaults, and without `rooms` there are none.

**Ordinary rooms.** `roomCount` is how many (1 to 1, so `rooms: {}` places one), `roomWidth` and `roomHeight` their size (3 to 7), and `sizeUniformity` how alike they are (0), as for the [maze's](#rooms-in-mazes) rooms. Sizes are the floor, without the wall, and any size is allowed, since a mine has no lattice. A room is a rectangle of floor inside a ring of wall, which a gap can open anywhere along. For templates alone, set `roomCount` to `{ min: 0, max: 0 }`.

**Templates.** `templates` under `rooms` takes the same [`RoomTemplate`](#room-templates) objects as the dungeons and mazes, with the same `count`, `rotate`, `mirror`, `positions`, `areas` and `positionAccuracy`. They are placed before the ordinary rooms. Placement is anywhere in the rock the template fits, or where its `positions` and `areas` say, and a template that cannot be placed, or cannot be joined to the mine, gets a new mine, up to three in all, before a [`TemplatePlacementError`](#room-templates) is thrown (see [Room templates](#room-templates)). A template is never left out. The cells of a template that stand for the wall around a room are part of it, so keep them in the design. There is no `templateSymmetry`.

**Where rooms go.** A room, with its wall, keeps at least 2 tiles of rock from the tunnels, halls, pillars and caverns, and from other rooms, and it never overlaps them. A room that finds no spot is left out, so a crowded map gets fewer rooms than asked for, and templates are the exception and throw. An ordinary room is put at the best of up to 20 places that fit, the nearest to the mine, which keeps its tunnels short.

**Openings.** A room opens onto the mine at its exits. `exitsPerRoom` (1 to 3) is how many, picked for each room: the `Exit` and `Door` cells of a template that lead outside always open and count, and `OptionalExit` cells open as far as the count asks for beyond them, nearest the mine first. An ordinary room has an optional exit all round its wall. There is at least one opening in every room, and no two openings are next to each other, diagonals included: an optional exit beside an opening that is open already stays a wall, so a room may get fewer openings than `exitsPerRoom` asks for. Fixed `Exit` and `Door` cells are always opened, so a template that puts two of them side by side gets two openings side by side. Every opening is a gap in the wall that gets a door with the chance `doorChance` (1 by default), and is a plain opening otherwise. `Door` cells of a template are always doors.

From each opening, a tunnel runs to the nearest floor of the mine, which may be another room's tunnel but never a room. It winds as veins do, in the width and windiness of the `veinWidth` and `veinWindiness` of `rooms`, and when that would cross a room, it follows the shortest way round instead. The tunnels are listed in `passages` after all the others, with the `kind` `'tunnel'`. A room that cannot be joined, for want of a free way, is left out, and a template that cannot be joined throws.

The rooms are in `rooms`, templated ones first, with `template`, `rotation` and `mirrored` set, and their openings are in `roomExits`, as for [mazes](#mazeresult): see [`MineResult`](#mineresult). An ordinary room's `x`, `y`, `width` and `height` describe its floor, and a templated room's its bounding box, walls included. A door is a `Tile.Door`, so a room is not part of the same group of floor tiles as the mine for a check that goes by `Tile.Floor` alone.

### Exits

`exits` adds mouths to the mine on the border of the map, like the exits of a [cave](#exits): a `Tile.Door` on the border and a straight tunnel from it to the nearest floor, found by going straight in. It takes the options of [`openExits`](#openexits): a number is picked from `count`, and fewer are made when the mine has no more places for them. The doors are listed in `exits`, and no two of them are side by side. Without `exits`, there are none.

### `MineOptions`

| Option      | Default           | Meaning                                                                                                                                                                            |
| ----------- | ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `width`     |                   | Map width in tiles. Required.                                                                                                                                                      |
| `height`    |                   | Map height in tiles. Required.                                                                                                                                                     |
| `random`    | `Math.random`     | Source of randomness. It seeds the noise that bends the tunnels and rolls everything else.                                                                                         |
| `fishbone`  | the layout        | A fishbone: the options of [`digFishbone`](#digfishbone). The layout when no other is given.                                                                                       |
| `veins`     | none              | A web of veins: the options of [`digVeins`](#digveins).                                                                                                                            |
| `pillars`   | none              | Pillar halls: the options of [`digPillarHalls`](#digpillarhalls).                                                                                                                  |
| `hallVeins` | on with `pillars` | The veins that join the pillar halls: the options of [`digVeins`](#digveins). A `RangeError` without `pillars`.                                                                    |
| `rings`     | none              | Rings and spokes: the options of [`digRings`](#digrings).                                                                                                                          |
| `caverns`   | none              | Caverns beside the mine: the options of [`digNoiseCave`](#dignoisecave), with `placement`, `area`, the scales and `largestOnly` defaulting as described under [caverns](#caverns). |
| `tunnels`   | on                | Only used with `caverns`: the options of [`digVeins`](#digveins), which joins the caverns to the mine, with `veinWidth` 1 and `density` 0 as defaults. `false` leaves them apart.  |
| `rooms`     | none              | Rooms and templates: the options of [`placeMineRooms`](#placeminerooms).                                                                                                           |
| `exits`     | none              | Exits on the border: the options of [`openExits`](#openexits).                                                                                                                     |

The options of each step are in its section, with their defaults: [`digFishbone`](#digfishbone), [`digVeins`](#digveins), [`digPillarHalls`](#digpillarhalls), [`digRings`](#digrings), [`digNoiseCave`](#dignoisecave), [`digVeins`](#digveins), [`placeMineRooms`](#placeminerooms) and [`openExits`](#openexits). Every option is checked before anything is dug, and a `RangeError` is thrown for a non-positive or non-integer size, for more than one layout, and for a bad option of any step, as that step's section says.

### `MineResult`

| Field        | Meaning                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `grid`       | The map.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `passages`   | The tunnels of the layout in the order they were dug, the main shaft first, then the tunnels that join the rooms, as `MinePassage` objects: `kind` (`'shaft'` or `'adit'` for a fishbone, `'vein'` for veins and for the veins between halls, `'ring'` and `'spoke'` for rings, `'tunnel'` for a tunnel that joins a room), `width` and `tiles`, the tiles along the middle of the tunnel from where it starts to where it ends, each touching the one before along an edge. An adit starts at the tunnel it leaves, and a vein runs from one junction to another. The tunnels that join the caverns are not listed. |
| `rooms`      | The rooms, as [`Room`](#room) objects, with ids in this order: the halls of a `pillars` mine (kind `'pillarHall'`), then the caverns (kind `'cavern'`), then the rooms of `rooms` (kind `'room'`), templated ones first. A hall's box is the rectangle it was dug in and a cavern's the smallest one that holds its floor, so their corners may be wall; their exits are where the veins and tunnels enter them. Empty when the mine has none of them.                                                                                                                                                               |
| `roomShapes` | The shape of every room, by its id. A hall's or cavern's is its floor, as `Floor` cells, every other cell of its box `Unused`; see [`RoomShape`](#placeminerooms) for the rest.                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `roomGroups` | The [groups](#roomgroup) of the rooms: a `'pillarHalls'` group for the halls, and a `'cave'` group for each cavern.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `roomExits`  | The openings of the rooms, as [`Exit`](#exit) objects, with `door` saying whether each got a door, the places where a vein or a tunnel enters a hall or a cavern included. They are not the `exits` on the border.                                                                                                                                                                                                                                                                                                                                                                                                   |
| `exits`      | The door tiles on the map border, one per exit. Empty without `exits`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `attempts`   | How many times the mine was built, 1 or more: a map is built again when a step throws, up to 3 in all.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `failures`   | One entry per failed attempt, as for [`pipeline`](#pipeline), also when a later attempt succeeded.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |

## Dungeons

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

Prefabricated rooms are supported by both generators (see [Room templates](#room-templates)).

There are two dungeon generators, both ready-made compositions of [steps](#composing-maps) that take the options of each step under a key of its own. They differ in where the rooms go:

- `generateRoomDungeon` spreads its rooms over the whole map, in a scattered or a regular way (see [`RoomDungeonOptions`](#roomdungeonoptions)).
- [`generateDigDungeon`](#grown-dungeons) grows its rooms out of a first room in the middle, each beyond a wall of one there is, so they cluster and most corridors are short, as in a roguelike of old (see [`DigDungeonOptions`](#digdungeonoptions)).

`generateRoomDungeon` builds a dungeon room-first, on a map of rock:

1. [`placeScatteredRooms`](#placescatteredrooms), or [`placePartitionedRooms`](#placepartitionedrooms) with `partition`, places the templated rooms and then the ordinary rooms, without overlapping, either scattered at random or by binary space partitioning.
2. [`digCorridors`](#digcorridors) joins the rooms with corridors. Every room can be reached from every other one (see [Connections](#connections)). Rooms get the number of exits they ask for, and loops and dead ends are added if requested. Every opening in a room's wall becomes an _exit_, and each exit gets a door or stays a plain opening.

In both generators, when a step throws, which is what happens to a template that finds no place or cannot be joined, the map is built again from the start, up to 3 times in all; the result reports the `attempts` and the `failures`. For other compositions, such as rooms of both kinds in one map, rooms in part of a map, or rooms next to a cave, run the steps with [`pipeline`](#pipeline).

### `RoomDungeonOptions`

| Option            | Default       | Description                                                                                                                                                                                                             |
| ----------------- | ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `width`, `height` | required      | Map size in tiles.                                                                                                                                                                                                      |
| `random`          | `Math.random` | Source of randomness.                                                                                                                                                                                                   |
| `scatter`         | the defaults  | The rooms, tried at random spots: the options of [`placeScatteredRooms`](#placescatteredrooms). Used when `partition` is not given.                                                                                     |
| `partition`       | none          | The rooms, one in each part of a binary space partition: the options of [`placePartitionedRooms`](#placepartitionedrooms), in place of `scatter`. Giving both throws a `RangeError`.                                    |
| `corridors`       | the defaults  | The corridors and exits: the options of [`digCorridors`](#digcorridors). It takes nothing from the options of the rooms, so lattice or symmetric rooms want the same `placement`, `symmetry` and `symmetryChance` here. |

Every option is checked before anything is generated, and a bad one throws a `RangeError` that names it. The rooms take `area` and `count` too, but those leave most of the map empty in a dungeon of its own; they are meant for compositions.

### `DigDungeonOptions`

| Option            | Default       | Description                                                                                                                                                                                                             |
| ----------------- | ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `width`, `height` | required      | Map size in tiles.                                                                                                                                                                                                      |
| `random`          | `Math.random` | Source of randomness.                                                                                                                                                                                                   |
| `grow`            | the defaults  | The rooms, grown from a first room in the middle: the options of [`placeClusteredRooms`](#placeclusteredrooms).                                                                                                         |
| `corridors`       | the defaults  | The corridors and exits: the options of [`digCorridors`](#digcorridors). It takes nothing from the options of the rooms, so lattice or symmetric rooms want the same `placement`, `symmetry` and `symmetryChance` here. |

Every option is checked before anything is generated, and a bad one throws a `RangeError` that names it.

### `RoomDungeonResult`

The result of both generators: the fields of a [`DungeonResult`](#dungeonresult), plus:

| Field      | Description                                                                                                                             |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `attempts` | How many times the map was built, 1 or more.                                                                                            |
| `failures` | One entry per failed attempt, also when a later attempt succeeded: `{ attempt, step, error }`, as [`pipeline`](#pipeline) reports them. |

`exits` are the `roomExits` of [`digCorridors`](#digcorridors), and `fill` is worked out from the shapes of the rooms: the floor of every room, the doorways of templates included, over the map.

### Placement of rooms

Which rooms go where is decided by the step that places them: `scatter` or `partition` in the options of `generateRoomDungeon`, and `grow` in those of [`generateDigDungeon`](#grown-dungeons):

- `scatter` ([`placeScatteredRooms`](#placescatteredrooms), the default): random rooms are tried one after another, and any that would come too close to the map edge or to another room is discarded. Generation stops when the first of these happens:
  - `roomCount.max` rooms have been placed.
  - The `fill` target has been reached and at least `roomCount.min` rooms are placed.
  - The map is full: 100 rooms in a row failed to fit. In that case you can get fewer rooms than `roomCount.min` or a lower fill than requested.
- `partition` ([`placePartitionedRooms`](#placepartitionedrooms)): the map is cut in two again and again (binary space partitioning), and every area that results holds one room. The number of areas is estimated from `fill` and the typical room size, and kept within `roomCount`. If the rooms fall short of the target, the map is cut into more areas, a few times over. Rooms are placed inside their areas and separated by `roomSpacing`, so a partitioned dungeon looks more regular than a scattered one.

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

- `grow` ([`placeClusteredRooms`](#placeclusteredrooms)): each room is built beyond a wall of a room there is, a `gap` of corridor away, starting from a room in the middle. See [Grown dungeons](#grown-dungeons).

Rooms that turn out to be unreachable are dropped afterwards, see [Connections](#connections).

A room is always separated from the map edge by at least one wall tile. The minimum number of wall tiles between two rooms is set with `roomSpacing`. If a size range does not fit between the map edges, it is clamped to what fits. If not even the smallest room fits, no rooms are placed, and no error is thrown.

### `placement`

- `'free'` (default): a room can start on any tile and have any size within the ranges. Corridors can turn anywhere.
- `'lattice'`: ADOM-style. Rooms start on odd coordinates and have odd dimensions, so the whole dungeon sits on the same lattice as a [maze](#mazes): floors on odd coordinates, walls between them. Corridors run along the lattice and exits are on odd coordinates along the wall. This keeps exits apart and rules out awkward corners.

In `lattice` mode the size ranges are narrowed to odd numbers: `{ min: 4, max: 10 }` becomes 5 to 9. A range that holds no odd number, such as `{ min: 4, max: 4 }`, is rounded up to the next odd size (5). Likewise `roomSpacing` is rounded up to an odd number.

`placement` is an option of each step: lattice rooms (`scatter.placement`, `partition.placement` or `grow.placement`) want lattice corridors (`corridors.placement`) too.

### Connections

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

### Exits per room

Both generators honor `exitsPerRoom` (`corridors.exitsPerRoom`, like `loopChance` and `deadEndChance` below). It is a `Range`. Every room draws its own wanted number of exits from it, so `{ min: 1, max: 1 }` means one exit each, `{ min: 2, max: 4 }` means several and `{ min: 1, max: 3 }` (the default) is random with at least one.

- A room with fewer links than it wants gets extra links to its nearest neighbors, which makes loops.
- A room with more links than it wants uses its exits for several corridors: the extra corridors branch off the ones leaving through its exits, outside the wall.

This is best effort. A door shared with another room counts as an exit for both of them, and a room that cannot branch off anywhere, or has no neighbor to link to, gets one more exit or one fewer than wanted. Connectivity always takes priority.

### Loops

In both generators, after the rooms are connected, `loopChance` adds extra corridors between rooms that are connected already. Each room is considered with its three nearest neighbors, and every such pair that is not linked yet gets one roll. A loop is never made by crossing another corridor and respects `exitsPerRoom`, so it is only added where there is room for it. At 0 the corridors form a tree (with the odd exception where a corridor had to cross another); at 1 every pair of neighbors is linked where possible.

### Dead ends

In both generators, `deadEndChance` is the chance that a corridor sprouts a branch that leads nowhere, roughly 3 to 8 tiles long, from a random tile of the corridor. At 0, the default, there are no dead ends at all.

### Grown dungeons

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

1. [`placeClusteredRooms`](#placeclusteredrooms) places the templated rooms, the first of them in the middle of the map unless it has `positions` or `areas` of its own, and then grows the ordinary rooms off it, or off an ordinary room in the middle when there are no templates. Each new room goes beyond a wall of a room there is, a `gap` of corridor away (1 to 4 tiles by default) and facing it, until `fill` and `roomCount` are met or 300 tries in a row fail.
2. [`digCorridors`](#digcorridors) joins the rooms with corridors, nearest first, so most rooms are joined to the room they were built off by a short corridor, or by a door in the wall they share for a `gap` of 0.

It takes the options of each step under a key of its own (see [`DigDungeonOptions`](#digdungeonoptions)) and returns a [`RoomDungeonResult`](#roomdungeonresult), as `generateRoomDungeon` does. The templates other than the first are placed before growing starts, wherever they fit, and are joined by the corridors afterwards. Templated rooms count towards `roomCount` and `fill`.

### Symmetry

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

#### Layout symmetry

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

#### Corridor symmetry

`corridorSymmetry` is the `pattern` of [`digMaze`](#digmaze), applied to the direction of corridors. It steers corridors by where they are on the map:

- `snowflake` makes corridors radiate from the center. Where a tile is further from the center horizontally than vertically, corridors there run horizontally, and the other way round.
- `whirlpool` makes them twirl around the center, with the same rule turned by 90°.

`corridorSymmetryChance` is how often the pattern applies, instead of `horizontalBias` and `verticalBias`. `straight` limits the effect. Corridors are routed on a map where each tile has a preferred axis, chosen by the chance. Corridors prefer to follow it, as moving along the other axis costs more, but they still go wherever they have to.

Corridor symmetry does not make the layout symmetric.

### Doors

The generator never decides what a door looks like, it only tells you where doors can go.

- Every opening in a room's wall is an exit and is listed in `exits`, whether it has a door or not.
- `doorChance` decides which exits get a door. In the grid an exit with a door is `Tile.Door` and one without is `Tile.Floor`. `corridors.doorChance` decides for the exits that the corridors open, and the `doorChance` of the rooms for the `Exit` cells of templates.
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

### `DungeonResult`

The fields that every dungeon reports; the generators return a [`RoomDungeonResult`](#roomdungeonresult), which has them too.

| Field   | Description                                                                                                |
| ------- | ---------------------------------------------------------------------------------------------------------- |
| `grid`  | The map. Room and corridor floors are `Tile.Floor`, doors are `Tile.Door`, everything else is `Tile.Wall`. |
| `rooms` | The rooms, in the order they were placed. `rooms.length` is the total number of rooms.                     |
| `exits` | Every exit of every room, with or without a door. Filter on `door` for the doors alone.                    |
| `fill`  | The share of the map actually covered by room floors, from 0 to 1.                                         |

### `Room`

| Field             | Description                                                                                                                                                                                                                                                                                                                                                                                                  |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `id`              | The room's index in `rooms`.                                                                                                                                                                                                                                                                                                                                                                                 |
| `kind`            | What the room is (`RoomKind`): `'room'` for the rooms of every room placement step, templated rooms included, `'cell'` for a cell of [`placeCellBlocks`](#placecellblocks), `'guardRoom'` for a [guard room](#guard-rooms) of one, `'pillarHall'` for a hall of [`digPillarHalls`](#digpillarhalls) and `'cavern'` for a cavern of [`digCellularCave`](#digcellularcave) or [`digNoiseCave`](#dignoisecave). |
| `group`           | The index in `roomGroups` of the group the room belongs to, such as the cell block of a cell (see [`RoomGroup`](#roomgroup)). Absent for a room of no group.                                                                                                                                                                                                                                                 |
| `x`, `y`          | Position of the room's top-left floor tile. The room's wall is not included.                                                                                                                                                                                                                                                                                                                                 |
| `width`, `height` | Dimensions of the room's floor in tiles.                                                                                                                                                                                                                                                                                                                                                                     |
| `exits`           | Indices into `DungeonResult#exits` (or the `roomExits` of the other results and of the steps) of the room's exits. A hall's or cavern's are the places where a corridor, a vein or a tunnel enters it.                                                                                                                                                                                                       |
| `exitCount`       | Number of exits of the room.                                                                                                                                                                                                                                                                                                                                                                                 |
| `doorCount`       | Number of exits of the room that have a door.                                                                                                                                                                                                                                                                                                                                                                |
| `template`        | Templated rooms only: the index of the room's template in `templates`.                                                                                                                                                                                                                                                                                                                                       |
| `rotation`        | Templated rooms only: the clockwise rotation the template was placed in.                                                                                                                                                                                                                                                                                                                                     |
| `mirrored`        | Templated rooms only: whether the template was placed mirrored.                                                                                                                                                                                                                                                                                                                                              |

For a templated room, `x`, `y`, `width` and `height` describe the template's bounding box, walls included, as the floor of such a room need not be a rectangle. Ordinary rooms have no `template`, `rotation` or `mirrored`; whether a room is templated is told by `template`, not by `kind`.

**Halls and caverns are rooms too.** A hall of `digPillarHalls` and a cavern of the cave steps are listed in `rooms`, so the game finds every place of the map in one list, but the steps treat them as [features](#features), by their `kind`: they reserve nothing, their shape in `roomShapes` is their floor alone (the rest of the box `Unused`, with no potential exits), which blocks nothing, a later room placement step ignores it, [`digCorridors`](#digcorridors) joins them on their boundary like any other piece of floor and never drops them, and [`openMazeRooms`](#openmazerooms) leaves them alone. A hall's `x`, `y`, `width` and `height` are the rectangle it was dug in, and a cavern's the smallest rectangle that holds its floor, so either may have wall in its corners, and the pillars of a hall are rock inside it.

#### Ways into halls and caverns

A hall or a cavern has no walls of its own to open, so the joining steps record where they reach its floor: every tile that [`digCorridors`](#digcorridors), [`digVeins`](#digveins) or [`placeMineRooms`](#placeminerooms) digs beside the floor of a hall or a cavern is a way into it, and the tiles of one way that touch along an edge are one [`Exit`](#exit), at their middle tile, so a vein two tiles wide makes one exit. A tile that is the exit of a room too, or that touches the floor of two halls or caverns, is one exit of both. `digVeins` records its ways into every other room the same way: the `Openable` tile it opens. Floor that a hall or a cavern was dug into, or that a later step digs right up to it, is no exit, since no joining step dug it.

### `RoomGroup`

Rooms that one copy of a step built together form a group, listed in the `roomGroups` extra, and each of them points to its group with `Room.group`. Groups never move, so `group` stays right when `digCorridors` drops and renumbers rooms. A group says what it is in `kind`: `'cellBlock'`, `'cave'` or `'pillarHalls'`.

A `'cellBlock'` group (`CellBlockGroup`) is a block of [`placeCellBlocks`](#placecellblocks):

| Field       | Description                                                                                                                                                                                                         |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `kind`      | `'cellBlock'`.                                                                                                                                                                                                      |
| `footprint` | The box of the block's cells and corridor, its outer walls included. A guard room and its tunnel lie outside it.                                                                                                    |
| `corridor`  | The floor of the block corridor, which the doors of the cells open onto.                                                                                                                                            |
| `entrance`  | The wall tile through which the block is entered, at an end of the corridor, beyond the tunnel, or in the far wall of a guard room the block is entered through, a door or a gap once a joining step has opened it. |
| `tunnel`    | The floor of the tunnel from the end of the corridor past the guard room's door to the entrance. Absent without a guard room beside the block.                                                                      |

Two blocks themed differently, one for prisoners and one for monsters, say, are told apart by their groups.

A `'cave'` group (`CaveGroup`) is one cave of [`digCellularCave`](#digcellularcave) or [`digNoiseCave`](#dignoisecave), in one area, and its rooms are its caverns. A `'pillarHalls'` group (`PillarHallsGroup`) is the halls that [`digPillarHalls`](#digpillarhalls) dug in one area. Both have one more field, `area`: the box the cave or the halls were dug in, in the coordinates of the map. A cave or an area that got no floor makes no group.

### `Exit`

| Field      | Description                                                                                                                |
| ---------- | -------------------------------------------------------------------------------------------------------------------------- |
| `position` | The wall tile of the gap, as a `Point`.                                                                                    |
| `rooms`    | Ids of the rooms the exit belongs to: one, or two when a single door joins two rooms that face each other across one wall. |
| `door`     | Whether a door was placed.                                                                                                 |

For a hall or a cavern, `position` is the first tile dug beside its floor (see [ways into halls and caverns](#ways-into-halls-and-caverns)), and `rooms` may list two halls or caverns that a single tile joins, or a room and the hall or cavern its exit opens onto.

### `createRoomMap`

`createRoomMap(result)` tells which room each tile of a finished map belongs to: an `Int32Array` with one number per tile, row by row (`y * width + x`), the id of the room whose floor holds it, or -1. It takes anything with a `grid` and `roomShapes`, the result of a generator or of [`pipeline`](#pipeline). Every room counts, of every kind, through the `Floor` cells of its shape: an ordinary room's floor, a templated room's floor cells, a hall's floor without its pillars, a cavern's floor. Walls, exits and doors belong to no room, since an exit may belong to two, and neither do corridors, veins, tunnels or any floor outside the rooms.

```ts
const result = pipeline(
  emptyMap({ width: 80, height: 50, tile: Tile.Wall }),
  [digPillarHalls(), placeScatteredRooms(), digCorridors()],
  { random: mulberry32(42) },
);
const roomMap = createRoomMap(result);
const id = roomMap[player.y * result.grid.width + player.x] ?? -1;
const room = result.rooms[id]; // undefined in a corridor
```

### Room templates

Pass templates to either generator in the `templates` option of its rooms (`scatter.templates` or `partition.templates` in `generateRoomDungeon`, `grow.templates` in `generateDigDungeon`). A `RoomTemplate` is a player-made room: a rectangular design that is placed in a dungeon as it is, with the corridors dug around it. The design is a grid of `TemplateCell` values, written as rows:

```ts
import { TemplateCell, type RoomTemplate } from 'angstloch';

const { Unused: _, Floor: F, Wall: W, Exit: E } = TemplateCell;

const cross: RoomTemplate = {
  name: 'cross',
  cells: [
    [_, W, E, W, _],
    [W, W, F, W, W],
    [E, F, F, F, E],
    [W, W, F, W, W],
    [_, W, E, W, _],
  ],
};
```

| `TemplateCell` | Value | Meaning                                                                                                        |
| -------------- | ----- | -------------------------------------------------------------------------------------------------------------- |
| `Unused`       | 0     | Not part of the room. Corridors and other rooms may use the space, and the map is left untouched there.        |
| `Floor`        | 1     | Becomes `Tile.Floor`.                                                                                          |
| `Wall`         | 2     | Becomes `Tile.Wall` and is protected: nothing is dug through it and it never gets an exit.                     |
| `Exit`         | 3     | A connection point. Becomes `Tile.Floor`, or `Tile.Door` according to `doorChance`.                            |
| `Door`         | 4     | A connection point that always becomes `Tile.Door`.                                                            |
| `OptionalExit` | 5     | A wall that may be opened into an exit, as `Exit` is, when the room needs one. Elsewhere it stays `Tile.Wall`. |

The values are part of the public contract: kinds may be added, but existing values never change.

A template is valid if:

- it has at least one row, and all rows are equally long;
- at least one `Exit`, `Door` or `OptionalExit` cell has an orthogonal neighbor that is `Unused` or beyond the template's edge (an _exit candidate_, where a corridor can start; every `Exit` and `Door` candidate gets connected, while `OptionalExit` candidates are opened only as far as `exitsPerRoom` asks, and a cell of these kinds without an outside neighbor is just an internal door);
- open cells (`Floor`, `Exit`, `Door`, `OptionalExit`) are walled in: none of their eight neighbors, diagonals included, is `Unused` or beyond the template's edge, except on the outward side of an exit candidate. Diagonal moves are common in games, so this keeps a corridor from touching a floor diagonally, and keeps a door from being sidestepped;
- `count`, `rotate`, `positionAccuracy` and `positions` follow the table below.

A forest takes templates without exits instead, and has its own rules, see [Templates in forests](#templates-in-forests).

An invalid template throws a `RangeError` that names the template.

| Field              | Default   | Description                                                                                                                                     |
| ------------------ | --------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `cells`            | required  | The design, as rows of `TemplateCell` values.                                                                                                   |
| `name`             | none      | Names the template in error messages.                                                                                                           |
| `count`            | exactly 1 | Number of copies to place, a `Range` of at least 0.                                                                                             |
| `rotate`           | `[0]`     | Clockwise rotations the template may be placed in, any of `0`, `90`, `180` and `270`. Each is controlled separately; the default never rotates. |
| `mirror`           | `false`   | Whether the template may also be placed mirrored left to right.                                                                                 |
| `positions`        | none      | Acceptable targets, see below. One is picked at random per copy; copies beyond the list are placed at random.                                   |
| `areas`            | none      | Rectangles of the map, `{ x, y, width, height }`, to place copies in, see below. Used for copies that have no position.                         |
| `positionAccuracy` | `1`       | How exactly positions are honored, from 0 to 1: 1 is exact if possible, in between allows some variance, 0 ignores positions.                   |
| `clearing`         | `false`   | Forests only: whether the template needs a clearing, see [Templates in forests](#templates-in-forests).                                         |
| `chance`           | 1         | Forests only: the chance that each copy is placed, from 0 to 1.                                                                                 |
| `margin`           | 0         | Forests only: how far the trees thin out beyond the box of a template with a clearing of its own, in tiles.                                     |

A `Position` is `{ coords, anchor, rotations? }`. `anchor` says which point of the placed room's bounding box lands on `coords`: `'center'`, `'top'`, `'bottom'`, `'left'`, `'right'`, `'top-left'`, `'top-right'`, `'bottom-left'` or `'bottom-right'`. The anchor describes the room as it ends up on the map, so it does not rotate with the template. `rotations` limits the rotations allowed at that position, for example a door in the template's bottom wall and a `'bottom'` anchor call for `[90, 180, 270]`. The rotations used at a position are those in both `rotations` and the template's `rotate`; having none in common is an error.

Mirroring and rotating produce the template's _variants_. Variants that look alike, such as a symmetric room turned by 180°, count once, so symmetric rooms are not favored when a variant is picked at random.

#### Where templates go

Placement is best effort, but never silent. For each copy of a template:

1. One of the template's `positions` is picked at random; every position is used by one copy. Copies beyond the list go into the template's `areas`, see below, or are placed at random if it has none. A copy without a position, and every copy of a template with a `positionAccuracy` of 0, goes to a random free spot.
2. The target is the position's `coords`, with the anchor of the room's bounding box on it (an even box has its center rounded down). Below an accuracy of 1 the target is moved by up to `(1 - positionAccuracy)` times half the shorter map side in each direction.
3. If the target is not valid, the nearest valid spot is used instead. Every allowed variant is considered, so a variant that fits better than the first one can win.

`areas` say where copies without a position go, when you care about the region and not the exact spot, for example near the sides of the map: give a strip on each side. A copy picks one of the areas at random and is placed at a random valid spot inside it, in any allowed variant. The copy's whole bounding box must lie inside the area. If the picked area has no room for it, the other areas are tried, and if none has, placing throws a `TemplatePlacementError`: a template with areas is never placed outside them. An area must be a rectangle of whole numbers, at least 1 by 1, within the map, and at least one allowed variant must fit in at least one area, or the template is rejected with a `RangeError` before anything is generated. `positionAccuracy` only applies to positions. With `templateSymmetry`, a copy is only placed where its mirror images fit too, but they need not lie inside an area. [`placeClusteredRooms`](#placeclusteredrooms) puts the first template in the middle of the map unless it has `positions` or `areas`.

A spot is valid if the room's footprint, which is every cell but the `Unused` ones and so includes the template's walls, lies within the map and keeps its distance from other rooms' footprints, and if the exits have room. Distance works like this:

- With a `roomSpacing` of 1, as for ordinary rooms, templates may touch and **share walls**. Two cells may sit on the same tile only if both are walls (an `OptionalExit` counts as a wall where it is not opened), or if both are an `Exit` or a `Door` that line up as a doorway: they leave in opposite directions, with the floor of one room on each side. Anything else on the same tile, such as a floor on a wall or a doorway on a wall, is a collision. A doorway that two templates share is a single exit of both rooms, listed once in `exits` with both room ids, and it needs no corridor. Spots that touch no other room are preferred when a copy is placed at random; a copy with a position is placed exactly there if it is valid, shared walls or not.
- With a `roomSpacing` of 2 or more, footprints must be more than `roomSpacing` tiles apart, and nothing is shared.

Exits need room as well: every `Exit` and `Door` needs either a shared doorway or a free tile outside it to start a corridor from, one tile or more away from the map edge, and at least one exit candidate of any kind needs that free tile, so that every templated room can reach out on its own. Templates may sit in each other's bounding boxes as long as their footprints keep to these rules.

On the lattice (`placement: 'lattice'`) a template's bounding box sits on even coordinates, so that walls fall on even tiles and floors on odd ones, and only variants with an odd width and height are used. Variants that do not fit the lattice are not used.

#### In a dungeon

`generateRoomDungeon` places the templates before anything else, in the order of the list, and carves them as they are. ([`generateDigDungeon`](#grown-dungeons) does the same, and grows the ordinary rooms from the first one.) The ordinary rooms are placed afterwards around them, at least `roomSpacing` tiles from a template's footprint and leaving the tile in front of each of its exits free, and corridors never cut through a template's walls. The templated rooms come first in `rooms`, copies of a template together, and are described by `template`, `rotation` and `mirrored`.

```ts
import { generateRoomDungeon } from 'angstloch';

const { grid, rooms } = generateRoomDungeon({
  width: 61,
  height: 31,
  scatter: {
    templates: [
      { ...cross, positions: [{ coords: { x: 30, y: 15 }, anchor: 'center' }] },
    ],
  },
});
```

- A templated room counts towards `roomCount`, and its floor, doors included, towards `fill`. The `fill` of the result includes it.
- Every `Exit` and `Door` cell that leads outside is opened and joined to the rest of the dungeon by a corridor, whatever `exitsPerRoom` says. Those exits count towards the room's `exitsPerRoom`, so a room with more fixed exits than the range asks for simply has more.
- `OptionalExit` cells are opened only as far as `exitsPerRoom` asks for more exits, and only where a corridor can start. If a template has no more exits than its fixed ones, it gets no others.
- `Exit` cells become doors by `doorChance` (that of the rooms in `generateRoomDungeon`), and `Door` cells always do. They are listed in `exits`, and `Exit` and `Door` cells inside the template, which lead nowhere, are tiles only: they are not listed, and the same `doorChance` applies to the `Exit` ones.
- Every exit has a corridor tile in front of it and corridors keep the usual distance from one another, so a door cannot be sidestepped and corridors cannot be crossed diagonally.
- With `templateSymmetry` set and a `symmetry` of the rooms other than `none`, every copy of a template brings its mirror images along, always and whatever `symmetryChance` is. An image is the geometric image of the copy, whatever `rotate` and `mirror` allow, and `rotation` and `mirrored` describe it accordingly. A copy is only placed where its images fit too, and an image that equals the copy (a centered, symmetric template) is not added. Without `templateSymmetry`, a template is placed once per copy, even with a symmetric layout. `templateSymmetry` has no effect without a layout symmetry.
- The corridor rules can occasionally box in the fixed exit of a template. `digCorridors` then routes the corridors again, up to three times in all. If it still fails, the templates are placed again and the dungeon is built again, up to three times in all, before giving up with a `TemplatePlacementError`.

With `placement: 'lattice'`, a template that cannot sit on the lattice is rejected before anything is generated, with a `RangeError` that names it: at least one of its variants must have an odd width and height, every `Exit` and `Door` that leads outside must face a tile with odd coordinates, which is where corridors start, and so must at least one exit candidate of any kind. Design lattice templates with their walls on even and their floors on odd rows and columns of the template, and exits on the walls at odd positions along them. An example is a 3x3 template with a floor in the middle and one exit in the top wall.

A template is never skipped silently, since a map may need it (a boss arena, a scripted ruin). When a template finds no place in a dungeon, a mine, a maze or a forest, a new map is generated, up to three in all, and only then a `TemplatePlacementError` is thrown: at that point the input is at fault and not the map, as every attempt failed. Errors that no other map could fix, such as a template bigger than the map or one that fits no lattice, are thrown at once. Its message says which template (by `name` and index) and why, and its `templateIndex` and `templateName` fields carry the same. A template that cannot be joined to the rest of the dungeon throws the same error.

## Composing maps

A map can be composed from an empty base and a list of steps, like middleware, instead of one generator with many options. `pipeline` runs the steps in order, merges what each reports into the map state, and builds the map again from the start when a step throws. Every generator of this library is a preset, a ready-made composition of the steps listed under [Steps at a glance](#steps-at-a-glance): [`generateForest`](#forests), [`generateCave`](#caves), [`generateNoiseCave`](#noise-caves), [`generateMine`](#mines), [`generateMaze`](#mazes), [`generateRoomDungeon`](#dungeons) and [`generateDigDungeon`](#grown-dungeons). Each preset passes its keys straight to its steps, so whatever a preset makes, a pipeline of the same steps with the same options makes too, and steps of different generators mix in one map (rooms round a cavern, a mine with a maze in a corner). You can write steps of your own, and the machinery is the same.

```ts
import { Tile, emptyMap, pipeline, stampTile, step } from 'angstloch';

// a step is a named function: it changes the map and returns the extras it adds
const scatter = step<object, { scattered: number }>(
  'scatter',
  { adds: ['scattered'] },
  ({ grid, base, prunable }, { random }) => {
    let scattered = 0;
    for (let y = 0; y < grid.height; ++y) {
      for (let x = 0; x < grid.width; ++x) {
        if (grid.get(x, y) === base && random() < 0.2) {
          grid.set(x, y, Tile.Tree);
          prunable[y * grid.width + x] = 1;
          ++scattered;
        }
      }
    }
    return { scattered };
  },
);

// this one needs the extra of the first, so it must come after it
const fence = step<{ scattered: number }, object>(
  'fence',
  { needs: ['scattered'] },
  (state) => {
    for (let x = 0; x < state.grid.width; ++x) {
      stampTile(state, x, 0, Tile.Road);
    }
    return {};
  },
);

const { grid, scattered, attempts, failures } = pipeline(
  emptyMap({ width: 80, height: 50, tile: Tile.Grass }),
  [scatter, fence],
  { random: mulberry32(42) },
);
```

### Steps at a glance

Every ready-made step, grouped by the map it was made for, though any of them may go in any pipeline. **Needs** are the extras that an earlier step must have added, which `pipeline` checks before the first attempt; **adds** are the extras it reports (an extra that is there already is appended to, or replaced, as the step's section says). **Rock** marks the steps that dig out of rock and need a map that starts as wall. **Area** marks the steps that take an [`area`](#areas), and **count** those that also take a number of copies.

| Step                                              | What it does                                                    | Needs                 | Adds                                             | Rock | Area, count |
| ------------------------------------------------- | --------------------------------------------------------------- | --------------------- | ------------------------------------------------ | ---- | ----------- |
| [`plantTrees`](#planttrees)                       | plants trees by noise on the base tile                          |                       |                                                  |      |             |
| [`layStreams`](#laystreams)                       | lays streams and rivers, with banks and tributaries             |                       | `streams`                                        |      |             |
| [`layRoads`](#layroads)                           | lays roads, with crossings, branches and bridges over streams   |                       | `roads`, `junctions`, `exits`, `bridges`         |      |             |
| [`placeClearings`](#placeclearings)               | clears ragged glades                                            |                       | `clearings`                                      |      |             |
| [`placeTemplates`](#placetemplates)               | stamps templates in clearings or on free spots                  |                       | `templates`                                      |      |             |
| [`layClearingPaths`](#layclearingpaths)           | lays paths from the roads to the clearings that ask for one     | `clearings`           | `roads`, `junctions`, `exits`, `bridges`         |      |             |
| [`layFootbridges`](#layfootbridges)               | joins the land that streams cut apart                           | `streams`             | `bridges`                                        |      |             |
| [`digFishbone`](#digfishbone)                     | a main shaft with adits off it                                  |                       | `passages`                                       | yes  | area, count |
| [`digVeins`](#digveins)                           | veins that join every piece of floor, and a web of their own    |                       | `passages`, `rooms`, `roomExits`                 | yes  |             |
| [`digPillarHalls`](#digpillarhalls)               | halls with pillars                                              |                       | `rooms`, `roomShapes`, `roomGroups`              | yes  | area, count |
| [`digRings`](#digrings)                           | rings joined by spokes                                          |                       | `passages`                                       | yes  | area, count |
| [`placeMineRooms`](#placeminerooms)               | rooms in the rock, each joined to the nearest floor by a tunnel |                       | `passages`, `rooms`, `roomExits`, `roomShapes`   | yes  |             |
| [`digCellularCave`](#digcellularcave)             | a cave from a cellular automaton                                |                       | `rooms`, `roomShapes`, `roomGroups`              | yes  | area, count |
| [`digNoiseCave`](#dignoisecave)                   | a cave from thresholded noise                                   |                       | `rooms`, `roomShapes`, `roomGroups`              | yes  | area, count |
| [`placeMazeRooms`](#placemazerooms)               | rooms on the maze lattice, not opened yet                       |                       | `rooms`, `roomShapes`                            | yes  | area        |
| [`digMaze`](#digmaze)                             | a maze by the recursive backtracker, round whatever is there    |                       | `start`                                          | yes  | area, count |
| [`openMazeRooms`](#openmazerooms)                 | opens the maze rooms into the maze                              | `rooms`, `roomShapes` | `rooms`, `roomExits`                             |      |             |
| [`placeScatteredRooms`](#placescatteredrooms)     | dungeon rooms at random spots                                   |                       | `rooms`, `roomShapes`                            | yes  | area, count |
| [`placePartitionedRooms`](#placepartitionedrooms) | one dungeon room per area of a binary space partition           |                       | `rooms`, `roomShapes`                            | yes  | area, count |
| [`placeClusteredRooms`](#placeclusteredrooms)     | dungeon rooms grown off each other, clustered                   |                       | `rooms`, `roomShapes`                            | yes  | area, count |
| [`placeCellBlocks`](#placecellblocks)             | cell blocks of a prison, entered at one end                     |                       | `rooms`, `roomShapes`, `roomExits`, `roomGroups` | yes  | area, count |
| [`digCorridors`](#digcorridors)                   | joins the rooms, and every other piece of floor, by corridors   | `rooms`, `roomShapes` | `rooms`, `roomShapes`, `roomExits`               | yes  |             |
| [`openExits`](#openexits)                         | carves exits into the border                                    |                       | `exits`                                          |      |             |

The presets are these steps in this order: a forest is `plantTrees`, then the outdoor steps it is given; a cave is `digCellularCave` or `digNoiseCave`, `digVeins` and `openExits`; a mine is one layout step, then `digNoiseCave` and `digVeins` for caverns, `placeMineRooms` and `openExits`; a maze is `placeMazeRooms`, `digMaze`, `openMazeRooms` and `openExits`; a room-first dungeon is `placeScatteredRooms` or `placePartitionedRooms`, then `digCorridors`; a grown dungeon is `placeClusteredRooms`, then `digCorridors`. The building blocks for steps of your own are [`MapState`](#mapstate) and its helpers, [`pruneVerge`](#verges-and-pruneverge) and [areas](#areas).

### `emptyMap`

`emptyMap({ width, height, tile })` is the start of a pipeline: a map of one tile, grass for a forest and a wall for a dungeon or a mine. The dimensions and the tile are checked at once, and a bad one throws a `RangeError`. It returns a factory (`MapBase`, a function that returns a `MapState`), so that every attempt starts from a fresh state. Any function that returns a state works in its place.

### `MapState`

The map while it is built: `{ grid, base, prunable, reserved, ...extras }`.

- `grid` is the `Grid`.
- `base` is the tile the map started as. A tile that still holds it is untouched ground.
- `prunable` is a `Uint8Array` with a byte per tile, row by row: 1 where the tile is ground cover that a later step may remove (a tree), 0 elsewhere. A step that lays something down clears the byte of its tiles, so that a later step does not take a wall or a road for ground cover. `stampTile(state, x, y, tile)` sets a tile and clears its byte in one go, and throws a `RangeError` outside the grid.
- `reserved` is a `Uint8Array` with a byte per tile, row by row, holding a `Reserve` value. `Reserve.None` (0) is a tile that a step may build on, `Reserve.Solid` (1) is one that no step digs through, such as the wall and floor of a room or a template, and `Reserve.Openable` (2) is also never dug through but may be opened as an exit, which is what a room's potential exits are. A room needs this because its wall is `Tile.Wall`, just like the rock round it. `emptyMap` starts it all `None`, and `stampTile` leaves it alone. The values are part of the contract: new ones may be added, existing ones never change.
- The extras are what the steps return: `streams`, `roads`, and so on.

`reserveTile(state, x, y, kind)` sets the byte of a tile, and throws a `RangeError` outside the grid. `openReserved(state, x, y)` records that an exit was opened on a tile: the tile and every `Openable` tile around it, diagonals included, become `Solid`, so that no two exits end up side by side.

`findNearestOpenable(state, from, { blocked?, accepts? })` finds the `Openable` tile nearest to any of the points `from`, such as the potential exit of a room that a step knows nothing about, by a breadth-first search over the tiles that are `Reserve.None` and not marked by `blocked` (a byte per tile, 1 to keep out). It returns `{ openable, outside, direction, start }`: the tile, the free tile next to it that the search reached it from, the way from the tile to that one (an index into north, east, south, west), and the index into `from` of the start it came from; or `undefined` when there is none to reach. `accepts(openable, direction)` can turn a tile down, and the search goes on past it.

**The free rule.** `isFree(state, x, y)` says whether a step may build on a tile: it holds the base tile or is prunable (untouched ground or ground cover), and it is `Reserve.None`. A tile outside the grid is not free. `placeTemplates` and `layClearingPaths` use it, and `placeTemplates` reserves the cells it stamps as `Solid`, so that a step that comes later and digs, such as a mine or a corridor step, leaves a ruin whole.

### `step`

`step(name, spec, run)` makes a `MapStep`. `run(state, context)` changes `state.grid`, `state.prunable` and `state.reserved` in place and returns the extras the step adds, which the pipeline merges into the state (a later extra replaces an earlier one of the same name). It never mutates anything else.

The type parameters are `step<Needs, Adds>`: `Needs` is what the state must hold, and `Adds` is what `run` returns. The `spec` lists the same extras by name, for run-time checks: `needs` the required ones (leave out an extra that the step only uses when it is there, which you type as `Partial<...>`), and `adds` the ones it returns. A step with none says `{}`.

A step can also have a `validate(state)` in its `spec`, for what only the map can tell, such as its size. `pipeline` calls it once with a fresh base state before the first attempt, and whatever it throws, a `RangeError` for a bad option, is thrown at once and never retried.

The context has `random`, the source of randomness, and `trace`, an optional function that receives the step's internal data for diagnostics, as `trace?.(name, data)`.

A step can also be called by hand, as `mapStep(state, context?)`. The context is optional then, and `random` defaults to `Math.random`. A step whose needs are not in the state throws a `TypeError` that names the step and the extra. Its `stepName`, `needs` and `adds` are readable properties.

### `pipeline`

`pipeline(base, steps, options?)` returns the final state with the extras of every step, plus `attempts` and `failures`.

| Option     | Default       | Meaning                                                                                                        |
| ---------- | ------------- | -------------------------------------------------------------------------------------------------------------- |
| `random`   | `Math.random` | The source of randomness, shared by all steps. A retry goes on with it and does not rewind it.                 |
| `attempts` | 3             | How many times the map is built from the start when a step throws. An integer of at least 1.                   |
| `onStep`   |               | `(name, state) => void`, called after every step. The state is the live one, so clone the grid if you keep it. |
| `trace`    |               | `(name, data) => void`, which receives what steps report through the `trace` of their context.                 |

- **Order.** Written as a literal list, the steps are checked at compile time: a step that needs an extra that no earlier step adds does not compile, and the error names the extra (`StepOrderError<"scattered">`). Before the first attempt the same check runs at run time, for callers without types, and a step that comes too early throws a `TypeError` that names it and the missing extra. An extra that a step only uses when it is there never fails the check.
- **Retries.** When a step throws, the pipeline records the failure and builds the map again from a fresh base, up to `attempts` times in all. After the last attempt the last error is thrown. An error with `permanent` set to `true`, such as a `TemplatePlacementError` that no other map could fix, is thrown at once. A `RangeError` for a bad option of the pipeline itself, and anything a step's `validate` throws, is thrown before any attempt.
- **`failures`** has one entry per failed attempt, also when a later attempt succeeded: `{ attempt, step, error }`, with the attempt counted from 1 and the name of the step that threw.
- **Same seed, same pipeline.** All steps draw from one `Random` in order, so a seed gives the same map only for the same list of steps.

### `plantTrees`

`plantTrees(options?)` is a step that plants ground cover. Noise decides how thick it is, and every tile that still holds the base tile gets the planted tile with that chance. Planted tiles are marked prunable, so a later step can clear a verge round what it lays. It adds no extras. Run it first: it plants only on untouched base tiles, so a step that runs before it gets no verge. Every option is checked when the step is made, and a bad one throws a `RangeError` at once.

It is general ground cover and not only trees: `tile` takes any `Tile` value, on any base. Rocks on dirt for a steppe are `emptyMap({ ..., tile: Tile.Floor })` with `plantTrees({ tile: Tile.Wall, density: { min: 0, max: 0.05 } })`. What a tile value looks like is up to your game, which maps the values to whatever it draws.

```ts
const { grid } = pipeline(
  emptyMap({ width: 80, height: 50, tile: Tile.Grass }),
  [plantTrees({ scaleX: 40, density: { min: 0, max: 0.25 } })],
  { random: mulberry32(42) },
);
```

| Option             | Default                 | Meaning                                                                                                                                                                                                                                                             |
| ------------------ | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `scaleX`, `scaleY` | 40                      | Size in tiles of a feature of the density noise along each axis, before rotation. Larger values make broader woods and glades.                                                                                                                                      |
| `rotation`         | 0                       | Clockwise rotation of the noise in degrees, which makes stretched woods run diagonally.                                                                                                                                                                             |
| `octaves`          | 1                       | Layers of the built-in noise, each finer than the one before. With 1, `persistence` and `lacunarity` have no effect.                                                                                                                                                |
| `persistence`      | 0.2                     | How much each layer counts against the one before it, from 0 to 1.                                                                                                                                                                                                  |
| `lacunarity`       | 1                       | How much finer each layer is than the one before it. 1 puts every layer at the same zoom.                                                                                                                                                                           |
| `noise`            | built-in simplex        | Your own [`NoiseFunction`](#noise) instead. The scales and the rotation apply to it, but the octave options do not, so wrap it in `createFractalNoise` for layers.                                                                                                  |
| `density`          | `{ min: 0, max: 0.25 }` | The chance of planting a tile, as fractions from 0 to 1 (unlike other ranges, which are whole numbers): `min` where the noise is lowest, rising to `max` where it is highest. The default leaves the lowest parts bare and makes the thickest woods a quarter full. |
| `tile`             | `Tile.Tree`             | The tile to plant.                                                                                                                                                                                                                                                  |

The step draws one random number for every base tile, and the built-in noise is seeded from the same `random`.

### Verges and `pruneVerge`

A verge is the strip beside a feature that is kept clear of ground cover. Steps that lay a feature (`layStreams`, `layRoads`, `placeClearings`, `placeTemplates` and `layClearingPaths`) take the three fields of a `Verge` among their options, and you can use the same code in a step of your own: `pruneVerge(state, mask, verge, random)`, where `mask` is a `Uint8Array` with a byte per tile, 1 where the feature is.

| Field       | Default       | Meaning                                                                                                                                                                                                                          |
| ----------- | ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `clearance` | 0             | Whole tiles beside the feature with no ground cover at all. Tiles count in any direction, so 1 clears all eight neighbors, diagonals included.                                                                                   |
| `falloff`   | 0             | Whole tiles beyond the clearance over which the cover thickens from none to full, in equal steps: with 3, the first tile keeps a quarter of its cover, the next half, the next three quarters, and the one after that all of it. |
| `distance`  | `'chebyshev'` | How the distance to the feature is measured: `'chebyshev'` makes square verges, `'manhattan'` diamonds and `'euclidean'` round ones.                                                                                             |

`pruneVerge` touches prunable tiles only: a tile it removes goes back to the base tile and stops being prunable, and everything else, such as a road or a wall stamped by another step, is left alone. A tile in the falloff is removed with the chance that the ramp gives, so a tree planted with chance `p` ends up with `p` times the share kept. Verges from several steps add up, so where two overlap, slightly more is pruned than either alone. In a map with nothing prunable (a dungeon) it does nothing.

### `layStreams`

`layStreams(options?)` is a step that lays a stream or a river across the map: a main stream from one border to the opposite one (or from a spring), with shallow banks, deep water in the middle when it is wide enough, and optional tributaries. It paints over whatever is there, so it does not matter whether it runs before or after `plantTrees`, but only a `plantTrees` that ran before it lets it clear trees. A stream is a road made of water, so most options work like those of a [road](#roads) and are described in [Streams and rivers](#streams-and-rivers); the same fields are accepted here, apart from the bridges, which belong to the steps that lay them (`bridges` and `bridgeAngle` are not options of this step).

```ts
const { grid, streams } = pipeline(
  emptyMap({ width: 80, height: 50, tile: Tile.Grass }),
  [
    plantTrees(),
    layStreams({
      width: { min: 2, max: 3 },
      tributaries: { min: 1, max: 2 },
      clearance: 1,
      falloff: 3,
    }),
  ],
  { random: mulberry32(42) },
);
```

- **Options.** `angle`, `spring`, `width`, `windiness`, `shoreWidth`, `tributaries`, `tributaryWidth`, `tributaryAngle` and `tributaryLength` as in [Streams and rivers](#streams-and-rivers) with the same defaults; `shallowTile` (default `Tile.ShallowWater`) and `deepTile` (default `Tile.DeepWater`); and the verge kept clear of trees beside the water, `clearance`, `falloff` and `distance` ([see above](#verges-and-pruneverge)), which default to 0, 0 and `'chebyshev'`, so trees grow right up to the water. The verge replaces `bankClearance` and `bankFalloff` of the forest. Every option is checked when the step is made.
- **Adds `streams`**: an array of roads, `{ kind, width, points }`, the main stream first and then the tributaries. The `points` run with the water: a tributary runs from its source to where it joins. Later steps (roads that cross the stream, footbridges, clearings on the water) work from this list alone.
- **Water tiles** are stamped over what is there, so they are not prunable, and the trees are cleared beside them by the verge.
- **Order.** It must come before the steps that lay roads, so that the roads can cross it. With `roads` already in the state it throws a `TypeError` at once, without retrying, since no other map would help.

### `layRoads`

`layRoads(options?)` is a step that lays roads: a main road from one border to the opposite one, with the crossings and branches that [`RoadOptions`](#roads) ask for, or the exact `specs`. It paints road tiles over whatever is there and then clears the trees of its verge. Every option is checked when the step is made, and a bad one throws a `RangeError` at once.

```ts
const { grid, roads, bridges } = pipeline(
  emptyMap({ width: 80, height: 50, tile: Tile.Grass }),
  [
    plantTrees(),
    layStreams({ width: { min: 2, max: 3 }, tributaries: { min: 1, max: 1 } }),
    layRoads({
      width: { min: 3, max: 3 },
      crossings: { min: 1, max: 1 },
      clearance: 1,
      falloff: 2,
    }),
  ],
  { random: mulberry32(42) },
);
```

- **Options.** All the fields of the roads described under [Roads](#roads) (`angle`, `width`, `windiness`, `crossings`, `crossingAngle`, `branches`, `branchWidth`, `branchAngle`, `branchLength` and `specs`), with the same defaults, plus `roadTile` (default `Tile.Road`), `bridgeTile` (default `Tile.Bridge`), `bridgeAngle` (a `Range` of whole degrees from 1 to 179, default `{ min: 75, max: 90 }`, see below) and the verge, `clearance`, `falloff` and `distance` ([see above](#verges-and-pruneverge)), which default to 0, 0 and `'chebyshev'`. The verge replaces `clearance`, `falloff` and `distance` of the forest.
- **Adds** `roads` (`{ kind, width, points }` for every road, crossing and branch, in the order they were laid), `junctions` (the tiles where roads meet), `exits` (the tiles where roads reach the border) and `bridges` (one point per group of bridge tiles).
- **Streams.** When the state has `streams` (an `layStreams` step ran before), a generated road is planned across them: it is bent to cross at `bridgeAngle`, straight and square to the stream for the length of the bridge, and a road tile over water becomes `bridgeTile` along that straight run. A road tile over water that is no part of a crossing gives way to the water: a road that clips a bank, or runs along a stream, does not make a bridge. The roads of `specs` are not bent. They are bridged where they span the water. Without `streams` the step works on dry land, and `bridgeAngle` has no effect.
- **Order.** `layStreams` must come before it. Put `plantTrees` first, so that the verge has trees to clear.
- **Diagnostics.** Through the `trace` option of [`pipeline`](#pipeline) the step reports `trace('layRoads', { grown, plans })`: `grown`, the centerline of every generated road as it was grown, before the streams bent it, and `plans`, a `CrossingPlan` for every road that comes near a stream (its `start`, `end`, and for each crossing the `approach`, `entry`, `exit` and `departure` tiles, which are where the road turns onto and off the straight run, and where it reaches and leaves the water). Nothing is traced unless `trace` is given.

### `placeClearings`

`placeClearings({ clearings, spacing?, falloff?, distance? })` is a step that places clearings: glades with ragged edges, free of trees. It stamps nothing, since a clearing is ground, and removes the trees inside the ragged shape and across a falloff beyond it. Run it after `plantTrees`, so that there are trees to clear, and after `layStreams` and `layRoads`, which it reads. Every option is checked when the step is made, and a bad one throws a `RangeError` at once; a clearing whose center lies outside the map throws a `RangeError` too, from `pipeline` before the first attempt, since the step checks it in its `validate`.

```ts
const { clearings } = pipeline(
  emptyMap({ width: 80, height: 50, tile: Tile.Grass }),
  [
    plantTrees(),
    layRoads({
      branches: { min: 3, max: 3 },
      branchLength: { min: 20, max: 40 },
    }),
    placeClearings({
      clearings: [
        { radiusX: { min: 4, max: 7 }, roadDistance: { min: 8, max: 20 } },
        { at: 'branch-end', radiusX: { min: 3, max: 3 } },
      ],
      spacing: 2,
      falloff: 3,
    }),
  ],
  { random: mulberry32(42) },
);
```

- **`clearings`** is a list of `ClearingSpec`s, described under [Forests](#forests): a center of its own (`x` and `y`), a random place within `roadDistance` of a road, or `at: 'branch-end'` or `at: 'stream'`; the radii as `Range`s, `angle`, `irregularity`, and `path`. A clearing that finds no room, or no branch end or stream, is left out. The ones `at: 'branch-end'` come last in the result and are never moved or dropped for overlapping.
- **`spacing`** (default 0) is how many tiles beyond their radii the clearings placed at random keep from each other.
- **`falloff`** (default 0) and **`distance`** (default `'chebyshev'`) are those of a [verge](#verges-and-pruneverge), counted from the edge of the clearing. There is no `clearance`: the inside of a clearing is always bare.
- **Reads** `roads` (a random clearing keeps its `roadDistance` from the roads, and `at: 'branch-end'` takes the dead ends of branches that end inside the map, in the order the branches were laid) and `streams` (`at: 'stream'` is centered on a random tile of a stream's centerline, so the stream runs through it; the water stays water). Both are optional.
- **Adds** `clearings`: for each clearing that was made, `x`, `y`, `radiusX`, `radiusY` and `angle`, with the defaults filled in. A clearing that was asked to have a path, `path: true` or `path: { width, windiness }`, also carries `path: { width, windiness }` (defaults 1 and 0.3), which the step that lays paths to clearings reads. A clearing on a stream never has one.

### `placeTemplates`

`placeTemplates({ templates, distance? })` is a step that places [templates](#templates-in-forests): ruins, camps, boss arenas. `templates` is a list of the same `RoomTemplate` objects as the dungeons take, with no exits, `positions` or `areas`. A template with `clearing: true` is centered on a free clearing from the `clearings` of the state, or gets a clearing of its own at a random spot, and any other template goes to a random spot and leaves the trees round it. `Floor` and `Wall` cells are stamped as `Tile.Floor` and `Tile.Wall` (so they are not prunable), and `Unused` cells leave the map as it is. Run it after `plantTrees` and after the steps that lay roads, water and clearings. Every template is checked when the step is made, and a bad one throws a `RangeError` at once; a template bigger than the map throws a `TemplatePlacementError` from `pipeline` before the first attempt, with no retry.

```ts
const { grid, templates } = pipeline(
  emptyMap({ width: 120, height: 80, tile: Tile.Grass }),
  [
    plantTrees(),
    layRoads(),
    placeClearings({ clearings: [{ radiusX: { min: 8, max: 8 } }] }),
    placeTemplates({ templates: [ruin] }),
  ],
  { random: mulberry32(42) },
);
```

- **Free ground.** A cell of a template, other than an `Unused` one, goes only on a free tile (see [`MapState`](#mapstate)): one that holds the base tile or is prunable (untouched ground or ground cover) and is not reserved. A road, a path, water, a bridge or another template is never covered, and neither is a tile that any step of your own has stamped. A `clearing` template on a clearing that a road runs through finds no room there, and so makes a clearing of its own.
- **Own clearing.** The box of the template is free of trees, and the trees thicken over its `margin` beyond the box, with the ramp of a [verge](#verges-and-pruneverge) that has a falloff of `margin` and no clearance. `distance` (default `'chebyshev'`) says how that is measured. The template's `clearing`, `chance`, `margin`, `count`, `rotate` and `mirror` fields work as described under [Templates in forests](#templates-in-forests).
- **Reads** `clearings`, optionally: a clearing holds one template at most, and the clearing is never grown.
- **Adds** `templates`: for each template that was placed, in the order of the list and of its copies, `template` (the index in `templates`), the box it fills (`x`, `y`, `width`, `height`), `rotation`, `mirrored`, `clearing` (the index in the `clearings` extra, left out for a template placed anywhere or on a clearing of its own) and `ownClearing`.
- **Retries.** A copy that finds no spot throws a `TemplatePlacementError`, and `pipeline` builds the map again, up to `attempts` times, before it throws the last error. A template bigger than the map is `permanent` and is thrown at once.

### `layClearingPaths`

`layClearingPaths(options?)` is a step that lays the paths that clearings asked for. Every clearing that `placeClearings` made with a `path` gets one, from the nearest road tile (or from the nearest border when there are no roads) to its center. The path joins the road at a junction. It paints `roadTile` over free ground, which removes its trees, then clears the trees of its verge. A clearing that a road already runs through the center of needs no path and gets none. Every option is checked when the step is made, and a bad one throws a `RangeError` at once.

```ts
const { grid, roads } = pipeline(
  emptyMap({ width: 120, height: 80, tile: Tile.Grass }),
  [
    plantTrees(),
    layRoads(),
    placeClearings({
      clearings: [{ radiusX: { min: 8, max: 8 }, path: { width: 2 } }],
    }),
    placeTemplates({ templates: [ruin] }),
    layClearingPaths({ clearance: 1, falloff: 2 }),
  ],
  { random: mulberry32(42) },
);
```

- **Options.** `roadTile` (default `Tile.Road`) and `bridgeTile` (default `Tile.Bridge`), which should be those of `layRoads`, so that paths and roads look alike, and the verge, `clearance`, `falloff` and `distance` ([see above](#verges-and-pruneverge)), which default to 0, 0 and `'chebyshev'`. The width and windiness of a path are those its clearing asked for.
- **Needs** `clearings`, so it must come after `placeClearings`.
- **Uses** `roads` (where a path starts, and what it joins), `templates` (where it stops) and `streams` (where it bridges), all optional. Run it after `placeTemplates`, so that it knows the templates, and before `layFootbridges`, which counts roads as land.
- **Templates.** A path to a clearing with a template stops at the tile before the first tile of the template's box that holds something other than ground or trees, so at the edge of its walls. A path that still runs through a template, which can happen to a path to another clearing, makes the step throw a `TemplatePlacementError` ("a road or path runs through it"), and `pipeline` builds the map again. With wide paths, mind that the brush of a path that stops at a template may touch its wall.
- **Water.** A path tile over water becomes `bridgeTile` where the path spans the water, joining the two pieces of land it cuts the map into, and stays water everywhere else, as for the generated roads of [`layRoads`](#layroads) that are not planned.
- **Adds** `roads`, `junctions`, `exits` and `bridges` again, which replace those of `layRoads`: the same lists with the paths added. A path is a road of `kind: 'branch'` that comes after the roads that were there, in the order of the clearings. A path from the border adds an exit.

### `layFootbridges`

`layFootbridges(options?)` is a step that lays footbridges across the streams: one tile wide and square to the stream, as a staircase of tiles that touch along edges where the stream runs at a slant. It first joins the large pieces of land that the water cuts apart (a stream at least 2 tiles wide cuts the land, a 1-wide one is waded; pieces under 20 tiles stay islands), nearest first, so that the walkable land is one piece, and then adds footbridges until the map has `minimum` bridges. It is an opt-in step: a stream through a cave gets none unless you ask. Every option is checked when the step is made, and a bad one throws a `RangeError` at once.

```ts
const { grid, bridges } = pipeline(
  emptyMap({ width: 80, height: 50, tile: Tile.Grass }),
  [
    plantTrees(),
    layStreams({ width: { min: 2, max: 3 }, tributaries: { min: 1, max: 1 } }),
    layRoads(),
    layFootbridges({ minimum: 2 }),
  ],
  { random: mulberry32(42) },
);
```

- **Options.** `minimum` (default 0), the number of bridges the map has at least, counting the bridges of roads: footbridges are added across the streams, spaced 8 tiles apart along a row or a column, until it is reached, and fewer are laid when there is no room. A footbridge that joins land the water cuts apart is laid whatever `minimum` says. `bridgeTile` (default `Tile.Bridge`) is the tile it stamps; use the `bridgeTile` of `layRoads`.
- **Needs** `streams`, so it must come after `layStreams`. Run it after every step that lays roads or paths, since a road that bridges a stream makes a footbridge unnecessary.
- **Land.** A water tile that holds `bridgeTile` already, which is a bridge of a road, counts as land, and so do dry roads and trees. A stream with a `spring` has land round its source, so it needs none. A footbridge never lies on the edge of the map and is at most 2 tiles longer than its stream is wide. Land that no such footbridge can join stays apart.
- **Adds** `bridges` again, one point per group of bridge tiles, footbridges and the bridges of roads together, which replaces the list of `layRoads`.

### Areas

A step that makes a feature (a cave, a maze, a room layout) can build it in part of the map. Such a step takes two options, which every feature step has, and which this section describes once:

- `area`, an `AreaSize`: `{ width?: Range; height?: Range }`, the size in tiles of the part it builds in. A size is drawn from each range for every copy. A missing range is the size of the map, so a step without an `area` builds on the whole map, as it always did. An area may be smaller than the map but never larger: a range that is not whole numbers of at least 1, or reaches beyond the map, throws a `RangeError` when the pipeline starts.
- `count`, a `Range` of whole numbers of at least 0, default 1 to 1: how many copies of the feature to make. Each copy gets a spot of its own. A `count` above 1 with an area as big as the map throws a `RangeError`, since two copies cannot fit. A smaller `area` with a `count` of 2 gives two features on the map.

A copy that is as big as the map takes the whole map. Any other goes on a random free spot: a box whose tiles, and a margin of one tile round it, are all [free](#mapstate) (untouched ground or ground cover that nothing has reserved). The copies of one step never touch, and floor that earlier steps dug is not free, so a feature never lands on another. After 100 tries without a spot, an ordinary `Error` is thrown, which `pipeline` answers with a new map. A feature in a smaller area is built on a scratch map the size of the box, so it knows nothing of the rest of the map; a symmetry mirrors about the center of the area. The cave steps have a `placement` option with two more rules, a spot beside what is there and a spot over it (see [`digCellularCave`](#digcellularcave)). Later rules, such as keeping off roads, may be added.

The building blocks are public, for steps of your own:

- `assertAreaSize(area, count, width, height)` checks the two options against the size of the map. Call it from the `validate` of the step.
- `placeAreas(state, random, area, count, { lattice?, overlap? })` returns one box (`Area`: `x`, `y`, `width`, `height`) per copy, or throws when a copy finds no spot. With `lattice: true` the boxes have odd sizes and start on even coordinates, so that a maze or the rooms of a lattice line up with the map's lattice. With `overlap: true` a spot need only be clear of the other boxes, and may cover anything.
- `placeBeside(state, random, size, floor)` picks a spot for a shape that is already made: `size` is its `width` and `height`, and `floor` lists its floor tiles in its own coordinates. It tries 100 random spots and returns the box at the one where every floor tile and the 8 tiles round it are free, nearest the dug ground, or `undefined` when none fits. The step stamps the shape itself.
- `buildInArea(state, box, build)` makes a scratch `MapState` from a copy of the box (the grid, `prunable` and `reserved`), runs `build` on it, copies the three back and returns what `build` returned. Coordinates in `build` start at the corner of the box, so the step shifts the extras it returns by the box's `x` and `y` itself. When `build` throws, the map is left as it was. For a box as big as the map the result is the same as building in place.

### `openExits`

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
| `count`          | `{ 0, 0 }`  | How many exits to carve, a `Range` of whole numbers of at least 0. The default adds none. The twins that `symmetry` makes count towards it.                                                  |
| `lattice`        | `false`     | Puts doors on odd border coordinates only, which is where a maze has its cells.                                                                                                              |
| `symmetry`       | `'none'`    | `'horizontal'` (left to right), `'vertical'` (top to bottom), `'both'` or `'rotational'` (by 180°): an exit gets twins on the mirror images of its place that a tunnel can reach floor from. |
| `symmetryChance` | 1           | The chance that an exit has twins, from 0 to 1. The exit and its twins are all left out when there is no room for them or two of their doors would be side by side.                          |
| `tile`           | `Tile.Door` | The tile of a door on the border. The tunnel is `Tile.Floor`.                                                                                                                                |

- **Where.** A side of the map is picked at random, and then one of the exits on it with the shortest tunnels. A tunnel never digs through a tile that is [reserved](#mapstate), and a door is never on one. A door is never next to another door, diagonals included.
- **Misses.** An exit may be left out for lack of floor to reach or of room. The step stops when it has made `count` exits or when ten tries in a row have come to nothing, and it never throws for that, so a map with no floor gets no exits.
- **Reserved.** Each door is recorded with `openReserved`, so the `Openable` tiles round it become `Solid`. The tiles it stamps stop being prunable.
- **Adds** `exits`: the points of the doors. An `exits` extra that is in the state already is kept, and its doors count as neighbors to keep away from, so the step can run more than once, with different options.

### `digFishbone`

`digFishbone(options?)` is a step that digs a fishbone mine (see [the fishbone layout](#the-fishbone-layout) for how it looks): a main shaft through a point near the middle of its area, and then adits that branch off the existing tunnels until the density is reached. A mine is dug out of rock, so the map has to start as wall, which `pipeline` checks before the first attempt (a `RangeError` that says how to start the map). Every option is checked when the step is made, and a bad one throws a `RangeError` at once.

```ts
const { grid, passages } = pipeline(
  emptyMap({ width: 80, height: 50, tile: Tile.Wall }),
  [
    digFishbone({
      density: 0.2,
      area: { width: { min: 25, max: 35 }, height: { min: 20, max: 30 } },
      count: { min: 2, max: 2 },
    }),
    openExits({ count: { min: 2, max: 3 } }),
  ],
  { random: mulberry32(42) },
);
```

The options are those of the fishbone layout of [`generateMine`](#mineoptions), none of them marked "fishbone only" any more, since the step has no other layout, plus the two options of [areas](#areas):

| Option           | Default       | Meaning                                                                                                                                     |
| ---------------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `density`        | 0.15          | The share of the area that is floor, from 0 to 1. A target, met as far as the area has room. The main shaft is always dug.                  |
| `shaftWidth`     | `{ 2, 3 }`    | Width of the main shaft in whole tiles, a `Range`.                                                                                          |
| `shaftWindiness` | 0.1           | How much the main shaft winds, from 0 (straight) to 1.                                                                                      |
| `angle`          | `'random'`    | Direction of the main shaft in degrees, clockwise from east. `'random'` picks one for every copy.                                           |
| `aditWidth`      | `{ 1, 2 }`    | Width of an adit in whole tiles. One is picked for every adit.                                                                              |
| `aditWindiness`  | 0.4           | How much the adits wind, from 0 to 1.                                                                                                       |
| `aditLength`     | `{ 15, 50 }`  | Length of an adit in whole tiles. An adit that ends up shorter than the minimum is not dug.                                                 |
| `branchAngle`    | `{ 45, 90 }`  | The angle in whole degrees, from 1 to 179, between an adit and the tunnel it leaves.                                                        |
| `loops`          | 0             | The chance, from 0 to 1, that an adit that runs into another tunnel breaks through and joins it.                                            |
| `area`           | the whole map | The size of the part of the map to dig in, see [areas](#areas). The mine is closed in by a ring of wall inside it.                          |
| `count`          | `{ 1, 1 }`    | How many mines to dig, each in an area of its own. The mines are apart, so a map with two is in two pieces, unless a later step joins them. |

- **Density is a share of the area**, not of the map: a 25 by 20 area with a `density` of 0.2 gets about 100 tiles of floor.
- **Reserved ground.** Tunnels are dug out of wall and never through a [reserved](#mapstate) tile, so a mine dug over reserved ground may come out in pieces. A smaller `area` only lands on free ground, so this concerns an area as big as the map.
- **Uses** `passages`, the tunnels of the steps before it, and **adds** `passages` again with its own appended: `shaft` and `adit` entries, with `tiles` in the coordinates of the map, whatever the area. A second mine layout in the same pipeline carries on with the lanes of the noise where this one stopped, so no two tunnels bend alike.

### `digVeins`

`digVeins(options?)` is a step that digs a network of winding veins through the rock between the pieces of floor on the map, and joins them all into one: rooms, halls, caverns and the veins of earlier steps. It is the mine's counterpart of [`digCorridors`](#digcorridors), which joins the same pieces with straight corridors. On a map with no floor it digs a web of its own (see [the veins layout](#the-veins-layout)), and for the halls of a pillar mine see [the pillars layout](#the-pillars-layout). Like `digFishbone` it needs a map that starts as wall.

- **Pieces.** A piece is a set of tiles that are not wall, joined along edges: a room, a hall, a cavern, a vein. The two pieces nearest each other are joined first, then the piece nearest the network to the nearest tile of anything in it, veins included. A piece with several parts joined already counts as one.
- **Rooms.** A vein enters a room through a potential exit (an `Openable` tile of the [reserved](#mapstate) mask). The tile becomes floor and is opened with `openReserved`, so there is no gap in the wall. A room is entered only where a vein arrives, so a room with exits in all four walls opens one.
- **Never inside a piece.** The routing is the one under [the pillars layout](#the-pillars-layout): it may not use any floor and no reserved tile, so the pillars of a hall stand, and no vein runs through a room. A vein starts from a tile of a piece that has free rock beside it, never from one that only touches a pillar.
- **Density.** `density` is the share of the rock that was free when the step began that the veins dig out, counted from the veins that join the pieces on. With `0` nothing else is dug. Above that, junctions are scattered, each one nearest the network is joined first, until the share is reached. On a map with pieces, a junction is joined by two veins, the second to another part of the network than the first, so it is a bend on the way between two parts and no vein ends in rock; a junction that cannot get both is left out. On an empty map the web is a web of its own, and a junction gets one vein, so it may end in rock. When the junctions give out, finer ones are scattered in between (down to about 6 tiles apart), and then extra veins make loops. The share is a target, met as far as the map has room, so a crowded map stops short.
- **Thin walls and boxed-in pieces.** A vein keeps a wall between itself and the floor where it can. Where that leaves no way (a single wall between two caverns, as in a cave), a second try lets the vein pass close to the floor, and a last try lets it run through the rock that floor shuts in, which a piece surrounded by others needs. That last try is only made for a piece that nothing else reaches, so the pillars of a hall are safe whenever a hall can be joined at all. A piece that still cannot be reached is left as it is.
- **A piece that cannot be reached** (sealed in, or walled in by reserved tiles) is left as it is.
- **Cell blocks.** A [cell block](#placecellblocks) is one piece, its cells and corridor joined by their doors, and its only potential exit is its entrance, so a vein enters it there, as it enters a room, and nowhere else.
- **Touching pieces.** An `Openable` tile with the floor of two different pieces on opposite sides, such as a block entrance that a later hall reaches, is opened as floor, before the veins are dug and again after, since no vein through rock can reach it. Once two pieces are joined that way, no other such tile between them is opened.
- **Uses** `passages`, `rooms`, `roomShapes` and `roomExits`, and **adds** `passages`, `rooms` and `roomExits` again: its own `vein` entries appended to `passages`, and every way into a room that it digs as an [`Exit`](#exit) appended to `roomExits` and listed in the room's `exits`: the `Openable` tile it opens into a room, and where a vein reaches the floor of a hall or a cavern (see [ways into halls and caverns](#ways-into-halls-and-caverns)). Without rooms, `rooms` and `roomExits` are empty.
- **Speed.** About 25 ms on an 80 by 50 map for the default density, 40 ms with two or three halls to join, and up to 200 ms for a `density` that asks for more than the map has room for.

```ts
const { grid } = pipeline(
  emptyMap({ width: 80, height: 50, tile: Tile.Wall }),
  [placeScatteredRooms(), digPillarHalls(), digVeins({ density: 0 })],
  { random: mulberry32(42) },
);
```

| Option           | Default    | Meaning                                                                                                                                              |
| ---------------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `density`        | 0.15       | The share of the free rock that the veins dig out, from 0 to 1. The veins that join the pieces are dug whatever it says. With 0 nothing else is dug. |
| `veinWidth`      | `{ 1, 2 }` | Width of a vein in whole tiles. One is picked for every vein.                                                                                        |
| `veinWindiness`  | 0.5        | How much the veins wind, from 0 (straight) to 1.                                                                                                     |
| `veinSpacing`    | 16         | About how far apart the junctions of the web lie, in tiles, a whole number of at least 3.                                                            |
| `hallEntrances`  | `'facing'` | Where a vein starts on a piece: `'facing'` along the side that faces the nearest part of the network, `'edge'` on any side.                          |
| `symmetry`       | `'none'`   | The symmetry that veins follow by getting twins: `'horizontal'`, `'vertical'`, `'both'` or `'rotational'`.                                           |
| `symmetryChance` | 1          | How often a vein gets its twins, from 0 to 1. Applies with a `symmetry` only.                                                                        |

**Symmetry.** With a `symmetry`, every vein gets twins with the chance `symmetryChance`, rolled once for every vein: once it is dug, every tile it carved is dug at its mirror images about the center of the map too (the same transforms as the [dungeons](#layout-symmetry)), and so are the doors it opened, where their images are `Openable`. A twin tile that is not free rock a vein can reach (the border margin, a reserved tile, a pillar, but not rock that veins shut in) is left out, so a twin can be partial, but it never digs into a room or a hall. Twins are listed in `passages`, after their vein (after both veins of a junction). The pieces that the twin veins join are the images of the ones the vein joins, so a map whose pieces are symmetric gets a symmetric network. On a map with pieces, a vein gets a twin only at the images where the twin would join two things too: where each of its ends lands on floor, or on an `Openable` tile for a door. A junction gets the twins of its two veins together, so a piece without a twin leaves no dead-end twin vein, only a vein with no twin there. The junctions of the web (`density`) are not mirrored themselves, so a web grown on an empty map is only roughly symmetric. The twins count toward `density`.

### `digPillarHalls`

`digPillarHalls(options?)` is a step that digs a room-and-pillar mine (see [the pillars layout](#the-pillars-layout)): a few large halls placed apart from one another, with pillars of wall left standing in them. It digs no veins: [`digVeins`](#digveins) joins the halls. Like `digFishbone` it needs a map that starts as wall, takes `area` and `count`, and checks every option when it is made.

```ts
const { grid, rooms } = pipeline(
  emptyMap({ width: 80, height: 50, tile: Tile.Wall }),
  [
    digFishbone(),
    // one pillar hall on a piece of the map of its own
    digPillarHalls({
      halls: { min: 1, max: 1 },
      area: { width: { min: 20, max: 20 }, height: { min: 16, max: 16 } },
    }),
  ],
  { random: mulberry32(42) },
);
```

A pillar hall on its own is this step with `halls: 1` in a small area. It is not joined to the rest of the map, which is left to a later step: [`digVeins`](#digveins) or [`digCorridors`](#digcorridors) joins the halls to each other and to anything else.

| Option          | Default       | Meaning                                                                                                                                                                                                        |
| --------------- | ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `density`       | 0.35          | The share of the area that is floor, from 0 to 1. It sets the size of the halls that have no `hallSize`.                                                                                                       |
| `halls`         | `{ 2, 4 }`    | How many halls to dig in each area, a `Range` of whole numbers, 1 or more. A hall that finds no room, at least 4 tiles of wall from the others and off reserved tiles, is left out.                            |
| `hallSize`      | from density  | The width and the height of a hall in whole tiles, 1 or more. Each side of each hall gets its own size, cut down to what the area has room for.                                                                |
| `hallRagged`    | 0.5           | How ragged the edges of the halls are, from 0 (clean rectangles) to 1.                                                                                                                                         |
| `pillarSize`    | `{ 2, 5 }`    | The width and the height of a pillar in whole tiles, 1 or more.                                                                                                                                                |
| `pillarSpacing` | `{ 2, 4 }`    | The gap between neighboring pillars in whole tiles, 1 or more, picked once for each hall.                                                                                                                      |
| `pillarRagged`  | 0.5           | How ragged the edges of the pillars are, from 0 (clean rectangles) to 1.                                                                                                                                       |
| `pillarJitter`  | 0.5           | How far the pillars stray from a regular pattern, from 0 (a perfect grid) to 1.                                                                                                                                |
| `area`          | the whole map | The size of the part of the map to dig in, see [areas](#areas). The halls are closed in by a ring of wall inside it.                                                                                           |
| `count`         | `{ 1, 1 }`    | How many groups of halls to dig, each in an area of its own. The groups are apart, so a map with two is in two pieces, unless a later step joins them. [`digVeins`](#digveins) joins the halls of every group. |

- **Density is a share of the area**, as for `digFishbone`.
- **Reserved ground.** No hall covers a [reserved](#mapstate) tile.
- **Halls are rooms.** Every hall is a [`Room`](#room) of kind `'pillarHall'`, its box the rectangle it was dug in, in the coordinates of the map, and its shape in `roomShapes` its floor, which blocks nothing and reserves nothing (see [halls and caverns](#room)). The halls of one area are a `'pillarHalls'` [group](#roomgroup) with the box of the area.
- **Uses** `rooms`, `roomShapes` and `roomGroups`, from the steps before it, and **adds** all three again with its own appended, the ids following on.

### `digRings`

`digRings(options?)` is a step that digs concentric rings joined by spokes (see [the rings layout](#the-rings-layout)): ovals round the middle of its area, evenly spaced, the outermost near the edge of the area, each wobbling by smooth noise, with at least one spoke between every ring and the next. Like `digFishbone` it needs a map that starts as wall, takes `area` and `count`, and checks every option when it is made.

```ts
const { grid } = pipeline(
  emptyMap({ width: 80, height: 50, tile: Tile.Wall }),
  [
    digRings({
      ringShape: 'circle',
      area: { width: { min: 30, max: 30 }, height: { min: 30, max: 30 } },
    }),
  ],
  { random: mulberry32(42) },
);
```

| Option          | Default       | Meaning                                                                                                                                       |
| --------------- | ------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `density`       | 0.3           | The share of the area that is floor, from 0 to 1. It sets how many rings to dig when `rings` is not given.                                    |
| `rings`         | from density  | How many concentric rings to dig in each area, a `Range` of whole numbers, 1 or more. Fewer are dug when the area has no room for them.       |
| `ringShape`     | `'oval'`      | `'oval'` fits the rings to the area, `'circle'` makes them round and centered, as large as the shorter side of the area allows.               |
| `ringWidth`     | `{ 2, 3 }`    | Width of a ring in whole tiles, 1 or more. One is picked for every ring.                                                                      |
| `ringWobble`    | 0.5           | How far the rings stray from perfect ovals, from 0 to 1.                                                                                      |
| `spokes`        | `{ 1, 3 }`    | How many spokes join each ring to the next, a `Range` of whole numbers, 0 or more. Every pair gets one at least.                              |
| `veinWidth`     | `{ 1, 2 }`    | Width of a spoke in whole tiles. One is picked for every spoke.                                                                               |
| `veinWindiness` | 0.5           | How much the spokes wind, from 0 (straight) to 1.                                                                                             |
| `area`          | the whole map | The size of the part of the map to dig in, see [areas](#areas). The rings are fitted round its middle, closed in by a ring of wall inside it. |
| `count`         | `{ 1, 1 }`    | How many sets of rings to dig, each in an area of its own.                                                                                    |

- **Reserved ground.** Nothing is dug through a [reserved](#mapstate) tile, so a ring that crosses one is cut there, and rings dug over reserved ground may come out in pieces. A smaller `area` only lands on free ground, so this concerns an area as big as the map.
- **Uses** `passages`, the tunnels of the steps before it, and **adds** `passages` again with its own appended: the `ring` entries first, each a closed loop whose first tile is also its last, then the `spoke` entries, all in the coordinates of the map.

### `placeMineRooms`

`placeMineRooms(options?)` is a step that places rooms in the rock beside the floor that is there and joins each to it by a tunnel from every exit it opens (see [rooms and templates](#rooms-and-templates) for how rooms are placed and opened). The floor need not be a mine: any floor the steps before it made, or that a step of your own carved, will do. Like `digFishbone` it needs a map that starts as wall, and it checks every option and template when it is made. It works on the whole map and takes no `area`.

```ts
import { digVeins, emptyMap, pipeline, placeMineRooms, Tile } from 'angstloch';

const { grid, rooms, roomExits, roomShapes } = pipeline(
  emptyMap({ width: 80, height: 50, tile: Tile.Wall }),
  [
    digVeins(),
    // closet is the template of the mine example under rooms and templates
    placeMineRooms({ roomCount: { min: 2, max: 4 }, templates: [closet] }),
  ],
  { random: mulberry32(42) },
);
```

| Option           | Default    | Meaning                                                                                                                             |
| ---------------- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `roomCount`      | `{ 1, 1 }` | How many ordinary rooms to place, a `Range` of whole numbers, 0 or more. Fewer are placed when no more fit.                         |
| `roomWidth`      | `{ 3, 7 }` | Room width in tiles, without the walls, 1 or more.                                                                                  |
| `roomHeight`     | `{ 3, 7 }` | Room height in tiles, without the walls, 1 or more.                                                                                 |
| `sizeUniformity` | 0          | How alike room sizes are, from 0 (anything within the ranges) to 1 (every room has the middle size).                                |
| `templates`      | none       | [`RoomTemplate`](#room-templates) objects, placed before the ordinary rooms. One that cannot be placed or joined fails the attempt. |
| `exitsPerRoom`   | `{ 1, 3 }` | Number of openings per room, 1 or more. The fixed exits of a template count, and more are opened from the optional ones.            |
| `doorChance`     | 1          | Chance that an opening gets a door, from 0 to 1. `Door` cells of a template are always doors.                                       |
| `veinWidth`      | `{ 1, 2 }` | Width of the tunnels that join the rooms to the floor, in whole tiles.                                                              |
| `veinWindiness`  | 0.5        | How much the tunnels wind, from 0 (straight) to 1.                                                                                  |

- **Templates.** A template that cannot be placed, or cannot be joined to the floor, throws a [`TemplatePlacementError`](#room-templates), which [`pipeline`](#pipeline) answers with a new map, up to its `attempts`. A map with no floor at all cannot join a template, and always fails. `Room.template` is an index into the `templates` of the step that placed the room.
- **Reserved ground.** No room and no tunnel is built on a [reserved](#mapstate) tile, and the floor of a reserved tile, such as an earlier room's, is not floor to join, so a tunnel never ends in another room.
- **What it reserves.** Every room reserves its footprint: its walls, its floor and its inner doorways are `Reserve.Solid`, and its potential exits, the `OptionalExit` cells and the `Exit` and `Door` cells that lead outside, are `Reserve.Openable`. Every opening it makes goes through `openReserved`, so the opening and the potential exits around it become `Solid`. An ordinary room's unopened wall stays `Openable`, which later steps can open as an exit.
- **Uses** `passages`, `rooms`, `roomExits` and `roomShapes`, from the steps before it, and **adds** all four again with its own appended: `tunnel` entries in `passages`, and rooms whose ids, and exits whose indices, follow on from the ones there are. Its rooms are templated ones first, then ordinary ones. A tunnel that ends in a hall or a cavern gives it an exit too (see [ways into halls and caverns](#ways-into-halls-and-caverns)), appended after the exits of the new rooms.
- **`roomShapes`** holds a `RoomShape` for every room, by id: the cells of the room as placed on the map (`x`, `y`, `width`, `height`, `cells`, `exits`, `rotation` and `mirrored`, as a `TemplatePlacement`), plus `doors`, a list of `{ x, y, door }` that says, in the coordinates of the map, whether each `Exit` and `Door` cell got a door. A templated room's shape is its placement. An ordinary room's is a ring of `OptionalExit` round its floor, with wall corners, and has no `doors`. Steps that work with rooms read their walls, floors and potential exits from it.

### `digCellularCave`

`digCellularCave(options?)` is a step that grows a cave with a cellular automaton, as [`generateCave`](#caves) does: random noise smoothed over a number of passes until walls and floors clump into caverns. It joins nothing: the caverns are left apart, `largestOnly` keeps one of them, and joining is a later step's job. It needs a map that starts as wall, takes `area` and `count`, and checks every option when it is made.

```ts
import {
  digFishbone,
  emptyMap,
  digCellularCave,
  pipeline,
  Tile,
} from 'angstloch';

const { grid, rooms, roomGroups } = pipeline(
  emptyMap({ width: 80, height: 50, tile: Tile.Wall }),
  [
    digFishbone({ density: 0.1 }),
    // two caverns on pieces of the map of their own, one piece each
    digCellularCave({
      largestOnly: true,
      area: { width: { min: 16, max: 24 }, height: { min: 12, max: 16 } },
      count: { min: 2, max: 2 },
    }),
  ],
  { random: mulberry32(42) },
);
```

| Option           | Default       | Meaning                                                                                                                       |
| ---------------- | ------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `fillChance`     | 0.45          | Chance that a tile starts as a wall, from 0 to 1.                                                                             |
| `iterations`     | 4             | Number of smoothing passes, 0 or more.                                                                                        |
| `neighborhood`   | `'moore'`     | Which tiles count as neighbors: `'moore'` (8) or `'von-neumann'` (4). Tiles outside the area count as walls.                  |
| `birthLimit`     | 5 / 3         | A floor tile turns into a wall with at least this many wall neighbors. 5 for `'moore'`, 3 for `'von-neumann'`.                |
| `survivalLimit`  | 4 / 2         | A wall tile stays a wall with at least this many wall neighbors. 4 for `'moore'`, 2 for `'von-neumann'`.                      |
| `borderWalls`    | true          | Keeps the outermost ring of tiles of the area solid wall.                                                                     |
| `symmetry`       | `'none'`      | Mirrors or rotates the starting noise about the center of the area: `'horizontal'`, `'vertical'`, `'both'` or `'rotational'`. |
| `symmetryChance` | 1             | How often a tile of the starting noise copies its twin, from 0 to 1. At 1 the cave is perfectly symmetric.                    |
| `minRegionSize`  | 0             | Leaves out every cavern of the area smaller than this many tiles. 0 keeps all.                                                |
| `largestOnly`    | false         | Keeps only the largest cavern of the area.                                                                                    |
| `area`           | the whole map | The size of the part of the map to grow the cave in, see [areas](#areas).                                                     |
| `count`          | `{ 1, 1 }`    | How many caves to grow, each in an area of its own.                                                                           |
| `placement`      | `'free'`      | Where a smaller area goes: `'free'`, `'beside'` or `'overlap'`, see below.                                                    |

- **Laid over the map.** The cave is grown on its own, then laid over its area: its floor is stamped on the [free](#mapstate) tiles, and every other tile keeps what it has, so nothing that earlier steps made is lost, and no floor goes on a reserved tile. With `'free'` a smaller `area` only lands on free ground, so this matters for an area as big as the map, and for `'overlap'`.
- **Placement.** `placement` says where a smaller `area` goes, and no placement ever digs a reserved tile:
  - `'free'`, the default, is the rule of [areas](#areas): a random spot where the box and a margin of one tile round it are all free. A copy that finds none fails the attempt.
  - `'beside'` puts a cave beside what is there, as the [caverns](#caverns) of a mine are. The cave is grown, and culled by `minRegionSize` and `largestOnly`, on its own first, and then up to 100 random spots are tried. A spot fits when every floor tile of the cave, and the 8 tiles round it, is free, so the cave's floor keeps a wall between it and anything on the map, while its box may overlap tunnels. Of the spots that fit, the one whose floor comes nearest the dug ground (any tile that is not the base) wins; on a map with nothing dug, the first that fits. When no spot fits, the copies up to `count.min` fail the attempt, with an ordinary `Error` that `pipeline` answers with a new map, and the copies above it are left out, so a `count` with a `min` of 0 never fails. A cave with no floor left after culling is left out, and is not listed in `caverns`.
  - `'overlap'` puts the box on any random spot, clear only of the other copies of the step, and lays the cave over what is there: it runs into the tunnels and floor it meets, like a cave-in, and its caverns are measured with that floor, as above.
- **Caverns and the floor that was there.** `minRegionSize` and `largestOnly` measure the caverns after that: unreserved floor that was there already counts as part of a cavern it touches, so a cavern cut in two by an earlier tunnel is still one cavern, and reserved tiles count as wall. Floor that no new floor touches is never left out, whatever its size.
- **Caverns are rooms.** Every cavern that is kept is a [`Room`](#room) of kind `'cavern'`, its box the smallest rectangle that holds its floor and its shape in `roomShapes` that floor, which blocks nothing and reserves nothing (see [halls and caverns](#room)). It holds only the floor this cave dug, not the floor that was there. The caverns of one copy are a `'cave'` [group](#roomgroup) with the box the copy was grown in. They are the caverns as the step dug them: a later step that joins them, or digs into them, does not change them.
- **Uses** `rooms`, `roomShapes` and `roomGroups`, from the steps before it, and **adds** all three again with its own appended, the ids following on.

### `digNoiseCave`

`digNoiseCave(options?)` is a step that carves a cave by thresholding noise, as [`generateNoiseCave`](#noise-caves) does: the tiles with the lowest noise become wall and the rest floor, or with `shape: 'veins'` the floor follows the midpoint of the noise. Like `digCellularCave` it joins nothing, needs a map that starts as wall, takes `area` and `count`, and checks every option when it is made.

```ts
const { grid } = pipeline(
  emptyMap({ width: 80, height: 50, tile: Tile.Wall }),
  [digNoiseCave({ shape: 'veins', scaleX: 20, scaleY: 8, rotation: 30 })],
  { random: mulberry32(42) },
);
```

| Option           | Default       | Meaning                                                                                                                              |
| ---------------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `shape`          | `'blobs'`     | Which part of the noise becomes floor: `'blobs'` the high part, `'veins'` the part nearest the midpoint.                             |
| `fill`           | 0.45          | The share of the tiles of the area that become wall, from 0 to 1. With `borderWalls` the border is walled on top of it.              |
| `cornerBias`     | 4             | The distance in tiles from a corner of the area over which the walls are pulled in, a whole number. 0 turns it off.                  |
| `scaleX`         | 12            | Size in tiles of a feature of the noise along the x axis, before rotation.                                                           |
| `scaleY`         | 12            | Size in tiles of a feature of the noise along the y axis, before rotation.                                                           |
| `rotation`       | 0             | Clockwise rotation of the noise in degrees.                                                                                          |
| `octaves`        | 3             | Number of layers of the built-in noise.                                                                                              |
| `persistence`    | 0.5           | How much each layer counts against the one before it, from 0 to 1.                                                                   |
| `lacunarity`     | 2             | How much finer each layer is than the one before it.                                                                                 |
| `noise`          | simplex       | A `NoiseFunction` to use instead of the built-in noise. The scales and the rotation apply to it, the layers do not.                  |
| `iterations`     | 0             | Number of passes of the cave automaton (4-5 rule on 8 neighbors) to smooth the thresholded noise with.                               |
| `borderWalls`    | true          | As for `digCellularCave`.                                                                                                            |
| `symmetry`       | `'none'`      | As for `digCellularCave`. A tile copies the noise at its twin.                                                                       |
| `symmetryChance` | 1             | As for `digCellularCave`.                                                                                                            |
| `minRegionSize`  | 0             | As for `digCellularCave`.                                                                                                            |
| `largestOnly`    | false         | As for `digCellularCave`.                                                                                                            |
| `area`           | the whole map | The size of the part of the map to carve the cave in, see [areas](#areas). `fill`, `cornerBias` and `borderWalls` apply to the area. |
| `count`          | `{ 1, 1 }`    | How many caves to carve, each in an area of its own.                                                                                 |
| `placement`      | `'free'`      | As for `digCellularCave`.                                                                                                            |

- **One noise for the map.** The noise is made once per run and sampled where each tile is on the map, so two copies in two areas differ. With `placement: 'beside'` the cave is made before it has a spot, so its noise is sampled at a random spot of the map instead.
- **Laid over the map**, **placement**, **caverns** and **uses and adds** work as for [`digCellularCave`](#digcellularcave).

### `placeMazeRooms`

`placeMazeRooms(options?)` is a step that places the rooms of a maze on its lattice and carves their floor, for a maze to be carved round them by a later step: the templates first, then the ordinary rooms, at random spots (see [rooms in mazes](#rooms-in-mazes) and [templates in mazes](#templates-in-mazes) for how they sit on the lattice). The rooms are not opened: their walls stay whole until a step opens them onto the maze. It needs a map that starts as wall, and it checks every option and template when it is made. [`digMaze`](#digmaze) carves the maze round them, and [`openMazeRooms`](#openmazerooms) opens them.

```ts
import { emptyMap, pipeline, placeMazeRooms, Tile } from 'angstloch';

const { grid, rooms, roomShapes, reserved } = pipeline(
  emptyMap({ width: 61, height: 41, tile: Tile.Wall }),
  [
    placeMazeRooms({
      roomCount: { min: 3, max: 5 },
      roomWidth: { min: 5, max: 9 },
      // closet is the template of the example under templates in mazes
      templates: [closet],
      keepClear: { x: 31, y: 21 },
    }),
  ],
  { random: mulberry32(42) },
);
```

| Option           | Default    | Meaning                                                                                                                                                                                      |
| ---------------- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `roomCount`      | `{ 1, 1 }` | How many ordinary rooms to place, a `Range` of whole numbers, 0 or more. Fewer are placed when no more fit.                                                                                  |
| `roomWidth`      | `{ 3, 7 }` | Room width in tiles, without the walls, 1 or more. Only odd widths are used.                                                                                                                 |
| `roomHeight`     | `{ 3, 7 }` | Room height in tiles, without the walls, 1 or more. Only odd heights are used.                                                                                                               |
| `sizeUniformity` | 0          | How alike room sizes are, from 0 (anything within the ranges) to 1 (every room has the middle size).                                                                                         |
| `templates`      | none       | [`RoomTemplate`](#room-templates) objects, placed before the ordinary rooms. They must fit the lattice, which is checked when the step is made; one that cannot be placed fails the attempt. |
| `doorChance`     | 1          | Chance that an `Exit` cell of a template gets a door, from 0 to 1. `Door` cells always do. The other openings are decided by the step that opens the rooms.                                  |
| `keepClear`      | none       | A tile, `{ x, y }` in whole coordinates of the map, that the rooms leave free, such as the cell a maze starts from. Ordinary rooms keep off it; a template that covers it fails the attempt. |
| `area`           | the map    | The size of the box the rooms go in, an `AreaSize` (see [Areas](#areas)), placed on the lattice: odd sizes at even coordinates. There is one box, so the step takes no `count`.              |

- **Spacing.** At least three wall tiles separate the floors of two rooms, ordinary or templated, which leaves room for a maze cell between them.
- **Templates.** A template that cannot be placed, or that covers `keepClear`, throws a [`TemplatePlacementError`](#room-templates), which [`pipeline`](#pipeline) answers with a new map, up to its `attempts`. `Room.template` is an index into the `templates` of the step that placed the room.
- **In an area.** The rooms go in one box of `area`, picked as [Areas](#areas) describes, and the positions and areas of the templates are in the coordinates of that box. A maze in a smaller area picks its own box, so its rooms do not yet land in it.
- **What is in the way.** On the whole map the rooms do not look at what the steps before them built, so put this step first, or give it an `area`: a box goes only where the map is free.
- **What it reserves.** Every room reserves its footprint, as [`placeMineRooms`](#placeminerooms) does: walls, floor and inner doorways are `Reserve.Solid`, and potential exits are `Reserve.Openable`. The whole ring of an ordinary room, but its corners, is `Openable`, though only the tiles that face a maze cell (at odd offsets along a wall) can become an exit; which ones do is worked out when the rooms are opened.
- **Uses** `rooms` and `roomShapes` from the steps before it, and **adds** both again with its own appended, with ids that follow on: templated rooms first, then ordinary ones, each with a [`RoomShape`](#placeminerooms) in `roomShapes`. Its rooms have no exits yet.

### `digMaze`

`digMaze(options?)` is a step that carves a maze with the recursive backtracker, as [`generateMaze`](#mazes) does, round whatever is there: it keeps off every tile that is not free (see [`isFree`](#mapstate)), which is the rooms of [`placeMazeRooms`](#placemazerooms), other reserved tiles, and the floor of the steps before it. It needs a map that starts as wall.

```ts
import {
  openExits,
  digMaze,
  emptyMap,
  openMazeRooms,
  pipeline,
  placeMazeRooms,
  Tile,
} from 'angstloch';

const start = { x: 31, y: 21 };
const { grid, rooms, roomExits, exits } = pipeline(
  emptyMap({ width: 61, height: 41, tile: Tile.Wall }),
  [
    placeMazeRooms({ roomCount: { min: 3, max: 5 }, keepClear: start }),
    digMaze({ loopChance: 0.2, start }),
    openMazeRooms({ doorChance: 0.5 }),
    openExits({ count: { min: 1, max: 2 }, lattice: true }),
  ],
  { random: mulberry32(42) },
);
```

| Option           | Default    | Meaning                                                                                                                                                                                           |
| ---------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `horizontalBias` | 0          | Weight of horizontal corridors against `verticalBias`, 0 or more. Only the ratio matters, so set both; a lone value against 0 means always.                                                       |
| `verticalBias`   | 0          | Weight of vertical corridors against `horizontalBias`, 0 or more.                                                                                                                                 |
| `loopChance`     | 0          | Chance of turning a dead end into a loop: 0 is a perfect maze, 1 a braid maze.                                                                                                                    |
| `fill`           | 1          | Fraction of the maze to carve, from 0 to 1. The part the start is in is always carved.                                                                                                            |
| `straight`       | 0          | Preference for continuing straight, from 0 to 1.                                                                                                                                                  |
| `pattern`        | `'none'`   | `'whirlpool'` twirls corridors around the middle of the maze, `'snowflake'` makes them radiate from it.                                                                                           |
| `patternChance`  | 1          | How strongly the pattern is enforced, from 0 to 1.                                                                                                                                                |
| `start`          | the middle | Where carving starts, `{ x, y }` in the coordinates of the map: a maze cell, with odd coordinates inside the map. Only for a maze on the whole map. Defaults to the free cell nearest the middle. |
| `area`           | the map    | The size of the box each maze goes in, an `AreaSize` (see [Areas](#areas)) of at least 3 a side, placed on the lattice: odd sizes at even coordinates.                                            |
| `count`          | `{ 1, 1 }` | How many mazes to carve, each in its own box. More than one needs an `area` smaller than the map.                                                                                                 |

- **Parts.** Tiles that are not free can cut the maze into parts, such as a room across the map. Each part is carved in turn, the start's first, and the parts are not joined to each other: [`openMazeRooms`](#openmazerooms) joins them through the rooms.
- **In an area.** A maze in a box keeps a wall frame inside the box, starts at the free cell nearest the middle of the box, and its pattern turns about the middle of the box. Its rooms do not yet land in its box (see [`placeMazeRooms`](#placemazerooms)).
- **Errors.** A `start` that is not a maze cell, a `start` with an `area`, or an area below 3 throws a `RangeError` before the first attempt. A `start` that is not free, such as one a template covers, fails the attempt, which `pipeline` answers with a new map.
- **Reserves** nothing, so later steps may dig through the maze's walls.
- **Adds** `start`, the start of the first maze; none when `count` gives no maze.

### `openMazeRooms`

`openMazeRooms(options?)` is a step that opens the rooms onto the maze round them, the rooms of [`placeMazeRooms`](#placemazerooms) once [`digMaze`](#digmaze) has carved the maze. Only rooms that have no exits yet are opened, so rooms opened by another step are left alone.

| Option         | Default    | Meaning                                                                                                                                                                                   |
| -------------- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `exitsPerRoom` | `{ 1, 3 }` | Number of openings per room, a `Range` of 1 or more. A room may get more where they join parts of the maze that a room cuts off, and fewer when no carved maze cell is next to its walls. |
| `doorChance`   | 1          | Chance that an opening gets a door, from 0 to 1. Openings without a door are plain gaps in the wall. The fixed exits of templates were decided by `placeMazeRooms`.                       |

- **Where a room opens.** A room's openings come from its shape in `roomShapes`: the potential exits that face a maze cell (odd coordinates, not reserved) and are still `Reserve.Openable`, and only onto a cell that was carved.
- **Fixed exits first.** Every `Exit` and `Door` of a template is opened. If `fill` left the cell in front of it uncarved, a passage is carved from the nearest carved cell; should that be impossible, the step throws a [`TemplatePlacementError`](#room-templates), which `pipeline` answers with a new map.
- **Then the rest.** Each room draws its number of openings from `exitsPerRoom`, the fixed ones included, and more are opened wherever they join parts of the map that are not joined yet, as described under [rooms in mazes](#rooms-in-mazes).
- **What it reserves.** Every opening goes through [`openReserved`](#mapstate), so it and the potential exits round it become `Reserve.Solid`.
- **Needs** `rooms` and `roomShapes`, **uses** `roomExits` from the steps before it, and **adds** `rooms` and `roomExits` again, with the exits of the rooms it opened appended. The rooms of the state are copied, not changed.

### `placeScatteredRooms`

`placeScatteredRooms(options?)` is a step that places the rooms of a dungeon, the default first step of [`generateRoomDungeon`](#dungeons) (see [placement of rooms](#placement-of-rooms)): the templates first, then ordinary rooms tried at random spots, one after another, until `roomCount.max` rooms are placed, the `fill` is reached with at least `roomCount.min` rooms, or 100 rooms in a row do not fit. It carves the rooms but does not open them; joining them with corridors is a later step's job. It needs a map that starts as wall, and it checks every option and template when it is made.

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

| Option              | Default         | Meaning                                                                                                                                                                                                              |
| ------------------- | --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `placement`         | `'free'`        | `'free'` or `'lattice'`, as for dungeons (see [`placement`](#placement)): lattice rooms start on odd coordinates and have odd sizes, and an even `roomSpacing` is rounded up to an odd one.                          |
| `roomWidth`         | `{ 3, 7 }`      | Room width in tiles, without the walls, 1 or more.                                                                                                                                                                   |
| `roomHeight`        | `{ 3, 7 }`      | Room height in tiles, without the walls, 1 or more.                                                                                                                                                                  |
| `sizeUniformity`    | 0               | How alike room sizes are, from 0 (anything within the ranges) to 1 (every room has the middle size).                                                                                                                 |
| `roomCount`         | `{ 1, no max }` | Number of rooms in each area, templated rooms and mirror images included, whole numbers of 0 or more. Placing stops at `max`; `fill` counts only once `min` is reached. Fewer are placed when no more fit.           |
| `roomSpacing`       | 1               | Fewest wall tiles between the floors of two rooms, 1 or more. With 1 rooms may share a wall; with 3 or more a corridor fits between them.                                                                            |
| `fill`              | 0.12            | Target share of each area covered by room floors, from 0 to 1. The last room may overshoot it.                                                                                                                       |
| `spacingUniformity` | 0               | How evenly rooms are spread, from 0 to 1: several candidate rooms are tried at once and the one farthest from the other rooms is kept, one candidate at 0 and ten at 1.                                              |
| `templates`         | none            | [`RoomTemplate`](#room-templates) objects, placed before the ordinary rooms. Their positions and areas are in the coordinates of the `area`. One that cannot be placed fails the attempt.                            |
| `templateSymmetry`  | false           | Whether templated rooms get mirror images, which follow `symmetry` always, whatever `symmetryChance` says.                                                                                                           |
| `doorChance`        | 1               | Chance that an `Exit` cell of a template gets a door, from 0 to 1. `Door` cells always do. The other openings are decided by the step that joins the rooms.                                                          |
| `symmetry`          | `'none'`        | Mirrors or rotates the rooms about the middle of their area: `'horizontal'`, `'vertical'`, `'both'` or `'rotational'`, as [layout symmetry](#layout-symmetry) does for a dungeon. A room is put in the middle first. |
| `symmetryChance`    | 1               | How often a room gets its twins, from 0 (never) to 1 (always).                                                                                                                                                       |
| `area`              | the map         | The size of the box each set of rooms goes in, an `AreaSize` (see [Areas](#areas)), on the lattice with `'lattice'` placement.                                                                                       |
| `count`             | `{ 1, 1 }`      | How many sets of rooms to place, each in its own box. More than one needs an `area` smaller than the map.                                                                                                            |

- **What is in the way.** Ordinary rooms keep `roomSpacing` from each other, from the templates, from the tiles in front of the fixed exits of templates, and from every tile that is not free (see [`isFree`](#mapstate)), such as a mine, a cave or the rooms of an earlier step; templates keep the same distance from those tiles. So rooms of an earlier step are at least two wall tiles away, with no shared wall.
- **Templates.** A template that cannot be placed throws a [`TemplatePlacementError`](#room-templates), which [`pipeline`](#pipeline) answers with a new map, up to its `attempts`. `Room.template` is an index into the `templates` of the step that placed the room.
- **What it reserves.** Every room reserves its footprint, as [`placeMineRooms`](#placeminerooms) does: walls, floor and inner doorways are `Reserve.Solid`, and potential exits are `Reserve.Openable`. The whole ring of an ordinary room, but its corners, is `Openable`. Where two rooms share a wall (`roomSpacing` 1) a tile stays `Openable` when it is a side of both rooms, and is `Solid` when it is the corner of either.
- **Uses** `rooms` and `roomShapes` from the steps before it, and **adds** both again with its own appended, with ids that follow on: in each area, templated rooms first, then ordinary ones, each with a [`RoomShape`](#placeminerooms) in `roomShapes`. Its rooms have no exits yet.

### `placePartitionedRooms`

`placePartitionedRooms(options?)` is a step that places the rooms of a dungeon by binary space partitioning, the first step of [`generateRoomDungeon`](#dungeons) with `partition` (see [placement of rooms](#placement-of-rooms)): the map, or each area, is cut in two again and again, and every part that results holds one room. The number of parts is estimated from `fill` and the typical room size and kept within `roomCount`, and grown a few times over if the rooms fall short. It takes the options of [`placeScatteredRooms`](#placescatteredrooms), and works the same way in everything else: templates, what is in the way, what it reserves, and the extras.

```ts
import { emptyMap, placePartitionedRooms, pipeline, Tile } from 'angstloch';

const { grid, rooms, roomShapes } = pipeline(
  emptyMap({ width: 61, height: 41, tile: Tile.Wall }),
  [placePartitionedRooms({ roomCount: { min: 12, max: 12 }, roomSpacing: 3 })],
  { random: mulberry32(42) },
);
```

- **`spacingUniformity`** sets how regular the partition is, from 0 to 1. At 0 the cuts, the part to cut next and the rooms inside their parts are random; at 1 the biggest part is cut next, through the middle, and rooms sit in the middle of their parts, which gives an almost regular grid.
- **What is in the way.** An ordinary room that would come within `roomSpacing` of a template or of a tile that is not free is left out, and its part of the map stays empty.
- **Symmetry.** With a `symmetry`, a room is put in the middle of the area, one half or quarter of the area is partitioned, and the rest gets the mirror images of its rooms, or with a `symmetryChance` below 1, rooms of their own in the mirrored parts.

### `placeClusteredRooms`

`placeClusteredRooms(options?)` is a step that grows the rooms of a dungeon from a seed, the first step of [`generateDigDungeon`](#grown-dungeons): each new room goes beyond a wall of a room there is, a `gap` of corridor away and facing it, so the rooms cluster and [`digCorridors`](#digcorridors) joins most of them to the room they were built off with a short corridor. It takes the options of [`placeScatteredRooms`](#placescatteredrooms) but `spacingUniformity`, and works the same way in templates, what is in the way, what it reserves and the extras. It needs a map that starts as wall, and it checks every option and template when it is made.

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
| the rest         |            | As for [`placeScatteredRooms`](#placescatteredrooms): `placement`, `roomWidth`, `roomHeight`, `sizeUniformity`, `roomCount`, `roomSpacing`, `fill`, `templates`, `templateSymmetry`, `doorChance`, `symmetry`, `symmetryChance`, `area` and `count`.                                      |

- **The seed.** When the area is the whole map and earlier steps placed rooms, the new ones grow from those. Otherwise they grow from the first template, which goes in the middle unless it has `positions` or `areas` of its own, or else from an ordinary room in the middle. When something is in the way there, that room moves to the nearest spot that fits; with a `symmetry` it must be its own mirror image, so nothing grows. The other templates are placed first, wherever they fit, and are joined later by the corridors, not grown from.
- **Growing.** Each try picks a room, a wall of it by the biases, a gap, a size and a spot along the wall, off its corners, and the new room is placed so that its floor faces that spot. A room from which 20 tries in a row failed is crowded, and is only picked again when every room is. Growing stops at `roomCount.max`, at the `fill` once `roomCount.min` is reached, or when 300 tries in a row fail.
- **Gaps and spacing.** The floors of two rooms a gap of `n` apart are `n + 2` tiles apart (a wall, the corridor and a wall), and 1 tile for a gap of 0. A gap whose rooms would be closer than `roomSpacing` is left out of the range, and a range with nothing left throws a `RangeError` when the step is made. Rooms keep `roomSpacing` from every other room too, not only from the one they are built off, and from the rooms of an earlier step two wall tiles at least, as in `placeScatteredRooms`, so a gap of 0 never joins them.
- **Symmetry.** With a `symmetry`, a new room brings its mirror images along as often as `symmetryChance` says, and all of them must fit.

### `placeCellBlocks`

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
| `area`, `count` | the whole map, `{ 1, 1 }`              | The [areas](#areas) to place blocks in, and how many. A smaller area goes on a random free spot.                                                                     |

- **Where a block goes.** On a random spot of its area where the block and a ring of one tile round it are free (see [`isFree`](#mapstate)), with two more free tiles beyond the entrance, so a corridor or a vein can reach it. Blocks of one area keep a tile apart. A block that finds no spot in 100 tries throws an ordinary `Error`, which [`pipeline`](#pipeline) answers with a new map. The entrance is at either end of the corridor, on a row (or column) of it picked at random.
- **What it reserves.** The whole block, walls and floor, is `Reserve.Solid`, but for the entrance, which is `Reserve.Openable`: no step digs into the block, and the only way in is the entrance. Rooms placed afterwards keep clear of it.
- **Rooms and groups.** Every cell is a [`Room`](#room) of kind `'cell'` in `rooms`, with its shape in `roomShapes` (its floor and the walls round it, its door a `Door` cell) and its door in `roomExits` (with `door: true`), so it has its exit already and [`digCorridors`](#digcorridors) leaves it alone. The cells come side by side along the corridor, one side after the other. Each block adds a `'cellBlock'` [group](#roomgroup) to `roomGroups`, with its footprint, corridor and entrance, and its cells point to it with `group`. The corridor is no room: `digCorridors` joins it, with the cells whose doors open onto it, as one [feature](#features), through the entrance, which gets a door by its `doorChance`; [`digVeins`](#digveins) enters it there too. A block that cannot be reached fails the map like any feature.
- **Uses** `rooms`, `roomShapes`, `roomExits` and `roomGroups` from the steps before it, if any, and **adds** all four again with its own appended, the ids following on. It needs a map that starts as wall, and it checks every option when it is made.
- **Over 200 seeds** of the run above on 80 by 50, no map failed and every map came out in one piece; 20 needed a second map. With a pillar hall and `digVeins` instead, none needed one.
- **Steps after the block.** A step after the block may build right up to its reserved ring, so a later hall can reach the tile beyond the entrance. [`digCorridors`](#digcorridors) and [`digVeins`](#digveins) then open the entrance with no corridor or vein. A later room can take that tile too, which leaves the block cut off and the map is retried: on 80 by 50 with 1 to 2 blocks, then `digPillarHalls`, `placeScatteredRooms` and `digCorridors`, about one map in four needed another, and 1 in 200 failed all three attempts (5 in 200 with guard rooms the blocks are entered through). Without the hall, about one in ten needed another and none failed.

#### Guard rooms

With `guardRoom`, a block gets a guard room by its `chance`, beside the block or with the block entered through it. With the `placement` `'beside'`, the block gets a tunnel, one tile wide, that runs on from the end of its corridor, and the guard room stands beside the tunnel, on either side at random, its door centered on the wall it shares with the tunnel. The wall between the corridor and the tunnel becomes a door, and the entrance moves to the wall beyond the far end of the tunnel, which runs `tunnel` tiles past the guard room's door. The guard room is a [`Room`](#room) of kind `'guardRoom'` in the block's group, with its shape and its door in `roomExits` (with `door: true`), like a cell. The guard room and the tunnel, each with the walls round it, are reserved `Solid` and need a free ring of one tile too; they lie outside the block's `footprint`, and the group's `tunnel` is the tunnel's floor.

With the `placement` `'through'`, the guard room stands against the end of the block, sharing its end wall, with its door in that wall at the end of the corridor (on the entrance row), and the entrance opposite, in its far wall. Its floor is `size.width` along the corridor and `size.depth` across it, centered on the entrance row, so it may be shallower than the block or reach past it. There is no tunnel, and `tunnel` is not used. With `'any'`, each guard room is beside its block or the block is entered through it, at even odds. The entrance is a potential exit (`OptionalExit`) of the guard room's shape, and the only `Openable` tile of the block. Its door is an [`Exit`](#exit) of the guard room, as for `'beside'`. [`digCorridors`](#digcorridors) joins the guard room, the corridor and the cells as one [feature](#features) through the entrance, and lists the entrance as a second exit of the guard room. [`digVeins`](#digveins) enters there too, and also records the entrance as an exit of the guard room.

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

Over 200 seeds on 80 by 50 with 1 to 2 blocks, all with a guard room beside them, then `placeScatteredRooms` and `digCorridors`, no map failed and every map came out in one piece; 17 needed a second map. With the guard room `'through'`, none failed and 12 needed a second map. With the blocks, `digPillarHalls` and `digVeins`, none needed one and none was split, for either placement. With `'through'` on the lattice (81 by 51, every step on the lattice), none failed and none needed a second map.

#### Cell blocks on the lattice

In a lattice dungeon a corridor of [`digCorridors`](#digcorridors) leaves a room only toward a tile with odd coordinates, so a block of the free placement is reached only when its entrance lands there by chance. With `placement: 'lattice'` the walls of the block fall on even coordinates and its floors on odd ones:

- The footprint starts on even coordinates and has odd sides, and its area goes on the lattice as the [areas](#areas) of the other lattice steps do.
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

### `digCorridors`

`digCorridors(options?)` is a step that joins the rooms of a dungeon with corridors and doors, the second step of [`generateRoomDungeon`](#dungeons) (see [connections](#connections)): the rooms of [`placeScatteredRooms`](#placescatteredrooms), [`placePartitionedRooms`](#placepartitionedrooms) or [`placeClusteredRooms`](#placeclusteredrooms), or of a step of your own that adds `rooms` and `roomShapes`. Only rooms that have no exits yet are joined by their own exits; a room opened by another step counts as one with the floor its doors open onto, and is joined with it as a [feature](#features). It needs a map that starts as wall, and it checks every option when it is made.

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
| `connection`             | `'nearest'` | How rooms are joined: `'nearest'`, `'bsp'` or `'bsp-random'`, as for dungeons (see [connections](#connections)).                                                                                                                           |
| `exitsPerRoom`           | `{ 1, 3 }`  | Number of exits per room, doors or not, a `Range` of 1 or more. Each room draws its own number. A room with fewer links gets more, which makes loops; a room with more shares its exits and the corridors branch off outside. Best effort. |
| `loopChance`             | 0.1         | Chance of an extra corridor between two nearby rooms that are joined already, from 0 to 1, one roll for each pair of neighbors.                                                                                                            |
| `deadEndChance`          | 0           | Chance that a corridor sprouts a branch that leads nowhere, from 0 to 1.                                                                                                                                                                   |
| `doorChance`             | 1           | Chance that an exit gets a door, from 0 to 1. Exits without a door are plain openings. The doors of templates were decided by the step that placed them.                                                                                   |
| `straight`               | 0.5         | Preference of corridors for going straight, from 0 (they wander) to 1 (they turn as little as possible).                                                                                                                                   |
| `horizontalBias`         | 0           | Weight of horizontal corridor sections against `verticalBias`. Only the ratio matters; a lone value against 0 means always.                                                                                                                |
| `verticalBias`           | 0           | Weight of vertical corridor sections against `horizontalBias`.                                                                                                                                                                             |
| `placement`              | `'free'`    | `'lattice'` keeps corridors and exits on odd coordinates, like a maze, for rooms placed on the lattice.                                                                                                                                    |
| `symmetry`               | `'none'`    | Mirrors or rotates corridors, exits and doors about the middle of the map: `'horizontal'`, `'vertical'`, `'both'` or `'rotational'`. A corridor gets its twins only where the rooms it joins have theirs.                                  |
| `symmetryChance`         | 1           | How often a corridor gets its twins, from 0 (never) to 1 (always).                                                                                                                                                                         |
| `corridorSymmetry`       | `'none'`    | Makes corridors follow the pattern of a maze: `'whirlpool'` twirls them around the middle of the map and `'snowflake'` makes them radiate from it (see [corridor symmetry](#corridor-symmetry)).                                           |
| `corridorSymmetryChance` | 1           | How strongly corridors follow `corridorSymmetry`, from 0 (not at all) to 1 (every choice of direction does).                                                                                                                               |

- **Symmetry is per step.** The rooms are mirrored by the step that places them, the corridors by this one, so a symmetric dungeon passes the same `symmetry`, `symmetryChance` and `placement` to both. Symmetric rooms with free corridors, or the other way round, are fine.
- **Where a room opens.** Exits come from each room's shape in `roomShapes`, at the potential exits that are still `Reserve.Openable`. Two ordinary rooms that share a wall (`roomSpacing` 1) are joined by one door in it, which both rooms count. Every fixed exit of a template gets a corridor.
- **What is in the way.** Corridors keep off every tile that is not free (see [`isFree`](#mapstate)): reserved tiles, and the floor, roads or water of earlier steps, so they route round them.
- **Features join too.** Every piece of floor outside the shapes of the rooms it joins is joined as well, as a stand-in room: a cavern of [`digNoiseCave`](#dignoisecave) or [`digCellularCave`](#digcellularcave), a hall of [`digPillarHalls`](#digpillarhalls), a whole mine, a maze, or the corridors of an earlier `digCorridors` (see [features](#features)). Where a corridor enters a hall or a cavern, that is an exit of it (see [ways into halls and caverns](#ways-into-halls-and-caverns)); where it enters any other stand-in, it is a plain opening and no exit.
- **Rooms that cannot be joined.** An ordinary room that cannot be joined is dropped, with its mirror images: its tiles go back to the base tile and its reservation is cleared. A templated room is never dropped: the corridors are routed again with new draws, up to 3 times in all, and then the step throws a [`TemplatePlacementError`](#room-templates), which [`pipeline`](#pipeline) answers with a new map, rooms included.
- **What it reserves.** Every exit of a room goes through [`openReserved`](#mapstate), so it and the potential exits round it become `Reserve.Solid`. Corridors reserve nothing.
- **Needs no rooms.** It **uses** `rooms`, `roomShapes` and `roomExits` from the steps before it, if any, and **adds** all three again: the dropped rooms left out, the rest renumbered with their shapes and the exits, and the new exits appended to `roomExits` (an [`Exit`](#exit) each, listed on its rooms). With no rooms to join, it joins the [features](#features) alone, such as the halls of [`digPillarHalls`](#digpillarhalls).

#### Features

Any tile outside the shapes of the rooms that have no exits yet that is not the base tile is floor of a feature, and the pieces it makes, joined along edges, are joined like rooms. A room that has exits already, such as a cell of a [cell block](#placecellblocks) or a room of [`openMazeRooms`](#openmazerooms), is part of the piece its doors open onto: rooms and floor joined by open doors count as one thing to join. A feature need not say what it is: whatever made it, `digCorridors` finds it on the map. The halls of `digPillarHalls` and the caverns of the cave steps are listed in `rooms` all the same, by their kinds `'pillarHall'` and `'cavern'`, but are joined as features, on their floor (see [halls and caverns](#room)), and get an exit wherever a corridor enters them (see [ways into halls and caverns](#ways-into-halls-and-caverns)). This makes "rooms round a cavern and a pillar hall" a list of steps:

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

- **The shape of a feature.** Its floor, and the walls that touch it from outside, which are its potential exits: a wall of rock that is free (not reserved), or one reserved `Openable` that the shape of no room to join holds, such as the entrance of a [cell block](#placecellblocks), or a potential exit of a room that has exits already, such as the entrance in the far wall of a [guard room](#guard-rooms) the block is entered through. Rock that the feature encloses and that nothing else reaches, such as a pillar, is no exit, and corridors stay out of it. The distance to a feature, which orders the links, is measured to its nearest wall, not to the box round it, since the box of a whole mine covers the map.
- **How it is joined.** Like a templated room: corridors route round its floor and walls, never through it, and it gets the exits that `exitsPerRoom` draws, loops and dead ends like any room. It is never joined by a door in a shared wall.
- **Where a corridor reaches it,** the wall turns into floor: no door, whatever `doorChance` says, and no entry in `roomExits`, which stays about rooms. Nothing is reserved there, since features reserve nothing. A wall that was reserved `Openable` is the exception: it is an entrance that a step left on purpose, so it gets a door by `doorChance` and is opened through [`openReserved`](#mapstate). It gets no entry in `roomExits`, unless it is in the shape of a room that had exits already: then it is an [`Exit`](#exit) of that room, appended to `roomExits` and listed on the room, so the room keeps a list of all its ways in. The same holds for such a wall opened with no corridor, because floor reaches it from beyond.
- **It is never dropped.** A feature that cannot be joined to the largest group of rooms fails like a templated room: the corridors are routed again, up to 3 times, and then the step throws an `Error` that names a tile of its floor, which [`pipeline`](#pipeline) answers with a new map. `digCorridors` adds no feature to `rooms`; the halls and caverns that are there already stay there, with their shapes, their ids following the renumbering.
- **Over 200 seeds** of the run above with 0, 2 and 5 templated rooms (`npm run check:dungeon`), no map failed; at 5 templated rooms, 3 seeds needed a second map, and a map took 5 to 21 ms on average.

## Walking distances

`measureDistances` measures the walk between every two places of a finished map, so that a game can put the stairs up and down far apart. It is a plain function, not a step: call it on the `grid` of any result. A place is a list of tiles: a room, a clearing, an exit, anything. The library only measures; which places to pick is up to the game. [`createRoomMap`](#createroommap) gives the floor of every room, halls and caverns included, without the rock in their boxes.

```ts
import { Tile, generateRoomDungeon, measureDistances } from 'angstloch';

const { grid, rooms } = generateRoomDungeon({ width: 80, height: 50 });
const places = rooms.map(({ x, y, width, height }) =>
  Array.from({ length: width * height }, (_, i) => ({
    x: x + (i % width),
    y: y + Math.floor(i / width),
  })),
);
const distances = measureDistances(grid, places, {
  costs: { [Tile.DeepWater]: 10 }, // the player may swim, slowly
});
distances[2]?.[5]; // the walk from room 2 to room 5, -1 if there is none
```

The result is a places by places matrix, `number[][]`: row `a`, column `b` holds the cheapest walk from the nearest tile of place `a` to the nearest tile of place `b`. It is 0 on the diagonal and between places that share a tile, and -1 where there is no way. The tiles of a place that cannot be entered (a wall in a room's box, say) are left out of it, and a place left with no tile has -1 everywhere, even to itself. A tile outside the grid throws a `RangeError`.

| Option   | Default       | Meaning                                                                                                                                                                                                                                                                                                                                                                 |
| -------- | ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `costs`  | see below     | The cost factor of entering a tile, per `Tile` value (`Partial<Record<Tile, number>>`): a positive number, or `Infinity` for a tile that cannot be entered. A given entry replaces the default for that tile only. A factor below 1 is fine, such as a road that is quicker to walk than grass. Anything else, or a key that is no `Tile` value, throws a `RangeError`. |
| `metric` | `'euclidean'` | How a step is measured (`DistanceMetric`): `'manhattan'` walks in 4 directions with steps of 1, `'chebyshev'` in 8 directions with steps of 1, and `'euclidean'` in 8 directions with diagonal steps of √2. The distance is the length of the walk along the tiles, never the straight line between the places. An unknown metric throws a `RangeError`.                |

By default `Wall` and `DeepWater` cannot be entered, and every other tile has a factor of 1, doors included. A step costs its length (1, or √2 for a euclidean diagonal) times the factor of the tile it enters, so distances may be fractional. A diagonal step may cut between two walls that touch at a corner, as in most roguelikes.

Since the tile a walk starts on is free and the one it enters last is charged, the walk from `a` to `b` and the one back differ when the tiles they end on have different factors; with the default costs the matrix is symmetric.

It runs one search from each place, from all its tiles at once (Dijkstra's, on a binary heap). On a dungeon of 80 by 50, a place takes about 0.1 ms, so 40 rooms take a few milliseconds.

## Playground

A visual playground for the generators lives in `demo/`. It is not published to NPM. Run it with `npm run dev`; the index page links to the steps page, where forests, caves, mines, mazes and dungeons are made, and to the noise page. At the bottom of the steps page is the template editor: add, duplicate and remove [room templates](#room-templates), set their count, rotations, mirroring, accuracy, positions and areas, and paint their cells by clicking and dragging with the chosen brush. Templates are kept in the browser's local storage and can be exported and imported as JSON, which is the same list of `RoomTemplate` objects that the `templates` option takes. Paste the exported JSON into the Templates field of a room card to use the templates.

All pages have a **Display** switch. `simple` paints plain colored squares. `roguelike` shows the map the way a roguelike would, as colored ASCII glyphs on a black background, in the colors of an ANSI terminal: wall `#` (#555555), floor `.` (#aaaaaa), door `+` (#aa5500), grass `.` (#00aa00), tree `T` (#55ff55), road `.` (#aa5500), bridge `#` (#aa5500), shallow water `≈` (#5555ff), deep water `≈` (#0000aa) and a floor with a potential exit `.` (#5555ff). Walls with only walls around them (diagonals included, the map edge counting as wall) are left blank.

The **Download PNG** button next to the switch saves the map as currently displayed (in either mode, at the chosen tile size) as `angstloch-steps.png` or `angstloch-noise.png`, handy for illustrating settings.

The noise page paints a `NoiseFunction` as gray squares, black for -1 and white for 1, with controls for the size, the seed, the fractal options and the transform: `scaleX`, `scaleY` and `rotation`. The fractal controls start at the defaults of `createFractalNoise`, and the scales start at 40, which is a size that shows a few features on the default map. The stats line shows the lowest, highest and mean value.

The steps page is where every map is made: a page with no fixed generator, but a list of steps that you add, order and configure one by one. The form at the top sets the size, the seed, the base tile and the number of attempts. **Add a step** picks any of [`plantTrees`](#planttrees), [`layStreams`](#laystreams), [`layRoads`](#layroads), [`placeClearings`](#placeclearings), [`placeTemplates`](#placetemplates), [`layClearingPaths`](#layclearingpaths), [`layFootbridges`](#layfootbridges), [`digFishbone`](#digfishbone), [`digVeins`](#digveins), [`digPillarHalls`](#digpillarhalls), [`digRings`](#digrings), [`placeMineRooms`](#placeminerooms), [`digCellularCave`](#digcellularcave), [`digNoiseCave`](#dignoisecave), [`placeMazeRooms`](#placemazerooms), [`digMaze`](#digmaze), [`openMazeRooms`](#openmazerooms), [`placeScatteredRooms`](#placescatteredrooms), [`placePartitionedRooms`](#placepartitionedrooms), [`placeClusteredRooms`](#placeclusteredrooms), [`placeCellBlocks`](#placecellblocks), [`digCorridors`](#digcorridors) and [`openExits`](#openexits) and appends a card with a control for each of its options (a blank angle means a random one, ranges are a min and a max, the road and clearing cards take exact roads and clearings as JSON, the `placeMineRooms`, `placeMazeRooms`, `placeScatteredRooms`, `placePartitionedRooms` and `placeClusteredRooms` cards take templates as JSON, as the template editor exports them). A card has buttons to move it up or down and to remove it, **Load a forest** starts from the steps of a forest, **Load a mine** sets the base tile to wall and starts from the step of [`generateMine`](#mines) with its defaults (`digFishbone`), **Load a mine with caverns** adds `digNoiseCave` with the defaults of the preset's [caverns](#caverns) (`'beside'`, sides of 12 to 24, scales of 7, the largest cavern only) and `digVeins`, **Load a cave** and **Load a noise cave** set it to wall too and start from the steps of [`generateCave`](#caves) (`digCellularCave` and `digVeins`) and of [`generateNoiseCave`](#noise-caves) (`digNoiseCave` and `digVeins`) with their defaults, **Load a maze** sets it to wall and starts from the step of [`generateMaze`](#mazes) with its defaults (`digMaze`), **Load a maze with rooms** from `placeMazeRooms` (3 to 5 rooms), `digMaze`, `openMazeRooms` and `openExits` on the lattice, **Load a dungeon** sets it to wall and starts from `placeScatteredRooms` and `digCorridors` with their defaults, **Load a grown dungeon** sets it to wall and the size to 61 by 41 and starts from the steps of [`generateDigDungeon`](#grown-dungeons) with their defaults (`placeClusteredRooms` and `digCorridors`), **Load a dungeon with a hall and a cavern** sets it to wall and 61 by 41 and starts from a pillar hall of 16 by 12, a noise cavern of 14 to 18 by 10 to 14 (largest piece only), `placeScatteredRooms` and `digCorridors`, which joins the hall and the cavern as [features](#features), **Load a cave with rooms** from a `digCellularCave` cavern of 24 by 16, 4 to 6 rooms of `placeScatteredRooms` and `digVeins`, which enters the rooms through their potential exits, **Load a prison** sets it to wall and starts from 1 to 2 blocks of [`placeCellBlocks`](#placecellblocks) with a guard room, `placeScatteredRooms` and `digCorridors`, **Load a lattice prison** does the same on the lattice, every step with `placement: 'lattice'`, and sets the size to 61 by 41, and **Remove all** starts from nothing. Every change runs the pipeline again, so a step put in the wrong order shows the error of [`pipeline`](#pipeline) under the map, and a bad option shows its `RangeError`. **Show after step** picks the map after any step of the last attempt, starting with the base, through `onStep`. It shows the last step by default and keeps following it as steps are added, moved or removed, until you pick an earlier one; picking the last again makes it follow again. The overlays, drawn from what the steps reported up to the chosen step, are **Mark clearing centers**, **Outline templates**, **Outline halls** (the box of every room of kind `'pillarHall'`, in yellow), **Outline caverns** (the area of every `'cave'` group of `digCellularCave` and `digNoiseCave`, in cyan), **Mark tunnels** (a small square on the middle line of every passage of the mine steps, red for a main shaft and blue for the rest), **Outline rooms** (the floor of every room, cells included, but the halls and caverns, in green), **Outline cell blocks** (the footprint of every cell block, its tunnel and its guard room in magenta, and its entrance in yellow, on by default), **Show room gaps** (the openings of rooms that got no door, as a floor with a potential exit), **Mark maze start** (a green square on the `start` of `digMaze`), **Mark junctions**, **Show reserved** (the [reserved](#mapstate) tiles, red where `Solid` and cyan where `Openable`), **Mark road exits**, **Show grown roads** (a small magenta dot on every tile of a road as it was grown, before the streams bent it) and **Show crossing plans** (outlined squares on the planned ends of each road and on the waypoints of its crossings: cyan where the road turns onto and off the straight run, yellow at both banks), the last two fed by `trace`. **Show walking distances** writes the walk of [`measureDistances`](#walking-distances) from a picked place to the center of every other place the steps reported up to the chosen step: rooms, halls and caverns included, by their boxes, clearings by their centers, and exits. Click a place on the map to measure from it; it is outlined in white, the farthest place is written in red, the places at least 70% as far in yellow, and `×` marks a place with no way to it. **Distance metric** and **Distance costs** (JSON keyed by tile number, such as `{"7": 10}` to swim deep water, and `1e999` for `Infinity`) are its options, and the line above the map names the farthest places and how long the measuring took. Point at a room, a hall or a cavern on the map and the line right above the map says what it is, from [`createRoomMap`](#createroommap): its kind, id, group, box, and how many exits and doors it has, and how many of them it shares with another room; its floor is tinted and its exits outlined in magenta. The stats line gives the attempts, the failures and how many roads, streams, bridges, clearings, templates, passages, rooms, room exits and room groups there are, the rooms counted by `kind`, and the regions of floor of the finished map when it has floor, and the failures are listed under the map; a template that finds no room is an easy way to see a retry. The planted tile of `plantTrees` and the base tile can be tree, wall, floor or grass, so a steppe of rocks on floor is a click away. In the `roguelike` display, grass is a green `.` and a tree a darker green `T`.

## Development

```
npm run dev        # playground
npm run build      # build the library to dist/
npm test           # unit tests with coverage
npm run typecheck
npm run lint
npm run format
```

## Why “Angstloch”?

_Angstloch_ is German for “fear hole”, and the name is not a random word. In medieval castles it was the hatch leading to a dark pit at the bottom of the keep (the _Bergfried_) or the main tower. The pit served as a secure store and, during a siege, as a last place of refuge - and in some cases, a dungeon. A fitting name for a library that digs dungeons.

## License

BSD-3-Clause
