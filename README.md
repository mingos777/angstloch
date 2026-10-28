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
- [`generateDigDungeon`](#the-digger): dungeons that are dug: corridors and rooms grow out of a first room.
- [`pipeline`](#composing-maps): builds a map from an empty base and a list of steps, with retries. The generators are being rebuilt on it, one at a time.

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

const { grid, start, exits } = generateMaze({ width: 41, height: 21 });
console.log(grid.toString());
```

A maze is carved with a recursive backtracker. Corridors run along odd coordinates, so odd dimensions leave a single-tile wall frame.

### `MazeOptions`

| Option            | Default              | Description                                                                                                                                               |
| ----------------- | -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `width`, `height` | required             | Map size in tiles, at least 3.                                                                                                                            |
| `random`          | `Math.random`        | Source of randomness.                                                                                                                                     |
| `horizontalBias`  | `0`                  | Weight of horizontal corridors against `verticalBias`. Only the ratio matters, so set both; a lone value against 0 means always.                          |
| `verticalBias`    | `0`                  | Weight of vertical corridors against `horizontalBias`.                                                                                                    |
| `loopChance`      | `0`                  | Chance of turning a dead end into a loop: 0 is a perfect maze, 1 a braid maze.                                                                            |
| `fill`            | `1`                  | Fraction of the maze to carve, from 0 to 1.                                                                                                               |
| `symmetry`        | `'none'`             | `'whirlpool'` twirls corridors around the map center, `'snowflake'` makes them radiate from it.                                                           |
| `symmetryChance`  | `1`                  | How strongly symmetry is enforced, from 0 to 1.                                                                                                           |
| `straight`        | `0`                  | Preference for continuing straight, from 0 to 1.                                                                                                          |
| `minExits`        | `0`                  | Minimum number of exits to add on the map border.                                                                                                         |
| `maxExits`        | `minExits`           | Maximum number of exits.                                                                                                                                  |
| `start`           | near center          | Where carving starts. Must be a cell with odd coordinates. Rooms keep away from it, and without a `start` the nearest cell that is not in a room is used. |
| `templates`       | none                 | Prefabricated [room templates](#templates-in-mazes), placed first.                                                                                        |
| `rooms`           | none                 | Rectangular [rooms](#rooms-in-mazes) to place in the maze.                                                                                                |
| `exitsPerRoom`    | `{ min: 1, max: 3 }` | Number of openings per room, a `Range`. Must be at least 1.                                                                                               |
| `doorChance`      | `1`                  | Chance that a room's opening gets a door, from 0 to 1. Openings without a door are plain gaps in the wall.                                                |

### `MazeResult`

| Field       | Description                                                                                                                                                    |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `grid`      | The maze.                                                                                                                                                      |
| `start`     | The cell where carving started.                                                                                                                                |
| `caverns`   | The caverns that were dug, each as an `Area`: the box it was made in. Empty without `caverns`.                                                                 |
| `rooms`     | The rooms of the mine, templated ones first, with the same shape as for [mazes](#mazeresult). Empty without `rooms` and `templates`.                           |
| `roomExits` | The openings of the rooms, each an [`Exit`](#exit) whose `door` says whether it got a door. They are not the `exits` on the map border.                        |
| `exits`     | Door tiles on the map border, one per exit.                                                                                                                    |
| `rooms`     | The [rooms](#rooms-in-mazes), in the order they were placed. Empty without the `rooms` option. Each is a [`Room`](#room) whose `exits` index into `roomExits`. |
| `roomExits` | The openings of the rooms into the maze, each an [`Exit`](#exit) whose `door` says whether it got a door. They are not the `exits` on the map border.          |

### Rooms in mazes

```ts
import { generateMaze } from 'angstloch';

const { grid, rooms, roomExits } = generateMaze({
  width: 61,
  height: 41,
  rooms: { count: { min: 3, max: 5 }, width: { min: 5, max: 9 } },
  doorChance: 0.5,
});
```

Rooms are placed first and the maze is carved around them. Rooms sit on the lattice of the maze: they start on odd coordinates and have odd dimensions. At least three wall tiles separate the floors of two rooms, which leaves room for a maze cell between them. A room's walls are part of the maze's walls, and it opens onto the maze through gaps in them.

`MazeRoomOptions`, the value of `rooms`:

| Option           | Default              | Description                                                                                          |
| ---------------- | -------------------- | ---------------------------------------------------------------------------------------------------- |
| `count`          | `{ min: 1, max: 1 }` | Number of rooms, a `Range`. The number is drawn from it. Fewer rooms are placed when no more fit.    |
| `width`          | `{ min: 3, max: 7 }` | Room width in tiles, a `Range`. Only odd widths are used.                                            |
| `height`         | `{ min: 3, max: 7 }` | Room height in tiles, a `Range`. Only odd heights are used.                                          |
| `sizeUniformity` | `0`                  | How alike room sizes are, from 0 (anything within the ranges) to 1 (every room has the middle size). |

Each room draws its number of openings from `exitsPerRoom`, and every opening is a gap in the wall that leads to a maze cell, opened as a door with the chance `doorChance`. The result stays connected: when a room cuts off a stretch of the maze, or leaves a room that nobody reaches, extra openings are made where they join the parts, so a room may have more openings than `exitsPerRoom` asks for. A room gets fewer when no carved maze cell is next to its walls, which happens with a low `fill`.

Without `rooms` and `templates` the maze is generated exactly as before. Rooms cannot be combined with a `symmetry`, which throws a `RangeError`, since rooms break the pattern. Invalid `rooms` values, `exitsPerRoom` or `doorChance` also throw a `RangeError`. `fill` counts only the cells outside the rooms.

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
  templates: [closet],
});
```

`templates` takes the same [`RoomTemplate`](#room-templates) objects as the dungeons, with the same `count`, `rotate`, `mirror`, `positions`, `areas` and `positionAccuracy`. They are placed first, before the ordinary `rooms`, which keep away from them, and the maze is carved around them. A template that cannot be placed throws a [`TemplatePlacementError`](#room-templates). `templateSymmetry` does not exist for mazes.

A maze is a lattice, so templates are placed [on the lattice](#placement): a template's bounding box starts on even coordinates, its dimensions must be odd, and every `Exit` and `Door` that leads outside must face a tile with odd coordinates, which is where the maze has its cells. A template that has no variant that fits throws a `RangeError`. At least three wall tiles separate a template's footprint from another room's.

- The exit cells of a template open straight onto a maze cell. `Door` cells are always doors and `Exit` cells are doors with the chance `doorChance`. Every `Exit` and `Door` is opened, and if `fill` left the cell in front of it uncarved, a passage is carved from the nearest carved cell. Should that be impossible, a `TemplatePlacementError` is thrown.
- `OptionalExit` cells are opened as far as `exitsPerRoom` asks, counting the fixed exits. More are opened where they join parts of the map that would be cut off.
- The maze never digs through a template's walls or floors. `Unused` cells are free space like any other, so the maze may wind into a notch of a template's bounding box that is open to the outside.
- `start` must not be inside a templated room, which throws a `RangeError`. Without a `start`, the nearest free cell to the middle is used.

Templated rooms are in `rooms`, listed before the ordinary ones, with `template`, `rotation` and `mirrored` set, and their openings are in `roomExits`. `rooms.count` counts only ordinary rooms. A `symmetry` cannot be combined with `templates`.

## Caves

```ts
import { generateCave } from 'angstloch';

const { grid, regions } = generateCave({ width: 60, height: 30 });
console.log(grid.toString());
console.log(`the largest cavern has ${String(regions[0]?.size)} tiles`);
```

A cave is grown with a cellular automaton. The map starts as random noise, with each tile a wall with the chance `fillChance`. Then it is smoothed over `iterations` passes. In each pass, every tile counts its neighbors that are walls, and all tiles change at the same time:

- a floor tile turns into a wall when it has at least `birthLimit` wall neighbors;
- a wall tile stays a wall when it has at least `survivalLimit` wall neighbors, and turns into floor otherwise.

Tiles outside the map count as walls. The default limits are the classic 4-5 rule on 8 neighbors, which gives open, rounded caverns, and 3-2 on 4 neighbors. Raising `fillChance` or lowering the limits gives more wall. Fewer `iterations` gives rougher caves.

The automaton usually leaves several caverns that are not joined to each other. Two cleanup steps deal with that, after the smoothing: `minRegionSize` fills in the small pockets, and `connect` decides what happens with the rest. Caverns are groups of floor tiles that touch along an edge; tiles that only touch diagonally are separate caverns.

### Joining the caverns

`connect` takes one of three values:

- `'tunnel'` (the default) digs tunnels until the whole map is one cavern. The largest cavern is joined to the cavern nearest to it first, then the joined group to the nearest one after that, and so on. That keeps tunnels short, and joins caverns in a tree-like way, with no deliberate loops (see `tunnelLoops` below). A tunnel runs from the closest pair of tiles of the two caverns, and may cross a third cavern on its way, which joins that one as well. It only ever turns rock into floor, so no floor tile is lost.
- `'largest'` fills in every cavern but the largest.
- `'none'` leaves the caverns as the automaton made them.

`minRegionSize` applies first, so a pocket that is too small is filled in and never gets a tunnel. The shape of tunnels is set by `tunnelStyle`:

- `'winding'` (the default) digs a random walk from one end to the other. Each step either heads for the other end or goes in a random direction, and `tunnelWindiness` sets how often it wanders: with 0, the tunnel runs close to a straight line with only small jitters, and with 1 it meanders a lot. The tunnels are longer for it.
- `'direct'` digs a line with at most one bend, horizontal first or vertical first at random. `tunnelWindiness` has no effect.

`tunnelWidth` makes the tunnels wider, which suits caves that are meant to be roomy. With `borderWalls`, tunnels never touch the outermost ring of tiles.

#### Loops

A tree of tunnels means one way between any two caverns, so a cave can feel like a corridor with side rooms. `tunnelLoops`, from 0 to 1, adds extra tunnels once the caverns are joined. It only applies to `connect: 'tunnel'`, and it defaults to 0, which adds none.

Each cavern is paired with its three nearest neighbors, measured across the rock between them. A pair is only worth a tunnel when it is a real shortcut: walking over the floor between the closest tiles of the two caverns must take much longer than the gap itself (more than three times the gap plus four steps). So caverns that a short tunnel joins already are skipped, and loops appear where the map would force a long detour. Every pair that passes gets one roll, and with the chance `tunnelLoops` it gets a tunnel, dug like the others, with the same `tunnelStyle`, `tunnelWidth` and `tunnelWindiness`. At 1, every such shortcut is dug. Caverns a single wall apart can get a short tunnel, which reads as a gap in the wall. Tunnels may cross other caverns, as the first ones can. The shortcuts are listed before any loop is dug, but each is checked again when its turn comes, so a loop that an earlier one has made pointless is not dug.

### Symmetry

`layoutSymmetry` makes the cave look the same when mirrored or turned. It takes the same values as the [dungeons](#layout-symmetry): `'none'` (the default), `'horizontal'` (left to right), `'vertical'` (top to bottom), `'both'` (four mirrored quarters) or `'rotational'` (turned by 180°, so it looks the same upside down). The axes run through the center of the map; on a map with an odd width or height, the middle column or row is its own mirror image.

The symmetry is made in the starting noise. The tiles are filled in row by row. The first tile of each set of mirror images is random, as usual, and each of its twins copies it with the chance `layoutSymmetryChance`, and is random otherwise. Then the automaton runs as usual. Its rules treat all directions alike, so a symmetric start stays symmetric. At 1 (the default) the cave is perfectly symmetric. At 0 the noise is plain random, and the symmetry has no effect. In between, the cave is roughly symmetric: the stray tiles are mostly smoothed over, so it looks more balanced than the chance suggests, and a value near 0.9 gives a cave that is clearly symmetric but not exact.

```ts
const { grid } = generateCave({
  width: 61,
  height: 41,
  layoutSymmetry: 'both',
  layoutSymmetryChance: 0.9,
});
```

#### Symmetric tunnels

With `connect: 'tunnel'`, a symmetric start still leaves caverns to join, and a tunnel dug at random would spoil the symmetry. So every tunnel, the ones of `tunnelLoops` included, is copied onto its twins: once it is dug, every tile it turned into floor is turned into floor at its mirror images, too. The copy is made with the chance `tunnelSymmetryChance`, rolled once for every tunnel, so a tunnel either gets all its twins or none. It is a separate option from `layoutSymmetryChance` on purpose: how strictly the tunnels follow the symmetry is a matter of taste, so you can have a cave with a symmetric look and tunnels of its own, or a symmetric cave with a few stray tunnels. At 1 (the default) and with `layoutSymmetryChance` at 1, the finished cave is perfectly symmetric. `tunnelSymmetryChance` has no effect without a `layoutSymmetry`, or with another `connect` than `'tunnel'`.

Things to know:

- Symmetry changes what the generator makes, so the same seed gives another cave than without it.
- `minRegionSize` keeps the symmetry, since twin caverns are equally large. `connect: 'largest'` fills in all but one cavern, so it also fills in the twin of the one it keeps, and the result is symmetric only if the largest cavern is its own twin, for example because it crosses an axis.
- Exits follow the symmetry as well, see [Exits](#exits).

### `CaveOptions`

| Option                 | Default                                | Meaning                                                                                                                                                |
| ---------------------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `width`                |                                        | Map width in tiles. Required.                                                                                                                          |
| `height`               |                                        | Map height in tiles. Required.                                                                                                                         |
| `random`               | `Math.random`                          | Source of randomness.                                                                                                                                  |
| `fillChance`           | 0.45                                   | Chance that a tile starts as a wall, from 0 to 1.                                                                                                      |
| `iterations`           | 4                                      | Number of smoothing passes. 0 leaves the raw noise.                                                                                                    |
| `neighborhood`         | `'moore'`                              | `'moore'` counts the 8 surrounding tiles, `'von-neumann'` the 4 that share an edge.                                                                    |
| `birthLimit`           | 5 for `'moore'`, 3 for `'von-neumann'` | Wall neighbors needed to turn a floor tile into a wall. A whole number, 0 or more.                                                                     |
| `survivalLimit`        | 4 for `'moore'`, 2 for `'von-neumann'` | Wall neighbors needed for a wall tile to stay a wall. A whole number, 0 or more.                                                                       |
| `borderWalls`          | `true`                                 | Keeps the outermost ring of tiles solid wall.                                                                                                          |
| `minRegionSize`        | 0                                      | Fills in every cavern smaller than this many tiles. 0 keeps all.                                                                                       |
| `connect`              | `'tunnel'`                             | What to do with caverns that are not joined: `'tunnel'` digs tunnels between them, `'largest'` fills in all but the largest one, `'none'` leaves them. |
| `tunnelStyle`          | `'winding'`                            | The shape of tunnels: `'winding'` meanders, `'direct'` has at most one bend.                                                                           |
| `tunnelWidth`          | 1                                      | The width of tunnels in tiles. A whole number, 1 or more.                                                                                              |
| `tunnelWindiness`      | 0.5                                    | How much `'winding'` tunnels wander, from 0 to 1.                                                                                                      |
| `tunnelLoops`          | 0                                      | The chance, from 0 to 1, of an extra tunnel where it would be a shortcut between caverns. Applies to `connect: 'tunnel'` only.                         |
| `layoutSymmetry`       | `'none'`                               | Mirrors or turns the starting noise about the center of the map: `'none'`, `'horizontal'`, `'vertical'`, `'both'` or `'rotational'`.                   |
| `layoutSymmetryChance` | 1                                      | How often a tile of the noise copies its twin, from 0 to 1. Only matters with a `layoutSymmetry`.                                                      |
| `tunnelSymmetryChance` | 1                                      | How often a tunnel, a loop included, gets twins that follow `layoutSymmetry`, from 0 to 1. Applies to `connect: 'tunnel'` only.                        |

The limits are counted out of 8 neighbors for `'moore'` and out of 4 for `'von-neumann'`, which is why the defaults differ. A limit above the number of neighbors can never be reached, so a `birthLimit` of 9 stops floor from ever turning into a wall. A non-positive size, a `fillChance`, `tunnelWindiness`, `tunnelLoops`, `layoutSymmetryChance` or `tunnelSymmetryChance` outside 0 to 1, an unknown `layoutSymmetry`, a `tunnelWidth` that is not a whole number of at least 1, or a limit, `minRegionSize` or `iterations` that is not a whole number of at least 0 throws a `RangeError`.

### Exits

`minExits` and `maxExits` add openings on the map border, for a game to join the cave to its surroundings. The number of exits is picked between the two. An exit is a `Door` tile on the border and, unless a cavern already reaches the border, a straight tunnel from it to the nearest floor.

Each exit goes on a random side of the map. On that side, the exit is put where the tunnel is shortest, going straight in from the border. Exits are never next to each other, corners are never used, and a side with no floor in line with its border is skipped. When no side can reach any floor, fewer exits than asked for are made, which happens on a map with no floor at all. Exit tunnels are one tile wide whatever `tunnelWidth` is, and they are part of the cavern that they reach.

With a `layoutSymmetry`, an exit gets twins with the chance `layoutSymmetryChance`: an exit and its twins are dug together, one at each mirror image of the exit, and each twin gets the straight tunnel of its own. An exit on an axis is its own twin. The number of exits counts the twins, so `maxExits` is never exceeded, and a set of twins that would not fit in the exits that are left, or that would put two doors side by side (the two middle tiles of a side of even length, for example), is left out. The generator then draws another exit, and gives up after ten such failures in a row, so a cave with a small `maxExits` can have fewer exits than `minExits`. A twin that has no floor in line with its border is left out, which can only happen when the cave is not perfectly symmetric.

### `CaveResult`

- `grid`: the map, made of `Wall` and `Floor` tiles, and a `Door` tile for each exit.
- `regions`: the caverns of the final map, sorted from the largest to the smallest, so `regions[0]` is the largest and a good place for the player to start. Each has:
  - `size`: the number of floor tiles.
  - `center`: the floor tile nearest to the cavern's center of mass. A bent cavern's middle may be rock, so this is always a floor tile.
  - `bounds`: the smallest `Area` (`x`, `y`, `width`, `height`) that holds the cavern.

  Caverns that `minRegionSize` or `connect` filled in are not listed, and caverns joined by tunnels are listed as one. The list is empty when the map has no floor.

- `exits`: the door tiles on the map border, one per exit. Empty without `minExits`.

```ts
const { grid, regions } = generateCave({
  width: 60,
  height: 30,
  connect: 'largest',
});
const spawn = regions[0]?.center;
```

### Noise caves

```ts
import { generateNoiseCave } from 'angstloch';

const { grid, regions } = generateNoiseCave({ width: 60, height: 30 });
const { grid: tunnels } = generateNoiseCave({
  width: 60,
  height: 30,
  shape: 'veins',
  fill: 0.8,
});
```

`generateNoiseCave` makes a cave from [noise](#noise) instead of an automaton. Every tile gets a score from the noise at its center, and the tiles with the lowest scores become walls. The result goes through the same steps as the automaton's: `minRegionSize`, `connect`, exits, symmetry and `borderWalls` all work as described above, take the same values and have the same defaults, and it returns the same `CaveResult`. Only the way the starting map is made differs.

`fill` is the share of the tiles that become wall, from 0 to 1. It is not a chance per tile, and not a threshold of the noise: the generator looks at the noise of all the tiles and picks the threshold that gives that share, so `fill: 0.45` gives about 45% wall (to within a tile) whatever the scales, the octaves or the noise. With `borderWalls`, the outer ring is walled on top of that, and `fill` counts the inner tiles only.

`shape` says which part of the noise becomes floor:

- `'blobs'` (the default) makes floor of the high part of the noise, which gives rounded caverns with ragged edges.
- `'veins'` makes floor of the part nearest the midpoint of the noise, so the floor follows the places where the noise crosses 0. That gives a network of winding corridors of about even width, with junctions and dead ends, instead of caverns. `fill` still sets the share of walls, so a higher `fill` makes thinner veins: try 0.7 to 0.9. Veins can leave pockets, which `connect` and `minRegionSize` deal with as for any cave.

`cornerBias` rounds off the corners of the map. Without it, the noise knows nothing about the map, so a cavern can run right into a corner and end in a sharp wedge. With it, the score of every tile near a corner is lowered, by more than the whole range of the noise in the corner itself and by less and less further out, so the corners turn into wall whatever the noise says, and the caverns close off smoothly in a curve before they get there. The value is a distance in tiles from the corner: 4 (the default) pulls the walls in from a quarter circle of radius 4 around each corner, and 0 turns it off and gives the plain threshold. The distance is round, so the corners come out rounded, and straight edges are left alone, so a cavern can still run along the border. The pull applies before `fill` picks the threshold, so `fill` stays the share of walls and a stronger pull leaves less wall elsewhere, and it keeps a symmetry exact. It works without `borderWalls` as well, and with both shapes.

The look of the noise is set with the same options as the [forest](#forestoptions) has: `scaleX` and `scaleY` (the size of a feature in tiles, 12 by default, which suits caverns; larger values make broader ones), `rotation` in degrees, and the layers of the built-in noise, `octaves` (3 by default, which roughens the edges; with 1 the shapes are smooth blobs), `persistence` (0.5) and `lacunarity` (2). Different scales on the two axes and a rotation stretch the caverns, which makes passages that run in one direction. A `noise` function replaces the built-in simplex noise: it takes positions in noise units and returns a number from -1 to 1. The scales and the rotation apply to it, and the octaves do not, so wrap it in `createFractalNoise` for layers. A custom noise should vary over the map, since the tiles that tie at the threshold all become floor, and a constant noise gives a map of floor, or of walls at a `fill` of 1.

`iterations` runs that many passes of the cave automaton over the thresholded noise (the 4-5 rule on 8 neighbors), which rounds off specks and corners. It defaults to 0, which leaves the noise as it is. The smoothing eats thin corridors, so it suits `'blobs'` and spoils `'veins'`.

`layoutSymmetry` works by sampling: a tile reads the noise at its first twin (row by row) with the chance `layoutSymmetryChance`, and at its own position otherwise. The walls are picked after that, so `fill` stays accurate. At 1 (the default) the noise itself is symmetric, and so is the cave, and tunnels and exits follow it as for the automaton's cave (see [Symmetry](#symmetry) and [Exits](#exits)).

#### `NoiseCaveOptions`

| Option                 | Default       | Meaning                                                                                                                              |
| ---------------------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `width`                |               | Map width in tiles. Required.                                                                                                        |
| `height`               |               | Map height in tiles. Required.                                                                                                       |
| `random`               | `Math.random` | Source of randomness. It seeds the built-in noise and rolls the symmetry, the tunnels and the exits.                                 |
| `shape`                | `'blobs'`     | `'blobs'` makes floor of the high part of the noise, `'veins'` of the part around its midpoint.                                      |
| `fill`                 | 0.45          | The share of the tiles that become wall, from 0 to 1.                                                                                |
| `cornerBias`           | 4             | Rounds off the corners: the distance in tiles from a corner over which the walls are pulled in. A whole number, 0 or more. 0 is off. |
| `scaleX`               | 12            | Size in tiles of a feature of the noise along the x axis, before rotation. A positive number.                                        |
| `scaleY`               | 12            | Size in tiles of a feature of the noise along the y axis, before rotation. A positive number.                                        |
| `rotation`             | 0             | Clockwise rotation of the noise in degrees.                                                                                          |
| `octaves`              | 3             | Layers of the built-in noise. A whole number, 1 or more.                                                                             |
| `persistence`          | 0.5           | How much each layer counts against the one before it, from 0 to 1. Only matters with more than one octave.                           |
| `lacunarity`           | 2             | How much finer each layer is than the one before it. A positive number. Only matters with more than one octave.                      |
| `noise`                | simplex       | A `NoiseFunction` to use instead of the built-in noise. The scales and the rotation apply to it, the layers do not.                  |
| `iterations`           | 0             | Passes of the cave automaton to smooth the thresholded noise with. A whole number, 0 or more.                                        |
| `borderWalls`          | `true`        | As in [`CaveOptions`](#caveoptions).                                                                                                 |
| `minRegionSize`        | 0             | As in `CaveOptions`.                                                                                                                 |
| `connect`              | `'tunnel'`    | As in `CaveOptions`.                                                                                                                 |
| `tunnelStyle`          | `'winding'`   | As in `CaveOptions`.                                                                                                                 |
| `tunnelWidth`          | 1             | As in `CaveOptions`.                                                                                                                 |
| `tunnelWindiness`      | 0.5           | As in `CaveOptions`.                                                                                                                 |
| `tunnelLoops`          | 0             | As in `CaveOptions`.                                                                                                                 |
| `layoutSymmetry`       | `'none'`      | As in `CaveOptions`, applied to the sampling of the noise.                                                                           |
| `layoutSymmetryChance` | 1             | How often a tile reads the noise at its twin, from 0 to 1.                                                                           |
| `tunnelSymmetryChance` | 1             | As in `CaveOptions`.                                                                                                                 |
| `minExits`             | 0             | As in `CaveOptions`. See [Exits](#exits).                                                                                            |
| `maxExits`             | `minExits`    | As in `CaveOptions`.                                                                                                                 |

A `RangeError` is thrown for a non-positive size, a `fill`, `persistence` or any chance outside 0 to 1, a non-positive `scaleX`, `scaleY` or `lacunarity`, an `octaves` that is not a whole number of at least 1, or an `iterations` or `cornerBias` that is not a whole number of at least 0, and for the other invalid options as in `CaveOptions`.

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

const { grid, density } = generateForest({ width: 120, height: 70 });
console.log(grid.toString());
```

A forest is made from a [noise](#noise) map that says how dense the trees are: dense where the noise is high and open where it is low. Every tile then gets a tree with the chance that the map gives it. So a wood is a place where trees are likely, not a solid block, and its edge is ragged. Trees are `Tile.Tree` and the ground between them is `Tile.Grass`. Whether a tree blocks movement or sight is for the game to decide; the generator makes no connectivity guarantee.

The chance of a tree is set at the two ends of the noise: `minDensity` where the noise is at its lowest and `maxDensity` where it is at its highest. In between the chance rises evenly with the noise. With the defaults, 0 and 0.25, the lowest parts are bare and the thickest woods are a quarter full of trees, so the trees stand apart. Raise `maxDensity` for tighter woods: 1 packs the thickest parts solid. Both values can be anything from 0 to 1, and `minDensity` may be the larger of the two, which puts the trees where the noise is low. The noise is sampled at the center of each tile, and `random` both seeds the built-in noise and rolls the chance for each tile, so the same seed always gives the same forest. The noise rarely reaches the very ends of its range, so the chances rarely do either.

### Roads

```ts
const { grid, roads, exits } = generateForest({
  width: 120,
  height: 70,
  roads: { angle: 20, width: { min: 3, max: 4 }, windiness: 0.5 },
});
```

Without `roads` the forest has no roads. With it, a main road runs through the forest from one edge of the map to the opposite one, and no trees grow on it: road tiles are `Tile.Road` (or `roadTile`). The roads are laid before the trees, so the trees fill in around them.

The road is laid through a random point near the middle of the map, at the `angle`, and is then followed in both directions until it leaves the map. The angle is in degrees, clockwise from east, like `rotation`: 0 runs from left to right, 90 from top to bottom and 45 from the top left towards the bottom right. `'random'` picks an angle. The road winds as far as `windiness` says: its centerline is pushed to either side by smooth noise, which makes gentle bends and not jitter. At 1 it strays up to 12 tiles from the straight line. Its width is picked from the `width` range, in whole tiles, and the road is rounded at its edges when it is wide. Where a road leaves the map, it is laid as if it went on a little past the border, so the border cuts it at the angle it leaves at instead of ending it in a block; a road that leaves at a shallow angle tapers along the edge. Its centerline in `roads` and its tile in `exits` stay on the map.

| Road option | Default              | Meaning                                                                                           |
| ----------- | -------------------- | ------------------------------------------------------------------------------------------------- |
| `angle`     | `'random'`           | Direction of the main road in degrees, clockwise from east, or `'random'`.                        |
| `width`     | `{ min: 3, max: 3 }` | Width of the main road, and of the crossings, in tiles, a `Range` of whole numbers of at least 1. |
| `windiness` | 0.3                  | How much every road winds, from 0 (straight) to 1.                                                |

An invalid angle, width or windiness throws a `RangeError`.

#### Clearance

By default the trees grow right up to the road, which can look like a hedge. `clearance` keeps a strip beside every road free of trees, the main road, the crossings and the branches alike. It is a number of tiles, and it is an option of the forest and not of `roads`, since it is about the trees. No tree grows within `clearance` tiles of a road tile, in any direction. With the default `distance`, a step to a diagonal neighbor counts as one tile (see [Falloff and distance](#falloff-and-distance) for the other ways of measuring). So a clearance of 1 keeps trees off all eight neighbors of every road tile, diagonals included, a clearance of 2 clears a strip two tiles wide on either side, and so on. The strip has a hard edge: beyond it the trees grow as thick as they would have anyway.

The `density` in the result is 0 on the tiles that are kept clear, since it is the chance that was used (see also [Falloff and distance](#falloff-and-distance)). The tiles of the road keep the density that the noise gave them. With a `clearance` of 0, which is the default, or without roads, no tiles are cleared. A `clearance` that is not a whole number of at least 0 throws a `RangeError`.

#### Falloff and distance

`clearance` has a hard edge. `falloff` softens it: beyond the clear strip, the trees thicken gradually until they are at full density again. It is a number of tiles, and the chance of a tree grows in equal steps over them, so with a `falloff` of 3 the first tile past the clearance has a quarter of its chance, the next half, the next three quarters, and the one after that all of it. The two options are independent: a `falloff` with a `clearance` of 0 thins the trees right next to the road, and a `clearance` with no `falloff` is the hard strip. The tiles of the road keep their own density. The same ramp thins the trees beyond the edge of a [clearing](#clearings). Without roads or clearings, `falloff` does nothing.

`distance` says how the distance to a road is measured, for both `clearance` and `falloff`:

- `'chebyshev'` (the default) counts a diagonal step as one tile, which makes square verges.
- `'manhattan'` counts only orthogonal steps, which makes diamonds. It suits games where diagonal movement is not possible.
- `'euclidean'` measures the straight line between tile centers, so a diagonal step is about 1.41 tiles, which makes round verges. It suits games where a diagonal step costs more than an orthogonal one. The falloff is then continuous: tiles at different distances get slightly different chances.

`distance` applies even when the `falloff` is 0, since it shapes the `clearance`, and it measures the distance to a clearing too. Without roads or clearings it does nothing. A `falloff` that is not a whole number of at least 0, or a `distance` that is not one of the three, throws a `RangeError`.

#### Clearings

`clearings` makes glades: patches with no trees, a good place for a camp, a hut or a hamlet. Each clearing is a `ClearingSpec`. It has a center of its own, so the caller decides where it goes, or it leaves the center out and is placed at random, or it is placed at the end of a branch (see [below](#clearings-at-branch-ends)) or on a stream (see [Clearings on a stream](#clearings-on-a-stream)):

```ts
const { grid, clearings } = generateForest({
  width: 120,
  height: 80,
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

No tree grows in a clearing, and the `density` is 0 there. Beyond its edge the [`falloff`](#falloff-and-distance) thins the trees out, measured with `distance`, as it does beside a road. A road that runs through a clearing stays a road. `clearance` is about roads only and does not apply to clearings. The noise of the clearings is separate from the noise that sets the density of the trees, so adding a clearing never changes where the woods are thick.

A clearing without a center is placed after the ones that have a center, in the order of the list. Its center is picked at random, with these rules: the whole plain oval stays inside the map, and it keeps away from every clearing placed before it by at least the sum of their larger radii, so the plain ovals do not overlap (the ragged edges can still touch). `clearingSpacing` adds tiles to that distance: a whole number, default 0. It does not move clearings that have a center, and it does not apply to them. A clearing that finds no room after a number of tries, or that is too large for the map, is left out and no error is thrown, so the `clearings` in the result may be fewer than asked for, always in the order of the list. Random placement uses the `random` source, so the same seed gives the same places.

With roads, a clearing placed at random also keeps its `roadDistance` from the roads that are laid when it is placed: its center lies at least `min` and at most `max` tiles from the nearest road tile, measured with `distance`. The default range of 8 to 25 puts it near enough to reach but off the road. When no tile on the map fits, the clearing is left out, as above. `roadDistance` does nothing without roads, and for a clearing with a center of its own. Paths to clearings are laid after all clearings are placed, so they do not count as roads for this distance.

#### Clearings at branch ends

A road that ends in a clearing: give a clearing `at: 'branch-end'` and no `x` or `y`, and it is centered on the dead end of a [branch](#crossings-and-branches). It works best with a `branchLength`, which makes branches stop in the forest and not run to the border.

```ts
const { grid, clearings } = generateForest({
  width: 120,
  height: 80,
  roads: { branches: { min: 3, max: 3 }, branchLength: { min: 15, max: 30 } },
  clearings: [
    { at: 'branch-end', radiusX: { min: 3, max: 6 } },
    { at: 'branch-end', radiusX: { min: 3, max: 6 } },
  ],
});
```

- Each such clearing takes the next branch end, in the order the branches were laid, so two of them fill two dead ends. A clearing that finds no branch end is left out, with no error, so there may be fewer `clearings` than asked for. That is also the case without roads.
- Only the ends that lie inside the map count. A branch that runs to the border is an exit and gets no clearing, and neither do the [paths to clearings](#paths-to-clearings), which already end in a clearing.
- These clearings never keep away from others: `clearingSpacing` does not apply to them, and none is dropped for overlapping another. Two that touch merge into one bare patch, which suits several paths that lead to one glade.
- The `clearings` in the result list them after all the others, in the order of their branches.
- The other options (radii, `angle`, `irregularity`) work as for any clearing, and so do `clearance`, `falloff` and `distance`. `roadDistance` does nothing for them. A `path` does nothing either, since the center is on a road already.

An `at` that is not `'branch-end'` or `'stream'`, or one that comes with an `x` or `y`, throws a `RangeError`.

#### Clearings on a stream

Streams often run through the middle of a meadow, and a clearing with `at: 'stream'` does the same: it is centered on a random tile of the centerline of a [stream](#streams-and-rivers), a tributary included.

```ts
const { grid, clearings } = generateForest({
  width: 120,
  height: 80,
  streams: { width: { min: 2, max: 3 } },
  clearings: [{ at: 'stream', radiusX: { min: 5, max: 8 } }],
});
```

- No tree grows in the clearing, as in any other, but the water in it stays water, so the stream flows through the glade, and the roads and bridges in it stay as they are.
- It is placed like a clearing at a random place: it keeps `clearingSpacing` tiles beyond the radii from the clearings placed before it, the whole plain oval stays inside the map, and the clearings are placed in the order of the list, after the ones with a center. A clearing that finds no room, or when there is no stream, is left out with no error.
- `roadDistance` does nothing for it, and neither does a `path`, since its center is in the water.

#### Paths to clearings

A clearing can have a path: set `path` to `true`, or to `{ width, windiness }`. The path is a narrow track that starts at the nearest tile on the centerline of a road and ends in the center of the clearing. Without roads it starts at the nearest tile on the border of the map, so the clearing is reached from outside the map, and the tile on the border is one of the `exits`. Both ends are fixed, and the path winds gently in between, more with a higher `windiness`.

| Path option | Default | Meaning                                                |
| ----------- | ------- | ------------------------------------------------------ |
| `width`     | 1       | Width of the path in tiles, a whole number, 1 or more. |
| `windiness` | 0.3     | How much the path winds, from 0 (straight) to 1.       |

The path is a road of kind `'branch'` in `roads`, after the roads of the `roads` option and in the order of the clearings, so it shows up in `junctions` (where it meets a road) and in `exits` (where it reaches the border) like any branch. Its tiles are road tiles, so `clearance` and `falloff` apply to it, and it keeps the road tile `roadTile`. This works with or without the `roads` option, and with clearings that have a center of their own as well as random ones. A later path may start at an earlier path if that is the nearest road. A clearing whose center is on a road already gets no path. A clearing that was left out gets none either. The default is no path, since a glade can just as well be in the middle of the forest with no way in.

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

| Stream option | Default                | Meaning                                                                                                                                                                                                                                                                                                                                      |
| ------------- | ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `angle`       | `'random'`             | Direction of the flow in degrees, clockwise from east, so 0 flows left to right and 90 top to bottom. `'random'` picks one.                                                                                                                                                                                                                  |
| `width`       | `{ min: 1, max: 2 }`   | Width in tiles, a `Range` of whole numbers, 1 or more. A whole number in it is picked at random.                                                                                                                                                                                                                                             |
| `windiness`   | 0.5                    | How much the stream winds, from 0 (straight) to 1 (it may stray up to 12 tiles to either side of the straight line).                                                                                                                                                                                                                         |
| `shoreWidth`  | 1                      | How many tiles of shallow water the stream has on each side, a whole number, 0 or more. The rest, in the middle, is deep. A stream no wider than twice this has no deep water: with the default, widths 1 and 2 are all shallow and width 3 has a single band of deep water along its middle, and each extra tile of width widens that band. |
| `spring`      | `false`                | Whether the stream rises at a spring inside the map and flows from it to the edge, see [Springs](#springs).                                                                                                                                                                                                                                  |
| `bridges`     | 0                      | How many bridges the map has at least, counting those of the roads, a whole number, 0 or more. See [Footbridges](#footbridges).                                                                                                                                                                                                              |
| `bridgeAngle` | `{ min: 75, max: 90 }` | The angle in whole degrees, from 1 to 179, at which a generated road meets the stream, as a `Range`. It is picked at random, to the left or the right.                                                                                                                                                                                       |

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

By default trees grow right up to the water, as they often do. `bankClearance` and `bankFalloff` thin them out beside it, exactly as `clearance` and `falloff` do beside a road, but for the water of every stream and with their own values: `bankClearance` tiles are bare and the trees then thicken over `bankFalloff` tiles. The `distance` model measures both. Both default to 0 and must be whole numbers of at least 0, or a `RangeError` is thrown.

#### Bridges

Where a road meets water, the road wins: its tiles over the water become `Tile.Bridge`, as wide as the road, and the water under it is not shown. A generated road (the main road, the crossings and the branches of `roads`) is first grown as described above, and if it comes near water (within half its width and a tile of it), its way across the streams is planned and the road is laid again through the plan:

- **Ends.** An end on the edge of the map that lies in or beside the water slides along the edge to the nearest tile clear of it, preferably on the same side and on the land the road reaches first (within 30 tiles), so a road and a stream that leave the map at the same place do not overlap. An end on the edge may also slide up to 30 tiles along its side when that lets the road reach its first crossing, or leave its last one, with a gentler turn and leave the edge squarely, so the road's `angle` is a best effort near streams. An end inside the map, such as the start of a branch, does not move.
- **Route.** The road goes over the same land as it was grown over, crossing from each piece of land that the water cuts the map into to the next, a stream crossed back and forth only once. Where that means crossing a tributary and then the stream it joins, the road may instead cross the stream once below where the two meet, whichever turns the road less; a crossing of that kind is looked for within 20 tiles of the grown road only.
- **Crossings.** Each crossing is a straight bridge at an angle from `bridgeAngle` to the stream, never longer than the stream across allows, so it never runs along a stream, with 4 tiles of straight road on either bank (fewer near the edge of the map). Of the possible places, the one picked asks the road to turn least on its way to the bridge and on from it, lies near the road as grown (within 10 tiles if it can, then 20), away from the place where another stream joins, and over a single band of water, and the road must be able to get there over land without a long detour. No way of the road turns more sharply than about 6 degrees a tile where there is a gentler one.
- **Laying.** Between the waypoints (the ends of the road and both ends of the straight run onto each bridge) the road is laid as a smooth curve that winds by the road's `windiness`, as a grown road does, with the bends fading out at every waypoint so that every bridge is met square on. A road whose way was free at an end of the map arcs evenly into its first crossing. Every stretch keeps the middle of the road at least half its width and a tile from the water, so that the road never touches the water except on its bridges; never comes back within its width of itself; never runs along the edge of the map; and turns no more sharply than about 45 degrees over 9 tiles where a gentler curve keeps the other rules. Where no curve fits, because the road has to go round the end of a stream, say, it follows the shortest way round the water, near the straight line, off the edge of the map where it can be, and rounded off. A road that crosses no stream keeps its course and is laid again only where it came near the water, or from end to end when that would turn too sharply.

A road that cannot be planned is left as it was grown. The roads of `roads.specs` and the [paths to clearings](#paths-to-clearings) are not planned, since they are placed exactly, and they are bridged wherever they happen to span the stream. A planned road is a bridge over the whole width of its straight run onto each bridge, and touches no water anywhere else. Any other road over water that does not span it, because it clips a bank, runs along the bank of the stream or ends in it, gives way to the water: a group of bridge tiles is laid only when it joins two different pieces of land, those that the water cuts the map into. A bridge is as wide as the road that crosses: where the road is wider than the crossing line, the lanes at its sides are bridge too, not water.

#### Footbridges

Footbridges join the land where water that a walker cannot step through cuts it apart. A stream that runs from edge to edge, and tributaries that reach the border, split the map into pieces, and the roads may not cross them all. So where the land (every tile that is not water, with roads and their bridges counting as land) falls into pieces, the nearest two are joined by a footbridge by the shortest crossing there is, and this is repeated until there is one piece. Only a stream at least 2 tiles wide cuts the land: even when it is all shallow, crossing it means wading. A stream 1 tile wide can be stepped through and never gets a footbridge of its own. A piece of land smaller than 20 tiles, such as a scrap cut off where a tributary and its stream leave the map side by side, stays an island and is not joined.

A footbridge is one tile of `Tile.Bridge` wide and goes square across the stream, so where the stream runs at a slant it is a staircase of tiles that touch along edges, which can be walked without diagonal steps. Where it cannot go square, it slants by up to 20 degrees. It is never longer than the stream is wide plus two tiles, so it never runs along a stream, and never lies on the edge of the map. Pieces that no such footbridge can join are left apart, which did not happen in 800 random maps with streams 2 to 4 tiles wide and up to four tributaries. Trees are taken to be passable, as the generator does elsewhere. A stream with a `spring` does not cut the land and needs none.

`bridges` asks for more: it is the least number of bridges the map has, roads included. If the roads and the footbridges that join the land make fewer, more footbridges are added, each across a stream at a random place, at least 8 tiles from another bridge. These may cross a stream of any width, 1 included, and go square across it as above. When there is no room, the map has fewer than `bridges`. Footbridges are not bent to `bridgeAngle`; that is for roads.

`bridges` in the result has one point for every bridge, footbridges included: a group of bridge tiles that touch along an edge, at the tile nearest to its middle. The roads and `junctions` are not changed by a bridge, and a stream never makes a junction.

`shallowTile`, `deepTile` and `bridgeTile` replace the tiles of the water and the bridge, for instance `Tile.Floor` for shallow water and `Tile.Wall` for deep water in a game that makes no distinction.

A `bridges` that is not a whole number of at least 0, a `width`, `tributaryWidth` or `tributaryLength` that is not a `Range` of whole numbers of at least 1, `tributaries` that is not a `Range` of whole numbers of at least 0, a `tributaryAngle` that is not a `Range` of whole degrees from 1 to 179, a `windiness` outside 0 to 1, a `shoreWidth` that is not a whole number of at least 0, an `angle` that is not finite or `'random'`, a `bridgeAngle` that is not a `Range` of whole degrees from 1 to 179, or a `shallowTile`, `deepTile` or `bridgeTile` that is not a `Tile` value throws a `RangeError`.

### Templates in forests

Put a ruin, a camp or a boss arena in the forest with `templates`: a list of the same [`RoomTemplate`](#room-templates) objects as the dungeons take. A forest has no tunnels, so a template has no exits: it is a design of `Floor`, `Wall` and `Unused` cells. A template with an `Exit`, `Door` or `OptionalExit` cell, or with `positions` or `areas`, throws a `RangeError`, as does an invalid `count`, `chance`, `margin` or `rotate`.

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
  clearings: [{ radiusX: { min: 8, max: 8 }, path: true }],
  templates: [ruin],
});
```

| Template field     | Default        | Meaning                                                                                                                                                                           |
| ------------------ | -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `clearing`         | `false`        | Whether the template needs a clearing. A template that does not goes to a random spot, and the trees stay round it and in its `Unused` cells.                                     |
| `chance`           | 1              | The chance that each copy is placed at all, from 0 to 1. With 1 every copy is placed, which is what a boss arena needs. With a lower chance it can happen that no copy is placed. |
| `margin`           | 0              | For a template on a clearing of its own: how many tiles beyond its box the trees take to thicken from none to full density, a whole number, 0 or more. See below.                 |
| `count`            | exactly 1      | Number of copies, a `Range` of at least 0. Each copy is rolled against `chance` on its own and goes on a clearing of its own.                                                     |
| `rotate`, `mirror` | `[0]`, `false` | The variants a copy may be placed in, as for dungeons.                                                                                                                            |

**Where a template goes.** A template with `clearing: true` is centered on a free clearing from `clearings`, picked at random among those where it fits. The clearing is never grown: ask for clearings of a fitting size. A clearing holds one template at most. When no free clearing has room for it, because there are none or all are taken or blocked, the template gets a clearing of its own: it goes to a random spot, and the whole box of the template is free of trees. The `margin` makes the trees thicken over that many tiles beyond the box, with the same ramp as the [`falloff`](#falloff-and-distance) (with a `margin` of 3 the first tile beyond the box has a quarter of the chance of a tree, the next half, the next three quarters), so a template leaves no bare rectangle. That clearing is not in `clearings`: `ownClearing` of the template says so. The `density` result follows the ramp.

**Which tiles a template changes.** `Floor` cells become `Tile.Floor` and `Wall` cells `Tile.Wall`, over trees and ground. `Unused` cells leave whatever the map has there: a tree, grass, a road or water. A template never covers a road, a path or water: it is placed only where none of its `Floor` or `Wall` cells lies on one, and where it overlaps no other template. A path to the clearing it stands on (see [Paths to clearings](#paths-to-clearings)) stops at the edge of the template. A road that a template cannot be placed clear of makes that forest fail, see below.

**A template always appears, or it throws.** A template is requested because the map needs it, so it is never quietly left out. A template that finds no place gets a new forest, up to three forests in all, and only after the third a [`TemplatePlacementError`](#room-templates) is thrown. Since every forest failed, the input is at fault (a template that fills the map, say) and not the map. A template that is bigger than the map throws at once. A `chance` below 1 is the only way a template is left out, and it is no error.

The `templates` result lists the templates that were placed, in the order of the list and of their copies, each with its `template` (the index in `templates`), the box it fills (`x`, `y`, `width`, `height`), its `rotation` and `mirrored`, the `clearing` it stands on (the index in the `clearings` result, left out for a template placed anywhere or on a clearing of its own) and `ownClearing`.

### `ForestOptions`

| Option            | Default             | Meaning                                                                                                                                                                  |
| ----------------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `width`           |                     | Map width in tiles. Required.                                                                                                                                            |
| `height`          |                     | Map height in tiles. Required.                                                                                                                                           |
| `random`          | `Math.random`       | Source of randomness.                                                                                                                                                    |
| `minDensity`      | 0                   | The chance of a tree where the noise is at its lowest, from 0 to 1.                                                                                                      |
| `maxDensity`      | 0.25                | The chance of a tree where the noise is at its highest, from 0 to 1. With the same value as `minDensity`, trees are scattered evenly.                                    |
| `scaleX`          | 40                  | Size in tiles of a feature of the noise along the x axis, before rotation. Larger values make broader woods and glades. A positive number.                               |
| `scaleY`          | 40                  | The same along the y axis. Different scales stretch the woods.                                                                                                           |
| `rotation`        | 0                   | Clockwise rotation of the noise in degrees. A stretched wood runs diagonally with a rotation of 45. See [`transformNoise`](#noise).                                      |
| `octaves`         | 1                   | Layers of the built-in noise, each finer than the one before. With 1 there is a single layer, and `persistence` and `lacunarity` do nothing. A whole number, 1 or more.  |
| `persistence`     | 0.2                 | How much each layer counts against the one before it, from 0 to 1. Only matters with more than one octave.                                                               |
| `lacunarity`      | 1                   | How much finer each layer is than the one before it. A positive number. Only matters with more than one octave.                                                          |
| `noise`           | built-in            | A [`NoiseFunction`](#noise) to use instead of the built-in simplex noise.                                                                                                |
| `groundTile`      | `Tile.Grass`        | The tile for ground without a tree. Any `Tile` value, for instance `Tile.Floor`.                                                                                         |
| `treeTile`        | `Tile.Tree`         | The tile for a tree, for instance `Tile.Wall` for a forest that blocks like rock.                                                                                        |
| `roads`           | no roads            | Lays a road through the forest, see [Roads](#roads).                                                                                                                     |
| `clearance`       | 0                   | How many tiles beside a road are kept free of trees, a whole number, 0 or more. See [Clearance](#clearance).                                                             |
| `falloff`         | 0                   | How many tiles the trees take to thicken from none to full density beyond the `clearance`, a whole number, 0 or more. See [Falloff and distance](#falloff-and-distance). |
| `distance`        | `'chebyshev'`       | How distances to a road are measured for `clearance` and `falloff`: `'chebyshev'`, `'manhattan'` or `'euclidean'`. See [Falloff and distance](#falloff-and-distance).    |
| `clearings`       | none                | Glades with ragged edges, free of trees: a list of `ClearingSpec`. See [Clearings](#clearings).                                                                          |
| `clearingSpacing` | 0                   | How many tiles beyond their radii clearings placed at random keep from other clearings, a whole number, 0 or more. See [Clearings](#clearings).                          |
| `templates`       | none                | Prefabricated [`RoomTemplate`](#room-templates)s to place, such as a ruin on a clearing. See [Templates in forests](#templates-in-forests).                              |
| `bankClearance`   | 0                   | How many tiles beside the water of a stream are kept free of trees, a whole number, 0 or more. See [Banks](#banks).                                                      |
| `bankFalloff`     | 0                   | How many tiles the trees take to thicken beyond the `bankClearance`, a whole number, 0 or more. See [Banks](#banks).                                                     |
| `streams`         | no streams          | Lays a stream, or a river, through the forest, see [Streams and rivers](#streams-and-rivers).                                                                            |
| `shallowTile`     | `Tile.ShallowWater` | The tile for the shallow water of a stream.                                                                                                                              |
| `deepTile`        | `Tile.DeepWater`    | The tile for the deep water of a stream.                                                                                                                                 |
| `bridgeTile`      | `Tile.Bridge`       | The tile for a bridge, where a road crosses water.                                                                                                                       |
| `roadTile`        | `Tile.Road`         | The tile for a road.                                                                                                                                                     |     |

An injected `noise` takes the place of the built-in simplex noise: it receives positions in noise units, which is the tile center divided by the scales after the rotation, and returns a number from -1 to 1. Anything outside that range is limited to it. Since it replaces the built-in noise, `octaves`, `persistence` and `lacunarity` do not apply to it; wrap it in [`createFractalNoise`](#noise) if you want layers. `scaleX`, `scaleY` and `rotation` apply to it as they do to the built-in noise.

Non-positive or non-integer dimensions, a `minDensity` or `maxDensity` outside 0 to 1, a `groundTile` or `treeTile` that is not a `Tile` value, and invalid noise options (see [Noise](#noise)) throw a `RangeError`.

### `ForestResult`

- `grid`: the map.
- `density`: the chance of a tree on every tile, from `minDensity` to `maxDensity`, as a `Float32Array` that runs row by row, so `density[y * grid.width + x]`. A game can use it to tell thick woods from glades, for instance to put mushrooms or a hunter's hut where the trees are few.
- `roads`: the roads that were laid, the main road first. Each is a `Road` with its `kind` (`'road'` for the main road and crossings, `'branch'` for branches and for the [paths to clearings](#paths-to-clearings)), its `width` in tiles and its `points`, the tiles of its centerline from one end to the other, each next to the one before. Empty without the `roads` option and without paths.
- `junctions`: the places where roads meet or cross, which are good places for a signpost or an inn. Empty while there is a single road. See [Crossings and branches](#crossings-and-branches).
- `exits`: the tiles on the map border where a road leaves the map, as for a [maze](#mazes). A game can join the maps on the other sides there.
- `streams`: the streams that were laid, as `Road`s: `width` in tiles and `points`, the tiles of the centerline from upstream to the mouth. Empty without the `streams` option. See [Streams and rivers](#streams-and-rivers).
- `bridges`: the bridges, one point for each place where a road or a footbridge crosses water. Empty without streams.
- `clearings`: the clearings that were made, each with its center `x` and `y`, `radiusX`, `radiusY` (the radii that were picked, plain numbers) and `angle`, the defaults filled in. Empty without the `clearings` option. See [Clearings](#clearings).
- `templates`: the templates that were placed, each with its `template` index, its box (`x`, `y`, `width`, `height`), `rotation`, `mirrored`, the `clearing` it stands on and `ownClearing`. Empty without the `templates` option. See [Templates in forests](#templates-in-forests).

```ts
const { grid, density } = generateForest({
  width: 200,
  height: 100,
  scaleX: 80,
  scaleY: 20,
  rotation: 30,
  maxDensity: 0.45,
});
const isGlade = (x: number, y: number) =>
  (density[y * grid.width + x] ?? 0) < 0.1;
```

## Mines

```ts
import { generateMine } from 'angstloch';

const { grid, passages, exits } = generateMine({
  width: 80,
  height: 50,
  density: 0.25,
  minExits: 2,
});
console.log(grid.toString());
```

A mine is a solid map with tunnels dug into it. In a [dungeon](#dungeons) the rooms are the content and the corridors only join them. In a mine it is the other way round: the tunnels are the structure. Tiles are `Tile.Wall` and `Tile.Floor`, and `Tile.Door` for the doors of rooms and the exits on the border. The map is closed in by a ring of wall, and the mine is always one connected piece, since every tunnel, cavern and room is joined to the rest.

The `layout` option picks the overall shape of the mine: `'fishbone'` (the default), `'veins'`, `'pillars'` or `'rings'`. Each layout has options of its own, marked in the table below, and the options of the other layouts are ignored. The `density`, the vein options where they apply, and the exits work for more than one, and [caverns](#caverns) and [rooms and templates](#rooms-and-templates) work for all of them. A mine is made in this order: the layout, then caverns, then rooms and templates, then the exits on the border.

### The fishbone layout

A fishbone is how a mine is dug when exploring for ore. First comes the **main shaft**: a wide tunnel that is straight, or nearly so, through a point near the middle of the map. It runs in both directions from that point, until it meets the edge of the map. Then **adits** are dug: narrower side tunnels that each leave a random spot of a tunnel that exists, the shaft or another adit, at some angle, and wind a little as they go. They branch off one another as well as off the shaft, so the mine grows into a tree.

An adit is picked one after another until the `density`, the share of the map that is floor, is reached. It is a target and is met as far as there is room: when no more adits fit, the generator stops short of it without an error. The main shaft is always dug, so a `density` of 0 gives the shaft alone, and a shaft that is wider than the target leaves the density above it.

Tunnels keep apart. An adit that comes near another tunnel stops short of it, with a wall between them, and ends in a dead end. An adit that ends up shorter than the minimum of `aditLength` is not dug. With `loops`, an adit that comes up against another tunnel breaks through into it with that chance instead, which joins the two and makes a loop in the mine.

`angle` is the direction of the main shaft in degrees, clockwise from east, like the `rotation` of [noise](#noise) and the `angle` of [roads](#roads): 0 runs from left to right, 90 from top to bottom. `'random'` picks one. The shaft winds as far as `shaftWindiness` says, which is a little by default, and the adits as far as `aditWindiness` says. A windiness is from 0 (straight) to 1, and works as the `windiness` of roads does: the tunnel is pushed to either side by smooth noise, so it bends gently and does not jitter. A shaft that winds off the map is cut where it leaves, and the part that holds its middle is dug.

Widths are `Range`s of whole tiles. The shaft gets one width, and every adit its own. A tunnel two tiles wide or more has rounded corners. `aditLength` is measured along the line that the adit follows, so an adit that runs at a diagonal covers up to about 40% more tiles than its length. `branchAngle` is the angle between an adit and the tunnel it leaves, in whole degrees from 1 to 179. The adit leaves along the tunnel or against it, to its left or its right, so a small angle forks away gently and 90 is a right angle.

### The veins layout

```ts
const { grid } = generateMine({ width: 80, height: 50, layout: 'veins' });
```

Veins are how a mine looks that follows the veins of an ore, which run where they please: an irregular web of winding tunnels, like a labyrinth or the edges of a Voronoi diagram. The generator spreads **junctions** over the map: it cuts the map into cells about `veinSpacing` tiles across and puts one junction at a random spot well inside each cell, which spreads them out evenly without lining them up. The tunnels between junctions are the **veins**, and each one winds as far as `veinWindiness` says, on its own bends.

First the shortest set of veins that joins every junction is dug, which makes the mine one piece. That tree is always dug whole, even when it takes more floor than the `density` asks for. Then the other veins between near neighbors (each junction's 3 nearest) are dug, shortest first with a little shuffling, until the `density` is reached or there are none left. Every extra vein closes a loop, so a higher `density` makes a tighter web, and the lowest makes a tree. A vein may cross another, which makes a junction of its own. A vein that winds off the map is pushed back inside, so that it is not cut in two.

The veins have no main shaft and no dead ends of their own: `passages` lists the veins, the tree first and then the extras, each with the `kind` `'vein'`. The default `density` of 0.15 gives a sparse web on an 80 by 50 map, and 0.25 a dense one. `veinSpacing` sets the scale: with 8 the veins are short and the web is fine, with 30 there are a few long ones. A map smaller than the spacing gets two junctions at least, and one smaller than 3 tiles inside its border has no floor.

### The pillars layout

```ts
const { grid, halls } = generateMine({
  width: 80,
  height: 50,
  layout: 'pillars',
});
```

Pillars are how a coal seam is mined, with room and pillar: large halls are dug out, and islands of untouched rock are left standing in them to hold up the roof, which gives a pattern of polka dots. The result is a few big halls joined by winding tunnels.

**Halls.** The number of halls is picked from `halls` (2 to 4 by default), and each is a rough rectangle with a jagged edge, placed at random with at least 4 tiles of rock between it and any other. A hall that finds no room is left out, so a crowded map gets fewer than asked for, and at least one is always dug. The size of each side of a hall is picked from `hallSize`. Without it, a size is worked out from the `density`: the halls together fill about that share of the map once the pillars are taken out, in a shape that is a little wide or tall. A derived hall that finds no room shrinks until it does, and one with a size of its own is left out instead. `hallRagged`, from 0 to 1, sets how jagged the edges are: at 0 a hall is a clean rectangle, and at 1 its sides are cut back by up to 4 tiles, a depth that does not grow with the hall. The corners come out rounded and cut.

**Joining.** The halls are joined into one network of veins that grows from a first vein. The two halls nearest each other are joined first. Then the hall nearest the network is joined to it, and so on until every hall is in. A hall is joined by one vein to the nearest tile on the boundary of any hall or vein that is in the network already, so halls need not be joined directly: a vein may end on another vein, in a T. A vein never crosses another one. So a mine of `n` halls has `n - 1` veins at least, whatever `hallVeins` says, and a single hall has no veins. `hallVeins` (2 to 4 by default) is how many veins there are in all, picked from its range, so the rest are extra veins, which make loops. Each one starts at a random hall and ends at the nearest hall or vein of the network that does not leave that hall, so it does not run back along the hall's own vein. An extra vein that has no such end, or finds no route, is left out.

**Entrances.** A vein starts and ends on the boundary of a hall or a vein: a floor tile that has rock next to it, never a tile in the inside, so a vein never crosses a hall and takes no pillars. `hallEntrances` says where a vein starts on its hall. With `'facing'` (the default) it starts along the side that faces the nearest part of the network: the band of boundary tiles, about 3 deep, that lies furthest in the direction from the middle of the hall to that nearest tile. A hall to the east of the network is left by its east side, and one that lies diagonally by a corner. With `'edge'` it starts anywhere on the boundary, on any side. Several tiles are tried, and the one furthest from the entrances and ends of veins already there wins, so veins do not leave side by side. The end is the nearest tile of the network to the start, and it avoids the ends of other veins by at least 3 tiles where it can.

```ts
// veins that leave each hall from any side, not only the one that faces the next
generateMine({
  width: 80,
  height: 50,
  layout: 'pillars',
  hallEntrances: 'edge',
});
```

**Routing.** A vein is not a straight line between its two ends. It is routed through the rock with a shortest-path search that may not use any floor, so it goes around the halls that lie in its way. The route keeps a wall between the vein and every hall and every earlier vein, a wall that is at least one tile thick however wide the vein is, except close to its own two ends, where it has to leave and arrive. So veins never overlap, and they run side by side with a wall between them or not at all. A vein is also never much longer than the way between its ends: a route of more than 1.5 times the distance between its ends along the grid, plus 8 tiles, is rejected, so a vein does not run round a whole hall to reach the far side of it. The route is then given a natural look: its corners are smoothed, and noise pushes it sideways by up to 3 tiles, the more so the higher `veinWindiness` is, without ever pushing it onto a hall or another vein. `veinWidth` applies, with a width picked for every attempt.

**When a vein finds no route.** The halls may be too close for a vein to fit, earlier veins may have taken the way, or the route may be too long. Then the vein is tried again from another start, up to 10 times in all. With `'facing'`, the first 5 tries keep to the facing side and the rest may use any side, so that a vein can go round a hall when the way between the two is taken. An extra vein that still finds no route is left out, so a crowded map gets fewer veins than `hallVeins` says. A hall that finds no route is tried again once the other halls are in, since the network is larger then, and if that fails too, one last time with the rules relaxed: only floor blocks the route, there is no limit to its length, and the veins may run close to a hall or another vein. That squeezes a vein through a gap of one tile, so a hall that is boxed in joins whatever it is boxed in by, and no hall is left out for want of a vein. Halls are only left out when they find no room, as described above.

**Pillars.** Pillars are islands of wall, each of a width and a height picked from `pillarSize` (2 to 5 by default), arranged in a pattern in each hall. The pattern is a lattice with cells as wide as the largest pillar plus the gap between pillars, and the gap is picked from `pillarSpacing` (2 to 4) once for each hall, so a hall has its own rhythm. The lattice is centered in the hall and kept clear of the hall's ragged edge, and every pillar sits in its own cell. `pillarJitter`, from 0 to 1, moves the pillars off the grid: at 0 it is perfect, and at 1 each pillar strays as far as it can without getting closer than a tile to its neighbors. `pillarRagged`, from 0 to 1, makes the edges of the pillars ragged: at 0 they are clean rectangles. Pillars that are 2 tiles wide or tall are too small to be ragged on that side. A pillar is left out where it would touch the wall of the hall, another pillar or a vein, so there is always floor all around a pillar and the floor of a hall stays in one piece. That means a hall may have fewer pillars than the lattice has cells, most of all at the edge and where a vein runs, and a hall that is too small for a pillar has none.

Here `density` only sizes the halls, with its default raised to 0.35, since a hall needs room to show its pillars. The halls together fill about that share of the map once the pillars are taken out, as far as the pillars can be estimated in advance, so the share of floor you get is approximate, and the veins add to it. It does nothing when you give a `hallSize`.

`halls` in the result lists the halls: see [`MineResult`](#mineresult).

### The rings layout

```ts
const { grid, passages } = generateMine({
  width: 80,
  height: 50,
  layout: 'rings',
});
```

Some mines are dug in rings, such as a bore driven round a shaft level after level. Here it is a flat map of concentric loops of tunnel, joined by spokes.

**Rings.** The rings are ovals around the middle of the map, as tall and wide as the map is, so a ring is round on a square map and long on a wide one. They are evenly spaced, from the innermost out to the outermost, which lies near the border. A ring's width is picked from `ringWidth` (2 to 3 by default), one for each ring. The rock inside the innermost ring is left as it is. `rings` is how many to dig, a `Range`. Without it, the count is the one whose rings come closest to filling the `density` of the map, at most 10 and as many as have room for their width and a gap of 2 tiles; with it, the `density` is not used. A map that is too small for the count gets as many as fit, and one with no room for a ring of 3 tiles' radius gets none, and so no floor.

**Shape.** `ringShape` is `'oval'` (the default) or `'circle'`. With `'circle'` the rings are round: as large as the shorter side of the map allows, and centered, so on a wide or tall map the ends are left as rock (caverns and rooms can still go there). On a square map the two shapes are the same. `density` keeps its meaning, the share of the whole map that is floor, so a circle on a very wide map may be unable to reach it, and then stops short with the count of rings that comes closest.

```ts
const { grid } = generateMine({
  width: 100,
  height: 50,
  layout: 'rings',
  ringShape: 'circle',
});
```

**Wobble.** A ring is not a perfect oval: smooth noise pushes it in and out as it goes round, and it is still a closed loop. `ringWobble`, from 0 to 1, sets how far. At 1 a ring strays up to a quarter of the distance between rings, so that rings do not meet, and at 0 it is a perfect oval. The corners are not sharp, since the noise is smooth.

**Spokes.** Between every ring and the next, at least one spoke runs outwards at a random angle, so the mine is one piece. `spokes` is how many join each pair, a `Range` (1 to 3 by default) picked once for each pair, and a pair always gets one, so a minimum of 0 is the same as 1. The spokes of a pair are spread round the rings at about even distances, with a little shuffling, and they wind as far as `veinWindiness` says. Their width is picked from `veinWidth`. With one ring there are no spokes.

`passages` lists the rings first, from the innermost out, with the `kind` `'ring'`, then the spokes, with the kind `'spoke'`. The first and last tile of a ring are the same tile.

### Caverns

```ts
const { grid, caverns } = generateMine({
  width: 80,
  height: 50,
  caverns: { min: 2, max: 4 },
});
```

Some mines break into natural caverns. With `caverns`, any layout gets a few of them, dug into the rock beside the tunnels once the rest of the mine is done. The number of caverns is picked from the range, and the default, `{ min: 0, max: 0 }`, digs none, so a mine is the same as it was without them.

A cavern is a blob of floor made by the [noise cave](#noise-caves) generator: the generator makes a cave in a box, keeps its largest cavern and drops the rest, and the box is then placed in the mine. Its width and height are picked from `cavernSize` (12 to 24 by default), each side on its own, and a side is cut down to what the map has room for. `cavernFill` is the `fill` of the noise cave, the share of the box that is wall (0.45 by default): a lower share makes a larger, rounder cavern, and a higher one a smaller, thinner one.

Where a cavern goes is picked by trying 20 places at random in the rock and taking the one nearest the mine. A cavern never overlaps the tunnels, halls or pillars, and only ever adds floor. It touches the mine, or when it does not, a short winding tunnel joins it to the nearest tunnel, in the width and the windiness of the veins (`veinWidth` and `veinWindiness`). The tunnel is listed in `passages` after all the others, with the `kind` `'tunnel'`. A cavern that finds no room, which a mine that is crowded or a map that is small can bring about, is left out, so there may be fewer than asked for. Exits are carved after the caverns, and may lead to one.

`caverns` in the result lists the caverns, each as an `Area`, the box that it was made in: see [`MineResult`](#mineresult). The corners of a box are usually wall.

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
  rooms: { count: { min: 2, max: 4 }, width: { min: 4, max: 8 } },
  templates: [closet],
  doorChance: 0.5,
});
```

Any layout can get rooms: a store, a chapel, a shaft office. They are dug into the rock beside the tunnels once the rest of the mine is done, after the caverns, and joined to the mine by tunnels. Without `rooms` and `templates` the mine is as it was.

**Ordinary rooms.** `rooms` takes the options of the [maze's](#rooms-in-mazes) rooms: `count` (1 when `rooms` is given), `width` and `height` (3 to 7), and `sizeUniformity` (0). Sizes are the floor, without the wall, and any size is allowed, since a mine has no lattice. A room is a rectangle of floor inside a ring of wall, which a gap can open anywhere along.

**Templates.** `templates` takes the same [`RoomTemplate`](#room-templates) objects as the dungeons and mazes, with the same `count`, `rotate`, `mirror`, `positions`, `areas` and `positionAccuracy`. They are placed before the ordinary rooms. Placement is anywhere in the rock the template fits, or where its `positions` and `areas` say, and a template that cannot be placed, or cannot be joined to the mine, gets a new mine, up to three in all, before a [`TemplatePlacementError`](#room-templates) is thrown (see [Room templates](#room-templates)). A template is never left out. The cells of a template that stand for the wall around a room are part of it, so keep them in the design. There is no `templateSymmetry`.

**Where rooms go.** A room, with its wall, keeps at least 2 tiles of rock from the tunnels, halls, pillars and caverns, and from other rooms, and it never overlaps them. A room that finds no spot is left out, so a crowded map gets fewer rooms than asked for, and templates are the exception and throw. An ordinary room is put at the best of up to 20 places that fit, the nearest to the mine, which keeps its tunnels short.

**Openings.** A room opens onto the mine at its exits. `exitsPerRoom` (1 to 3) is how many, picked for each room: the `Exit` and `Door` cells of a template that lead outside always open and count, and `OptionalExit` cells open as far as the count asks for beyond them, nearest the mine first. An ordinary room has an optional exit all round its wall. There is at least one opening in every room, and no two openings are next to each other, diagonals included: an optional exit beside an opening that is open already stays a wall, so a room may get fewer openings than `exitsPerRoom` asks for. Fixed `Exit` and `Door` cells are always opened, so a template that puts two of them side by side gets two openings side by side. Every opening is a gap in the wall that gets a door with the chance `doorChance` (1 by default), and is a plain opening otherwise. `Door` cells of a template are always doors.

From each opening, a tunnel runs to the nearest floor of the mine, which may be another room's tunnel but never a room. It winds as veins do, in the width and windiness of `veinWidth` and `veinWindiness`, and when that would cross a room, it follows the shortest way round instead. The tunnels are listed in `passages` after all the others, with the `kind` `'tunnel'`. A room that cannot be joined, for want of a free way, is left out, and a template that cannot be joined throws.

The rooms are in `rooms`, templated ones first, with `template`, `rotation` and `mirrored` set, and their openings are in `roomExits`, as for [mazes](#mazeresult): see [`MineResult`](#mineresult). An ordinary room's `x`, `y`, `width` and `height` describe its floor, and a templated room's its bounding box, walls included. A door is a `Tile.Door`, so a room is not part of the same group of floor tiles as the mine for a check that goes by `Tile.Floor` alone.

### Exits

`minExits` and `maxExits` add mouths to the mine on the border of the map, like the exits of a [cave](#exits): a `Tile.Door` on the border and a straight tunnel from it to the nearest floor, found by going straight in. The generator picks a number between the two, and fewer when the mine has no more places for them. The doors are listed in `exits`, and no two of them are side by side.

### `MineOptions`

| Option           | Default                                    | Meaning                                                                                                                                                                                           |
| ---------------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `width`          |                                            | Map width in tiles. Required.                                                                                                                                                                     |
| `height`         |                                            | Map height in tiles. Required.                                                                                                                                                                    |
| `random`         | `Math.random`                              | Source of randomness. It seeds the noise that bends the tunnels and rolls everything else.                                                                                                        |
| `layout`         | `'fishbone'`                               | The overall shape of the mine, `'fishbone'` or `'veins'`.                                                                                                                                         |
| `density`        | 0.15 (0.35 for `pillars`, 0.3 for `rings`) | The share of the map that is floor, from 0 to 1. A target that is met as far as there is room.                                                                                                    |
| `shaftWidth`     | `{ min: 2, max: 3 }`                       | Fishbone only. Width of the main shaft in whole tiles, 1 or more. A `Range`.                                                                                                                      |
| `shaftWindiness` | 0.1                                        | Fishbone only. How much the main shaft winds, from 0 (straight) to 1.                                                                                                                             |
| `angle`          | `'random'`                                 | Fishbone only. Direction of the main shaft in degrees, clockwise from east, or `'random'`.                                                                                                        |
| `aditWidth`      | `{ min: 1, max: 2 }`                       | Fishbone only. Width of an adit in whole tiles, 1 or more. A `Range`.                                                                                                                             |
| `aditWindiness`  | 0.4                                        | Fishbone only. How much the adits wind, from 0 to 1.                                                                                                                                              |
| `aditLength`     | `{ min: 15, max: 50 }`                     | Fishbone only. Length of an adit in whole tiles, 1 or more, measured along its line. A `Range`. An adit that ends shorter than the minimum is not dug.                                            |
| `branchAngle`    | `{ min: 45, max: 90 }`                     | The angle in whole degrees, from 1 to 179, between an adit and the tunnel it leaves. A `Range`.                                                                                                   |
| `loops`          | 0                                          | Fishbone only. The chance, from 0 to 1, that an adit that runs into another tunnel breaks through and makes a loop, instead of ending in a dead end.                                              |
| `veinWidth`      | `{ min: 1, max: 2 }`                       | Veins, pillars and rings (spokes). Width of a vein in whole tiles, 1 or more. A `Range`.                                                                                                          |
| `veinWindiness`  | 0.5                                        | Veins, pillars and rings (spokes). How much the veins wind, from 0 to 1.                                                                                                                          |
| `veinSpacing`    | 16                                         | Veins only. About how far apart the junctions lie, in tiles. A whole number, 3 or more.                                                                                                           |
| `halls`          | `{ min: 2, max: 4 }`                       | Pillars only. How many halls to dig, a `Range` of whole numbers, 1 or more. A hall that finds no room is left out.                                                                                |
| `rings`          | from `density`                             | Rings only. How many concentric rings to dig, a `Range` of whole numbers, 1 or more. Fewer are dug when the map has no room.                                                                      |
| `ringShape`      | `'oval'`                                   | Rings only. `'oval'` fits the rings to the map, `'circle'` makes them round and centered, as large as the shorter side allows.                                                                    |
| `ringWidth`      | `{ min: 2, max: 3 }`                       | Rings only. Width of a ring in whole tiles, 1 or more, a `Range`.                                                                                                                                 |
| `ringWobble`     | 0.5                                        | Rings only. How far the rings stray from perfect ovals, from 0 to 1.                                                                                                                              |
| `spokes`         | `{ min: 1, max: 3 }`                       | Rings only. How many spokes join each ring to the next, a `Range` of whole numbers, 0 or more. Every pair gets one at least.                                                                      |
| `caverns`        | `{ min: 0, max: 0 }`                       | How many caverns to dig, a `Range` of whole numbers, 0 or more. A cavern that finds no room is left out.                                                                                          |
| `cavernSize`     | `{ min: 12, max: 24 }`                     | The width and the height of a cavern in whole tiles, 3 or more, a `Range`.                                                                                                                        |
| `cavernFill`     | 0.45                                       | The share of a cavern's box that is wall, from 0 to 1.                                                                                                                                            |
| `rooms`          | none                                       | Ordinary rooms to place in the mine, with `count`, `width`, `height` and `sizeUniformity`, as for [mazes](#rooms-in-mazes).                                                                       |
| `templates`      | none                                       | Prefabricated [`RoomTemplate`](#room-templates)s to place. A template that finds no place, or cannot be joined, gets a new mine, up to three times, before a `TemplatePlacementError` is thrown.  |
| `exitsPerRoom`   | `{ min: 1, max: 3 }`                       | Openings per room, a `Range` of whole numbers, 1 or more.                                                                                                                                         |
| `doorChance`     | 1                                          | The chance that a room's opening gets a door, from 0 to 1.                                                                                                                                        |
| `hallVeins`      | `{ min: 2, max: 4 }`                       | Pillars only. How many veins to dig between the halls in all, a `Range` of whole numbers, 1 or more. The veins that join the halls come first, and an extra vein that finds no route is left out. |
| `hallEntrances`  | `'facing'`                                 | Pillars only. Where a vein starts on its hall, always on its boundary: `'facing'` along the side that faces the nearest part of the network, `'edge'` on any side.                                |
| `hallSize`       | from `density`                             | Pillars only. The width and the height of a hall in whole tiles, 1 or more, a `Range`. Each side of each hall gets its own size.                                                                  |
| `hallRagged`     | 0.5                                        | Pillars only. How ragged the edges of the halls are, from 0 (clean rectangles) to 1.                                                                                                              |
| `pillarSize`     | `{ min: 2, max: 5 }`                       | Pillars only. The width and the height of a pillar in whole tiles, 1 or more, a `Range`.                                                                                                          |
| `pillarSpacing`  | `{ min: 2, max: 4 }`                       | Pillars only. The gap between neighboring pillars in whole tiles, 1 or more, a `Range`, picked once for each hall.                                                                                |
| `pillarRagged`   | 0.5                                        | Pillars only. How ragged the edges of the pillars are, from 0 (clean rectangles) to 1.                                                                                                            |
| `pillarJitter`   | 0.5                                        | Pillars only. How far the pillars stray from a regular pattern, from 0 (a perfect grid) to 1.                                                                                                     |
| `minExits`       | 0                                          | Minimum number of exits to add on the map border. A whole number, 0 or more.                                                                                                                      |
| `maxExits`       | `minExits`                                 | Maximum number of exits to add.                                                                                                                                                                   |

A `RangeError` is thrown for a non-positive or non-integer size, a `layout`, `ringShape` or `hallEntrances` that does not exist, an `angle` that is not a finite number or `'random'`, a `density`, windiness or `loops` outside 0 to 1, a `veinSpacing` that is not a whole number of at least 3, a `hallRagged`, `pillarRagged`, `pillarJitter`, `ringWobble`, `cavernFill`, `doorChance` or `rooms.sizeUniformity` outside 0 to 1, an `exitsPerRoom` or `rooms` range with an end that is not a whole number of at least 1 (0 for `rooms.count`), a range with an end that is not a whole number of at least 1 or with `min` above `max`, a `branchAngle` above 179, and a `minExits` or `maxExits` that is not a whole number of at least 0.

### `MineResult`

| Field      | Meaning                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `grid`     | The map.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `passages` | The tunnels in the order they were dug, the main shaft first, as `MinePassage` objects: `kind` (`'shaft'` or `'adit'` for a fishbone, `'vein'` for veins and for the veins between halls, `'ring'` and `'spoke'` for rings, `'tunnel'` for a tunnel that joins a cavern or a room), `width` and `tiles`, the tiles along the middle of the tunnel from where it starts to where it ends, each touching the one before along an edge. An adit starts at the tunnel it leaves, and a vein runs from one junction to another. |
| `halls`    | The halls of a `pillars` mine, each as an `Area`: the smallest rectangle that holds it. Its edges are ragged, so a corner may be wall. Empty for the other layouts.                                                                                                                                                                                                                                                                                                                                                        |
| `exits`    | The door tiles on the map border, one per exit.                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |

## Dungeons

```ts
import { generateRoomDungeon } from 'angstloch';

const { grid, rooms, exits, fill } = generateRoomDungeon({
  width: 61,
  height: 41,
  placement: 'lattice',
  roomCount: { min: 6, max: 12 },
});
console.log(grid.toString());
console.log(`${rooms.length} rooms covering ${fill * 100}% of the map`);
```

Prefabricated rooms are supported by both generators (see [Room templates](#room-templates)). Existing options and result fields will keep working as documented here.

There are two dungeon generators. They take the same [`DungeonOptions`](#dungeonoptions), return the same [`DungeonResult`](#dungeonresult), and differ in how rooms and corridors come about:

- `generateRoomDungeon` places the rooms first and joins them with corridors afterwards. Its rooms are spread over the whole map, in a scattered or a regular way.
- [`generateDigDungeon`](#the-digger) digs corridors out of a first room and puts a room at the end of each, so the dungeon grows in a tree-like way, as in a roguelike of old.

`generateRoomDungeon` builds a dungeon room-first:

1. Rooms are placed on the map without overlapping, either scattered at random or by binary space partitioning.
2. Rooms are joined with corridors. Every room can be reached from every other one (see [Connections](#connections)).
3. Rooms get the number of exits they ask for, and loops and dead ends are added if requested.
4. Every opening in a room's wall becomes an _exit_, and each exit gets a door or stays a plain opening.

### Placement of rooms

Which rooms go where is decided by `partition`:

- `'scatter'` (default): random rooms are tried one after another, and any that would come too close to the map edge or to another room is discarded. Generation stops when the first of these happens:
  - `roomCount.max` rooms have been placed.
  - The `fill` target has been reached and at least `roomCount.min` rooms are placed.
  - The map is full: 100 rooms in a row failed to fit. In that case you can get fewer rooms than `roomCount.min` or a lower fill than requested.
- `'bsp'`: the map is cut in two again and again (binary space partitioning), and every area that results holds one room. The number of areas is estimated from `fill` and the typical room size, and kept within `roomCount`. If the rooms fall short of the target, the map is cut into more areas, a few times over. Rooms are placed inside their areas and separated by `roomSpacing`, so a `bsp` dungeon looks more regular than a scattered one.

`spacingUniformity` sets how evenly rooms are spread, from 0 to 1:

- With `scatter`, several candidate rooms are compared at once and the one farthest from the other rooms is kept. At 0 there is a single candidate, so rooms can land anywhere; at 1 there are ten.
- With `bsp`, at 0 the cuts and the rooms inside their areas are placed at random, and the area to cut next is picked at random too. At 1 the biggest area is always cut next, cuts go through the middle and rooms sit in the middle of their areas, which gives an almost regular grid.

Rooms that turn out to be unreachable are dropped afterwards, see [Connections](#connections).

A room is always separated from the map edge by at least one wall tile. The minimum number of wall tiles between two rooms is set with `roomSpacing`.

### `placement`

- `'free'` (default): a room can start on any tile and have any size within the ranges. Corridors can turn anywhere.
- `'lattice'`: ADOM-style. Rooms start on odd coordinates and have odd dimensions, so the whole dungeon sits on the same lattice as a [maze](#mazes): floors on odd coordinates, walls between them. Corridors run along the lattice and exits are on odd coordinates along the wall. This keeps exits apart and rules out awkward corners.

In `lattice` mode the size ranges are narrowed to odd numbers: `{ min: 4, max: 10 }` becomes 5 to 9. A range that holds no odd number, such as `{ min: 4, max: 4 }`, is rounded up to the next odd size (5). Likewise `roomSpacing` is rounded up to an odd number.

### Connections

Rooms are joined in a tree, which means one link fewer than there are rooms. Extra links for exits and loops come on top of it. `connection` decides which links make the tree:

- `'nearest'` (the default) links the closest rooms first, between rooms that are not connected yet.
- `'bsp'` joins rooms the way a BSP dungeon does. The rooms are cut in two, by a vertical or a horizontal cut, and each half is cut again, until single rooms are left. A cut runs across the axis where the centers of the rooms are more spread out, and it splits the rooms in half by their order along that axis. Every cut then gets one link, between the closest pair of rooms on its two sides. The smallest cuts are joined first, so rooms are joined into small clusters, and the clusters are then joined into larger ones. The cuts are worked out from where the rooms are, so `bsp` connections work with any `partition` and placement, with templated rooms and with symmetry, and not only with `partition: 'bsp'`. The result has long, straight links between clusters, where `nearest` has many short ones.
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

Both generators honor `exitsPerRoom`. It is a `Range`. Every room draws its own wanted number of exits from it, so `{ min: 1, max: 1 }` means one exit each, `{ min: 2, max: 4 }` means several and `{ min: 1, max: 3 }` (the default) is random with at least one.

- A room with fewer links than it wants gets extra links to its nearest neighbors, which makes loops.
- A room with more links than it wants uses its exits for several corridors: the extra corridors branch off the ones leaving through its exits, outside the wall.

This is best effort. A door shared with another room counts as an exit for both of them, and a room that cannot branch off anywhere, or has no neighbor to link to, gets one more exit or one fewer than wanted. Connectivity always takes priority.

### Loops

In both generators, after the rooms are connected, `loopChance` adds extra corridors between rooms that are connected already. Each room is considered with its three nearest neighbors, and every such pair that is not linked yet gets one roll. A loop is never made by crossing another corridor and respects `exitsPerRoom`, so it is only added where there is room for it. At 0 the corridors form a tree (with the odd exception where a corridor had to cross another); at 1 every pair of neighbors is linked where possible.

### Dead ends

In both generators, `deadEndChance` is the chance that a corridor sprouts a branch that leads nowhere, roughly 3 to 8 tiles long, from a random tile of the corridor. At 0, the default, there are no dead ends at all.

### The digger

```ts
import { generateDigDungeon } from 'angstloch';

const { grid, rooms, exits } = generateDigDungeon({
  width: 61,
  height: 41,
  corridorLength: { min: 2, max: 10 },
});
```

`generateDigDungeon` takes all the [`DungeonOptions`](#dungeonoptions) except that there is no partitioning, and returns a [`DungeonResult`](#dungeonresult). It digs the dungeon like this:

1. It starts with one room in the middle of the map.
2. It repeats the following until `fill` and `roomCount` are met, or the map is full (300 attempts in a row fail):
   - Pick where to dig from. Usually that is a new exit on the wall of a room that has fewer exits than it wanted (see [Exits per room](#exits-per-room)), but with a `branchChance` it is a tile of an existing corridor. The direction is random, tipped by `horizontalBias` and `verticalBias`, and by [corridor symmetry](#symmetry) if set.
   - Dig a corridor of `corridorLength` tiles. It mostly goes straight, as set by `straight`, and turns at most every other step. It follows the same rules as the [corridors of the room-first generator](#connections): it never runs alongside another corridor or passes diagonally beside one.
   - Put a room of a size within `roomWidth` and `roomHeight` at the end, with a gap in its wall where the corridor arrives. If the corridor or the room does not fit, because it hits something or comes within `roomSpacing` of another room, the attempt is dropped and nothing is dug.
3. It gives rooms the exits they want, and adds loops and dead ends, the way the room-first generator does.

Every room is connected to the first one by the corridor it was dug from, so all rooms can be reached. Digging stalls when every room has all its exits and there are no corridors to branch off. In that case rooms are given more exits than they wanted, so that digging can go on.

With [templates](#room-templates), the digger starts with the first template instead of a room of its own, placed in the middle of the map unless it has `positions` of its own. Digging then goes on from it and from its corridors as usual, and every other templated room is placed before digging starts and is an obstacle that new rooms and corridors keep away from. Once digging is done, those rooms are joined to the rest by corridors, before the extra exits, loops and dead ends are added. Templated rooms count towards `roomCount` and `fill`. With a symmetric layout, digging is mirrored only where the room it starts from has a twin, which takes `templateSymmetry`; without it, the steps that grow from a templated room are not mirrored. Templates work best with `generateRoomDungeon`, which has more freedom in where it puts them.

A `corridorLength` with a minimum of 0 sometimes skips the corridor and builds the new room right against the wall of its parent, with a single door in the wall between them, which needs `roomSpacing: 1`. With `lattice` placement, corridor lengths are rounded to what fits the lattice.

`DigDungeonOptions` add two options to `DungeonOptions`:

| Option           | Default              | Description                                                                                                                                |
| ---------------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `corridorLength` | `{ min: 1, max: 8 }` | Length of the corridor dug to the next room, in tiles, a `Range` of at least 0. 0 builds the room straight against the room it grows from. |
| `branchChance`   | `0.3`                | Chance that a new corridor is dug from an existing corridor instead of from a room, from 0 to 1.                                           |

The other options work as described in [`DungeonOptions`](#dungeonoptions). `roomSpacing` is the least number of wall tiles between the floors of two rooms, `fill` and `roomCount` decide when digging stops, and `placement: 'lattice'` puts rooms and corridors on the lattice of a maze. `sizeUniformity` applies, too. `partition`, `spacingUniformity` and `connection` belong to `generateRoomDungeon` only.

### Symmetry

Both generators take the same symmetry options, which are part of [`DungeonOptions`](#dungeonoptions).

```ts
import { generateDigDungeon } from 'angstloch';

const { grid } = generateDigDungeon({
  width: 61,
  height: 41,
  layoutSymmetry: 'both', // generateRoomDungeon takes the same options
});
```

There are two independent kinds of symmetry, each with a chance. They can be used together. At a chance of 1 the symmetry is applied everywhere. At 0 it is ignored completely, and the result is the same as with `none`. In between, it is applied to that share of the dungeon: the more, the closer to symmetric.

| Option                   | Default | Description                                                                                                                         |
| ------------------------ | ------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `layoutSymmetry`         | `none`  | Mirrors or rotates the layout of the dungeon about the center of the map: `none`, `horizontal`, `vertical`, `both` or `rotational`. |
| `layoutSymmetryChance`   | `1`     | How often the layout is symmetric, from 0 to 1.                                                                                     |
| `corridorSymmetry`       | `none`  | Makes corridors follow the pattern of a maze: `none`, `whirlpool` or `snowflake`.                                                   |
| `corridorSymmetryChance` | `1`     | How strongly corridors follow `corridorSymmetry`, from 0 to 1.                                                                      |

#### Layout symmetry

`layoutSymmetry` makes the dungeon look the same when mirrored or turned:

- `horizontal` mirrors it from left to right: the left half is the mirror image of the right half.
- `vertical` mirrors it from top to bottom.
- `both` does both at once, so that the dungeon is made of four mirrored quarters.
- `rotational` turns it by 180° about the center. The result looks the same upside down.

Rooms, corridors, exits and doors are all mirrored. A room and its _twins_ get the same exits (as far as the usual [exit counts](#exits-per-room) allow), and an exit and its twins are all open or all have a door, whatever `doorChance` is. Loops and dead ends are mirrored, too. Rooms that lie on an axis are their own twins. Both generators put a room in the middle of the map that is its own twin: the digger starts with it, and the room-first generator places it before all others. Every room is still reachable, and all the rules of corridors apply as usual.

`layoutSymmetryChance` is rolled for every room and corridor that is dug (or placed), and for every extra exit, loop and dead end. When the roll fails, the room or corridor gets no twins. Rooms without twins cannot take twins to anything they grow, so the unsymmetric parts stay unsymmetric. Where a mirrored room, corridor or exit would not fit, because it would collide with something, the whole step is skipped, which keeps a dungeon at chance 1 perfectly symmetric.

Things to know:

- `roomCount` and `fill` count every room, twins included. As rooms come in sets of up to four, the room count can end up a little short of `roomCount.max`, and a set that would exceed it is not built.
- The axes run through the center of the map. With `lattice` placement, a map with an even width or height is treated as one tile smaller, so that the axis falls on a lattice tile, and the last row or column stays empty as extra border: an 80 by 50 map is symmetric as if it were 79 by 49.
- The first room must sit exactly on the axis, which needs its size to have the same parity as the map (and, on the lattice, the right position on it). If its random size does not, it is made one step (2 on the lattice) wider, or narrower if it is as wide as it can be. It can therefore stray one step outside `roomWidth` or `roomHeight`, but only when the range has a single size.
- Symmetry changes what the generator makes, so the same seed gives another dungeon than without it.

How each generator applies the layout symmetry:

- The digger mirrors every step of digging (corridor, room, exits) as a whole. A step is only taken if all its mirror images fit.
- `generateRoomDungeon` mirrors the rooms and every link between them. With `scatter`, each room that is placed is mirrored together with its twins at the given chance, and rooms may lie on an axis. With `bsp`, only one half (or quarter) of the map is partitioned and its areas are mirrored; rooms never straddle an axis, apart from the middle room. With a chance below 1, a mirrored area gets a room of its own instead of a twin. A corridor that crosses an axis cannot be mirrored, as it would meet its own image, so the two halves are joined through the room in the middle. A room that cannot be linked symmetrically is dropped together with its twins, so the layout stays symmetric.
- For `generateRoomDungeon`, a `roomCount.max` below the size of a set of twins can leave few rooms; with `bsp`, `fill` is met roughly, as without symmetry, but less closely.

#### Corridor symmetry

`corridorSymmetry` is the symmetry of `generateMaze`, applied to the direction of corridors. It steers corridors by where they are on the map:

- `snowflake` makes corridors radiate from the center. Where a tile is further from the center horizontally than vertically, corridors there run horizontally, and the other way round.
- `whirlpool` makes them twirl around the center, with the same rule turned by 90°.

`corridorSymmetryChance` is how often the pattern applies, instead of `horizontalBias` and `verticalBias`. `straight` limits the effect:

- The digger picks the direction of a corridor at its start and whenever it turns, so corridors that never turn keep the direction they started in. Routed corridors of the extra links (exits, loops, dead ends) are steered, too.
- `generateRoomDungeon` routes corridors on a map where each tile has a preferred axis, chosen by the chance. Corridors prefer to follow it, as moving along the other axis costs more, but they still go wherever they have to.

Corridor symmetry does not make the layout symmetric.

### `DungeonOptions`

`DungeonOptions` are the options shared by all dungeon generators. `RoomDungeonOptions`, the options of `generateRoomDungeon`, add `partition`, `spacingUniformity` and `connection`. [`DigDungeonOptions`](#the-digger), the options of `generateDigDungeon`, add `corridorLength` and `branchChance`.

| Option                   | Default                      | Description                                                                                                                                                                                                                               |
| ------------------------ | ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `width`, `height`        | required                     | Map size in tiles.                                                                                                                                                                                                                        |
| `random`                 | `Math.random`                | Source of randomness.                                                                                                                                                                                                                     |
| `placement`              | `'free'`                     | `'free'` or `'lattice'`, see above.                                                                                                                                                                                                       |
| `roomWidth`              | `{ min: 3, max: 7 }`         | Room width in tiles, a `Range` of at least 1.                                                                                                                                                                                             |
| `roomHeight`             | `{ min: 3, max: 7 }`         | Room height in tiles, a `Range` of at least 1.                                                                                                                                                                                            |
| `sizeUniformity`         | `0`                          | How alike room sizes are, from 0 to 1. At 0 every size in the ranges is equally likely. Higher values pull sizes towards the middle of the ranges, and at 1 all rooms are the same size.                                                  |
| `roomCount`              | `{ min: 1, max: unbounded }` | Number of rooms, a `Range` of at least 0. Generation never exceeds `max`, and `fill` is only honored once `min` is reached.                                                                                                               |
| `roomSpacing`            | `1`                          | Fewest wall tiles between the floors of two rooms, a whole number of at least 1. With 1, rooms can sit right next to each other and share a door. With 3 or more a corridor fits between rooms.                                           |
| `fill`                   | `0.12`                       | Target share of the map covered by room floors, from 0 to 1. Corridors do not count. The last room may overshoot the target. Above roughly 0.15 the map gets cramped; below 0.1 it is sparse.                                             |
| `exitsPerRoom`           | `{ min: 1, max: 3 }`         | Number of exits per room, a `Range` of at least 1. See [Exits per room](#exits-per-room).                                                                                                                                                 |
| `loopChance`             | `0.1`                        | Chance of an extra corridor between each pair of nearby rooms that is not linked yet, from 0 to 1. See [Loops](#loops).                                                                                                                   |
| `deadEndChance`          | `0`                          | Chance that a corridor sprouts a dead end, from 0 to 1. See [Dead ends](#dead-ends).                                                                                                                                                      |
| `doorChance`             | `1`                          | Chance that an exit gets a door, from 0 to 1. Exits without a door are plain openings in the wall.                                                                                                                                        |
| `straight`               | `0.5`                        | Preference of corridors for going straight, from 0 to 1. At 0 corridors wander; at 1 they turn as little as possible.                                                                                                                     |
| `horizontalBias`         | `0`                          | Weight of horizontal corridor sections against `verticalBias`. Only the ratio matters, so set both; a lone value against 0 means always. The bias makes corridors prefer to leave rooms sideways (or up and down) and to detour that way. |
| `verticalBias`           | `0`                          | Weight of vertical corridor sections against `horizontalBias`.                                                                                                                                                                            |
| `layoutSymmetry`         | `none`                       | Mirrors or rotates the layout about the center of the map: `none`, `horizontal`, `vertical`, `both` or `rotational`. See [Symmetry](#symmetry).                                                                                           |
| `layoutSymmetryChance`   | `1`                          | How often the layout is symmetric, from 0 to 1.                                                                                                                                                                                           |
| `corridorSymmetry`       | `none`                       | Makes corridors follow a maze pattern: `none`, `whirlpool` or `snowflake`.                                                                                                                                                                |
| `corridorSymmetryChance` | `1`                          | How strongly corridors follow `corridorSymmetry`, from 0 to 1.                                                                                                                                                                            |
| `templates`              | none                         | Prefabricated rooms, see [Room templates](#room-templates).                                                                                                                                                                               |
| `templateSymmetry`       | `false`                      | Whether templated rooms get mirror images, see [Room templates](#room-templates).                                                                                                                                                         |

`RoomDungeonOptions` adds:

| Option              | Default     | Description                                                                                                 |
| ------------------- | ----------- | ----------------------------------------------------------------------------------------------------------- |
| `partition`         | `'scatter'` | How rooms are placed, `'scatter'` or `'bsp'`, see [Placement of rooms](#placement-of-rooms).                |
| `connection`        | `'nearest'` | How rooms are joined by corridors, `'nearest'`, `'bsp'` or `'bsp-random'`, see [Connections](#connections). |
| `spacingUniformity` | `0`         | How evenly rooms are spread over the map, from 0 to 1.                                                      |

If a size range does not fit between the map edges, it is clamped to what fits. If not even the smallest room fits, no rooms are placed, and no error is thrown.

### Doors

The generator never decides what a door looks like, it only tells you where doors can go.

- Every opening in a room's wall is an exit and is listed in `exits`, whether it has a door or not.
- `doorChance` decides which exits get a door. In the grid an exit with a door is `Tile.Door` and one without is `Tile.Floor`.
- `Exit#door` tells which is which. To turn an exit without a door into a door, for example because a themed room requires one, use `Exit#position`; that tile is already open floor.
- `Room#exits` lists the exits of one room, and `Room#exitCount` and `Room#doorCount` give the totals.

```ts
const { rooms, exits } = generateRoomDungeon({
  width: 61,
  height: 41,
  doorChance: 0.5,
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

| Field   | Description                                                                                                |
| ------- | ---------------------------------------------------------------------------------------------------------- |
| `grid`  | The map. Room and corridor floors are `Tile.Floor`, doors are `Tile.Door`, everything else is `Tile.Wall`. |
| `rooms` | The rooms, in the order they were placed. `rooms.length` is the total number of rooms.                     |
| `exits` | Every exit of every room, with or without a door. Filter on `door` for the doors alone.                    |
| `fill`  | The share of the map actually covered by room floors, from 0 to 1.                                         |

### `Room`

| Field             | Description                                                                         |
| ----------------- | ----------------------------------------------------------------------------------- |
| `id`              | The room's index in `rooms`.                                                        |
| `x`, `y`          | Position of the room's top-left floor tile. The room's wall is not included.        |
| `width`, `height` | Dimensions of the room's floor in tiles.                                            |
| `exits`           | Indices into `DungeonResult#exits` (or `MazeResult#roomExits`) of the room's exits. |
| `exitCount`       | Number of exits of the room.                                                        |
| `doorCount`       | Number of exits of the room that have a door.                                       |
| `template`        | Templated rooms only: the index of the room's template in `templates`.              |
| `rotation`        | Templated rooms only: the clockwise rotation the template was placed in.            |
| `mirrored`        | Templated rooms only: whether the template was placed mirrored.                     |

For a templated room, `x`, `y`, `width` and `height` describe the template's bounding box, walls included, as the floor of such a room need not be a rectangle. Ordinary rooms have no `template`, `rotation` or `mirrored`.

### `Exit`

| Field      | Description                                                                                                                |
| ---------- | -------------------------------------------------------------------------------------------------------------------------- |
| `position` | The wall tile of the gap, as a `Point`.                                                                                    |
| `rooms`    | Ids of the rooms the exit belongs to: one, or two when a single door joins two rooms that face each other across one wall. |
| `door`     | Whether a door was placed.                                                                                                 |

### Room templates

Pass templates to either generator in the `templates` option. A `RoomTemplate` is a player-made room: a rectangular design that is placed in a dungeon as it is, with the corridors dug around it. The design is a grid of `TemplateCell` values, written as rows:

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

`areas` say where copies without a position go, when you care about the region and not the exact spot, for example near the sides of the map: give a strip on each side. A copy picks one of the areas at random and is placed at a random valid spot inside it, in any allowed variant. The copy's whole bounding box must lie inside the area. If the picked area has no room for it, the other areas are tried, and if none has, placing throws a `TemplatePlacementError`: a template with areas is never placed outside them. An area must be a rectangle of whole numbers, at least 1 by 1, within the map, and at least one allowed variant must fit in at least one area, or the template is rejected with a `RangeError` before anything is generated. `positionAccuracy` only applies to positions. With `templateSymmetry`, a copy is only placed where its mirror images fit too, but they need not lie inside an area. The digger starts with the first template in the middle of the map unless it has `positions` or `areas`.

A spot is valid if the room's footprint, which is every cell but the `Unused` ones and so includes the template's walls, lies within the map and keeps its distance from other rooms' footprints, and if the exits have room. Distance works like this:

- With a `roomSpacing` of 1, as for ordinary rooms, templates may touch and **share walls**. Two cells may sit on the same tile only if both are walls (an `OptionalExit` counts as a wall where it is not opened), or if both are an `Exit` or a `Door` that line up as a doorway: they leave in opposite directions, with the floor of one room on each side. Anything else on the same tile, such as a floor on a wall or a doorway on a wall, is a collision. A doorway that two templates share is a single exit of both rooms, listed once in `exits` with both room ids, and it needs no corridor. Spots that touch no other room are preferred when a copy is placed at random; a copy with a position is placed exactly there if it is valid, shared walls or not.
- With a `roomSpacing` of 2 or more, footprints must be more than `roomSpacing` tiles apart, and nothing is shared.

Exits need room as well: every `Exit` and `Door` needs either a shared doorway or a free tile outside it to start a corridor from, one tile or more away from the map edge, and at least one exit candidate of any kind needs that free tile, so that every templated room can reach out on its own. Templates may sit in each other's bounding boxes as long as their footprints keep to these rules.

On the lattice (`placement: 'lattice'`) a template's bounding box sits on even coordinates, so that walls fall on even tiles and floors on odd ones, and only variants with an odd width and height are used. Variants that do not fit the lattice are not used.

#### In a dungeon

`generateRoomDungeon` places the templates before anything else, in the order of the list, and carves them as they are. ([`generateDigDungeon`](#the-digger) does the same, and starts digging from the first one.) The ordinary rooms are placed afterwards around them, at least `roomSpacing` tiles from a template's footprint and leaving the tile in front of each of its exits free, and corridors never cut through a template's walls. The templated rooms come first in `rooms`, copies of a template together, and are described by `template`, `rotation` and `mirrored`.

```ts
import { generateRoomDungeon } from 'angstloch';

const { grid, rooms } = generateRoomDungeon({
  width: 61,
  height: 31,
  templates: [
    { ...cross, positions: [{ coords: { x: 30, y: 15 }, anchor: 'center' }] },
  ],
});
```

- A templated room counts towards `roomCount`, and its floor, doors included, towards `fill`. The `fill` of the result includes it.
- Every `Exit` and `Door` cell that leads outside is opened and joined to the rest of the dungeon by a corridor, whatever `exitsPerRoom` says. Those exits count towards the room's `exitsPerRoom`, so a room with more fixed exits than the range asks for simply has more.
- `OptionalExit` cells are opened only as far as `exitsPerRoom` asks for more exits, and only where a corridor can start. If a template has no more exits than its fixed ones, it gets no others.
- `Exit` cells become doors by `doorChance`, and `Door` cells always do. They are listed in `exits`, and `Exit` and `Door` cells inside the template, which lead nowhere, are tiles only: they are not listed, and the same `doorChance` applies to the `Exit` ones.
- Every exit has a corridor tile in front of it and corridors keep the usual distance from one another, so a door cannot be sidestepped and corridors cannot be crossed diagonally.
- With `templateSymmetry` set and a `layoutSymmetry` other than `none`, every copy of a template brings its mirror images along, always and whatever `layoutSymmetryChance` is. An image is the geometric image of the copy, whatever `rotate` and `mirror` allow, and `rotation` and `mirrored` describe it accordingly. A copy is only placed where its images fit too, and an image that equals the copy (a centered, symmetric template) is not added. Without `templateSymmetry`, a template is placed once per copy, even with a symmetric layout. `templateSymmetry` has no effect without a layout symmetry.
- The corridor rules can occasionally box in the fixed exit of a template. The ordinary rooms and corridors are then built again (dug again, by the digger), up to ten times. If it still fails, the templates are placed again and the dungeon is built again, up to three times in all, before giving up with a `TemplatePlacementError`.

With `placement: 'lattice'`, a template that cannot sit on the lattice is rejected before anything is generated, with a `RangeError` that names it: at least one of its variants must have an odd width and height, every `Exit` and `Door` that leads outside must face a tile with odd coordinates, which is where corridors start, and so must at least one exit candidate of any kind. Design lattice templates with their walls on even and their floors on odd rows and columns of the template, and exits on the walls at odd positions along them. An example is a 3x3 template with a floor in the middle and one exit in the top wall.

A template is never skipped silently, since a map may need it (a boss arena, a scripted ruin). When a template finds no place in a dungeon, a mine or a forest, a new map is generated, up to three in all, and only then a `TemplatePlacementError` is thrown: at that point the input is at fault and not the map, as every attempt failed. Errors that no other map could fix, such as a template bigger than the map or one that fits no lattice, are thrown at once. Mazes always have a lattice, so a template that does not fit throws at once there. Its message says which template (by `name` and index) and why, and its `templateIndex` and `templateName` fields carry the same. A template that cannot be joined to the rest of the dungeon throws the same error.

## Composing maps

A map can be composed from an empty base and a list of steps, like middleware, instead of one generator with many options. `pipeline` runs the steps in order, merges what each reports into the map state, and builds the map again from the start when a step throws. The first ready-made step is [`plantTrees`](#planttrees), and the rest of the forest follows (see the roadmap); you can write steps of your own, and the machinery is the same.

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

### `emptyMap`

`emptyMap({ width, height, tile })` is the start of a pipeline: a map of one tile, grass for a forest and a wall for a dungeon or a mine. The dimensions and the tile are checked at once, and a bad one throws a `RangeError`. It returns a factory (`MapBase`, a function that returns a `MapState`), so that every attempt starts from a fresh state. Any function that returns a state works in its place.

### `MapState`

The map while it is built: `{ grid, base, prunable, ...extras }`.

- `grid` is the `Grid`.
- `base` is the tile the map started as. A tile that still holds it is untouched ground.
- `prunable` is a `Uint8Array` with a byte per tile, row by row: 1 where the tile is ground cover that a later step may remove (a tree), 0 elsewhere. A step that lays something down clears the byte of its tiles, so that a later step does not take a wall or a road for ground cover. `stampTile(state, x, y, tile)` sets a tile and clears its byte in one go, and throws a `RangeError` outside the grid.
- The extras are what the steps return: `streams`, `roads`, and so on.

### `step`

`step(name, spec, run)` makes a `MapStep`. `run(state, context)` changes `state.grid` and `state.prunable` in place and returns the extras the step adds, which the pipeline merges into the state (a later extra replaces an earlier one of the same name). It never mutates anything else.

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

A verge is the strip beside a feature that is kept clear of ground cover. Steps that lay a feature (`addStreams` so far, roads and the rest as they arrive) take the three fields of a `Verge` among their options, and you can use the same code in a step of your own: `pruneVerge(state, mask, verge, random)`, where `mask` is a `Uint8Array` with a byte per tile, 1 where the feature is.

| Field       | Default       | Meaning                                                                                                                                                                                                                          |
| ----------- | ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `clearance` | 0             | Whole tiles beside the feature with no ground cover at all. Tiles count in any direction, so 1 clears all eight neighbors, diagonals included.                                                                                   |
| `falloff`   | 0             | Whole tiles beyond the clearance over which the cover thickens from none to full, in equal steps: with 3, the first tile keeps a quarter of its cover, the next half, the next three quarters, and the one after that all of it. |
| `distance`  | `'chebyshev'` | How the distance to the feature is measured: `'chebyshev'` makes square verges, `'manhattan'` diamonds and `'euclidean'` round ones.                                                                                             |

`pruneVerge` touches prunable tiles only: a tile it removes goes back to the base tile and stops being prunable, and everything else, such as a road or a wall stamped by another step, is left alone. A tile in the falloff is removed with the chance that the ramp gives, so a tree planted with chance `p` ends up with `p` times the share kept. Verges from several steps add up, so where two overlap, slightly more is pruned than either alone. In a map with nothing prunable (a dungeon) it does nothing.

### `addStreams`

`addStreams(options?)` is a step that lays a stream or a river across the map: a main stream from one border to the opposite one (or from a spring), with shallow banks, deep water in the middle when it is wide enough, and optional tributaries. It paints over whatever is there, so it does not matter whether it runs before or after `plantTrees`, but only a `plantTrees` that ran before it lets it clear trees. A stream is a road made of water, so most options work like those of a [road](#roads) and are described in [Streams and rivers](#streams-and-rivers); the same fields are accepted here, apart from the bridges, which belong to the steps that lay them (`bridges` and `bridgeAngle` are not options of this step).

```ts
const { grid, streams } = pipeline(
  emptyMap({ width: 80, height: 50, tile: Tile.Grass }),
  [
    plantTrees(),
    addStreams({
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

### `addRoads`

`addRoads(options?)` is a step that lays roads: a main road from one border to the opposite one, with the crossings and branches that [`RoadOptions`](#roads) ask for, or the exact `specs`. It paints road tiles over whatever is there and then clears the trees of its verge. Every option is checked when the step is made, and a bad one throws a `RangeError` at once.

```ts
const { grid, roads, bridges } = pipeline(
  emptyMap({ width: 80, height: 50, tile: Tile.Grass }),
  [
    plantTrees(),
    addStreams({ width: { min: 2, max: 3 }, tributaries: { min: 1, max: 1 } }),
    addRoads({
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
- **Streams.** When the state has `streams` (an `addStreams` step ran before), a generated road is planned across them: it is bent to cross at `bridgeAngle`, straight and square to the stream for the length of the bridge, and a road tile over water becomes `bridgeTile` along that straight run. A road tile over water that is no part of a crossing gives way to the water: a road that clips a bank, or runs along a stream, does not make a bridge. The roads of `specs` are not bent. They are bridged where they span the water. Without `streams` the step works on dry land, and `bridgeAngle` has no effect.
- **Order.** `addStreams` must come before it. Put `plantTrees` first, so that the verge has trees to clear.
- **Diagnostics.** Through the `trace` option of [`pipeline`](#pipeline) the step reports `trace('addRoads', { grown, plans })`: `grown`, the centerline of every generated road as it was grown, before the streams bent it, and `plans`, a `CrossingPlan` for every road that comes near a stream (its `start`, `end`, and for each crossing the `approach`, `entry`, `exit` and `departure` tiles, which are where the road turns onto and off the straight run, and where it reaches and leaves the water). Nothing is traced unless `trace` is given.

### `placeClearings`

`placeClearings({ clearings, spacing?, falloff?, distance? })` is a step that places clearings: glades with ragged edges, free of trees. It stamps nothing, since a clearing is ground, and removes the trees inside the ragged shape and across a falloff beyond it. Run it after `plantTrees`, so that there are trees to clear, and after `addStreams` and `addRoads`, which it reads. Every option is checked when the step is made, and a bad one throws a `RangeError` at once; a clearing whose center lies outside the map throws a `RangeError` too, from `pipeline` before the first attempt, since the step checks it in its `validate`.

```ts
const { clearings } = pipeline(
  emptyMap({ width: 80, height: 50, tile: Tile.Grass }),
  [
    plantTrees(),
    addRoads({
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

## Playground

A visual playground for the generators lives in `demo/`. It is not published to NPM. Run it with `npm run dev`; the maze, the dungeons, the caves, the mines, the forests, the noise and the steps each have their own page, and the dungeon page switches between the room-first generator and the digger, and has a **Connection** select (nearest, bsp or bsp-random) next to the partition for the room-first one. The symmetry controls apply to both generators. The dungeon page has a Templates panel: add, duplicate and remove [room templates](#room-templates), set their count, rotations, mirroring, accuracy, positions and areas, and paint their cells by clicking and dragging with the chosen brush. Templates are kept in the browser's local storage and can be exported and imported as JSON, which is the same list of `RoomTemplate` objects that the `templates` option takes. Templated rooms are outlined on the map and labeled with their template's index, and errors such as a template that does not fit show up under the map.

All pages have a **Display** switch. `simple` paints plain colored squares. `roguelike` shows the map the way a roguelike would, as colored ASCII glyphs on a black background, in the colors of an ANSI terminal: wall `#` (#555555), floor `.` (#aaaaaa), door `+` (#aa5500), grass `.` (#00aa00), tree `T` (#55ff55), road `.` (#aa5500), bridge `#` (#aa5500), shallow water `≈` (#5555ff), deep water `≈` (#0000aa) and a floor with a potential exit `.` (#5555ff). Walls with only walls around them (diagonals included, the map edge counting as wall) are left blank.

The maze page has the same room controls: the count, size and exits of ordinary [rooms](#rooms-in-mazes) (a maximum count of 0 means no rooms), the door chance, and the same Templates panel under the map, which is shared with the dungeon page. Tick **Use templates** to place them in the maze, mind that they must fit the lattice. Templated rooms are outlined, and room openings without a door are highlighted by **Show room gaps**.

The **Download PNG** button next to the switch saves the map as currently displayed (in either mode, at the chosen tile size) as `angstloch-maze.png`, `angstloch-dungeon.png`, `angstloch-cave.png` or `angstloch-mine.png`, handy for illustrating settings. On the dungeon page the exit highlight follows the "Show exits" checkbox.

The forest page has a control for every `ForestOptions` field, including a switch for the road with its angle (blank for random), width and windiness, the clearance, the falloff and the distance model (chebyshev, manhattan or euclidean), any number of clearings (an **Add clearing** button adds a row with a position (or **At** a branch end), radii as min and max (blank y radii mean the same as x), angle and irregularity; a blank position means a random place, plus its road distance range and a **Path** checkbox with the path's width and windiness), the clearing spacing, the crossings and branches with all their options (branch length is only limited when **Limit branch length** is ticked), **Mark junctions** (red squares) and **Mark road exits**, **Show grown roads** (a small magenta dot on every tile of each generated road as it was grown, before the streams bent it), **Show crossing plans** (outlined squares on the planned ends of each road and on the waypoints of its crossings: cyan where the road turns onto and off the straight run, yellow at both banks), a **Stream** switch with its angle (blank for random), a **Spring** switch, the least number of bridges, width, windiness, shore width, tributaries (count, width, angle and, when **Limit tributary length** is ticked, length), the bank clearance and falloff, and the bridge angle, a switch between grass-and-tree and floor-and-wall tiles (where deep water becomes a wall), and a **density** display that paints the chance of a tree on every tile, stretched over the range from `minDensity` to `maxDensity`: white for thick woods and black for glades, so you can see what the noise settings do before the trees are rolled. In the `roguelike` display, grass is a green `.` and a tree a darker green `T`.

The mine page has a control for every `MineOptions` field (hall entrances is a select of `facing` and `edge`), with the ranges as a min and a max, a blank angle for a random one, and a blank density, hall size or ring count for the default. The stats line shows the share of floor, the number of tunnels and the exits, and **Mark tunnels** paints the middle line of the main shaft red and of the other tunnels (adits, veins, rings and spokes) blue, **Mark halls** outlines the halls of the pillars layout, and **Mark caverns** outlines the caverns, the room count (a maximum of 0 means no rooms), size, exits and door chance work as on the maze page, and its Templates panel, shared with the maze and dungeon pages, takes templates with **Use templates**, which are outlined and labeled by **Outline templates**.

The noise page paints a `NoiseFunction` as gray squares, black for -1 and white for 1, with controls for the size, the seed, the fractal options and the transform: `scaleX`, `scaleY` and `rotation`. The fractal controls start at the defaults of `createFractalNoise`, and the scales start at 40, which is a size that shows a few features on the default map. The stats line shows the lowest, highest and mean value.

The steps page shows how [`pipeline`](#composing-maps) works, with [`plantTrees`](#planttrees), [`addStreams`](#addstreams) (a **Stream** switch with its angle (blank for random), width, windiness and tributaries, and the clearance and falloff of its bank), [`addRoads`](#addroads) (a **Roads** switch with angle (blank for random), width, windiness, crossings, branches, the bridge angle, and the clearance and falloff of its verge; **Show grown roads** puts a small magenta dot on every tile of a road as it was grown, and **Show crossing plans** outlines the ends of each road and the waypoints of its crossings, cyan where the road turns onto and off the straight run and yellow at both banks, both fed by `trace` and shown from the `addRoads` step on), a `border` step of its own that stamps a border with `stampTile` and then clears a [verge](#verges-and-pruneverge) round it with `pruneVerge`, and a `flaky` step that throws with the **Failure chance** you set, to show the retries. Controls: the size, the seed, the base tile, the planted tile (any of tree, wall, floor or grass, on any base, so a steppe of rocks on floor is a click away), the density range and scale of the noise, the border tile, the verge's clearance, falloff and distance, the failure chance and the number of attempts. **Show after step** picks the map after any step of the last attempt, starting with the base, through `onStep`. The stats line gives the attempts, the failures and how many tiles are still prunable, and the failures are listed under the map.

The cave page has a control for every `CaveOptions` and `NoiseCaveOptions` field. Its **Generator** select switches between the automaton and the [noise cave](#noise-caves); the controls that belong to one generator only are marked "(automaton)" or "(noise)", and the others (connection, symmetry, exits, border walls) apply to both. The limits are blank by default, which means the defaults of the chosen neighborhood. The stats line shows the number of floor tiles, regions and exits, and **Mark region centers** highlights the `center` of every region, which makes it easy to see what `connect` and `minRegionSize` do to the caverns.

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
