# angstloch

A suite of map generators for roguelike games, on a 2D square grid. Written in TypeScript, ESM only, with no runtime dependencies. The generators use no DOM or Node APIs, so they run in a browser, Node or a web worker.

Currently available:

- [`generateMaze`](#mazes): perfect and braid mazes.
- [`generateCave`](#caves): organic caves, grown with a cellular automaton. _Work in progress._
- [`createSimplexNoise`](#noise): smooth 2D noise that can be stretched and turned, for terrain-like maps. Forests are built on it.
- [`generateForest`](#forests): forests of scattered trees with clearings and denser stands, from noise. _Work in progress._
- [`generateRoomDungeon`](#dungeons): room-first dungeons: rooms are placed first and joined by corridors afterwards. _Work in progress._
- [`generateDigDungeon`](#the-digger): dungeons that are dug: corridors and rooms grow out of a first room. _Work in progress._

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
grid.toString(); // '#' wall, '.' floor, '+' door, '"' grass, 'T' tree, one line per row
```

Positions are plain `{ x, y }` objects (`Point`). `x` grows to the right and `y` grows downwards.

The numeric values of `Tile` are part of the public contract and never change; new kinds may be added.

| Tile         | Value | Meaning                                                 |
| ------------ | ----- | ------------------------------------------------------- |
| `Tile.Wall`  | 0     | Solid rock.                                             |
| `Tile.Floor` | 1     | Passable floor.                                         |
| `Tile.Door`  | 2     | A potential door placement. What to put there is yours. |
| `Tile.Grass` | 3     | Open ground of an outdoor map.                          |
| `Tile.Tree`  | 4     | A tree. Whether it blocks movement or sight is yours.   |

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

- `'tunnel'` (the default) digs tunnels until the whole map is one cavern. The largest cavern is joined to the cavern nearest to it first, then the joined group to the nearest one after that, and so on. That keeps tunnels short, and joins caverns in a tree-like way, with no deliberate loops. A tunnel runs from the closest pair of tiles of the two caverns, and may cross a third cavern on its way, which joins that one as well. It only ever turns rock into floor, so no floor tile is lost.
- `'largest'` fills in every cavern but the largest.
- `'none'` leaves the caverns as the automaton made them.

`minRegionSize` applies first, so a pocket that is too small is filled in and never gets a tunnel. The shape of tunnels is set by `tunnelStyle`:

- `'winding'` (the default) digs a random walk from one end to the other. Each step either heads for the other end or goes in a random direction, and `tunnelWindiness` sets how often it wanders: with 0, the tunnel runs close to a straight line with only small jitters, and with 1 it meanders a lot. The tunnels are longer for it.
- `'direct'` digs a line with at most one bend, horizontal first or vertical first at random. `tunnelWindiness` has no effect.

`tunnelWidth` makes the tunnels wider, which suits caves that are meant to be roomy. With `borderWalls`, tunnels never touch the outermost ring of tiles.

### `CaveOptions`

| Option            | Default                                | Meaning                                                                                                                                                |
| ----------------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `width`           |                                        | Map width in tiles. Required.                                                                                                                          |
| `height`          |                                        | Map height in tiles. Required.                                                                                                                         |
| `random`          | `Math.random`                          | Source of randomness.                                                                                                                                  |
| `fillChance`      | 0.45                                   | Chance that a tile starts as a wall, from 0 to 1.                                                                                                      |
| `iterations`      | 4                                      | Number of smoothing passes. 0 leaves the raw noise.                                                                                                    |
| `neighborhood`    | `'moore'`                              | `'moore'` counts the 8 surrounding tiles, `'von-neumann'` the 4 that share an edge.                                                                    |
| `birthLimit`      | 5 for `'moore'`, 3 for `'von-neumann'` | Wall neighbors needed to turn a floor tile into a wall. A whole number, 0 or more.                                                                     |
| `survivalLimit`   | 4 for `'moore'`, 2 for `'von-neumann'` | Wall neighbors needed for a wall tile to stay a wall. A whole number, 0 or more.                                                                       |
| `borderWalls`     | `true`                                 | Keeps the outermost ring of tiles solid wall.                                                                                                          |
| `minRegionSize`   | 0                                      | Fills in every cavern smaller than this many tiles. 0 keeps all.                                                                                       |
| `connect`         | `'tunnel'`                             | What to do with caverns that are not joined: `'tunnel'` digs tunnels between them, `'largest'` fills in all but the largest one, `'none'` leaves them. |
| `tunnelStyle`     | `'winding'`                            | The shape of tunnels: `'winding'` meanders, `'direct'` has at most one bend.                                                                           |
| `tunnelWidth`     | 1                                      | The width of tunnels in tiles. A whole number, 1 or more.                                                                                              |
| `tunnelWindiness` | 0.5                                    | How much `'winding'` tunnels wander, from 0 to 1.                                                                                                      |

The limits are counted out of 8 neighbors for `'moore'` and out of 4 for `'von-neumann'`, which is why the defaults differ. A limit above the number of neighbors can never be reached, so a `birthLimit` of 9 stops floor from ever turning into a wall. A non-positive size, a `fillChance` or `tunnelWindiness` outside 0 to 1, a `tunnelWidth` that is not a whole number of at least 1, or a limit, `minRegionSize` or `iterations` that is not a whole number of at least 0 throws a `RangeError`.

### Exits

`minExits` and `maxExits` add openings on the map border, for a game to join the cave to its surroundings. The number of exits is picked between the two. An exit is a `Door` tile on the border and, unless a cavern already reaches the border, a straight tunnel from it to the nearest floor.

Each exit goes on a random side of the map. On that side, the exit is put where the tunnel is shortest, going straight in from the border. Exits are never next to each other, corners are never used, and a side with no floor in line with its border is skipped. When no side can reach any floor, fewer exits than asked for are made, which happens on a map with no floor at all. Exit tunnels are one tile wide whatever `tunnelWidth` is, and they are part of the cavern that they reach.

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

### `ForestOptions`

| Option        | Default       | Meaning                                                                                                                                                                 |
| ------------- | ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `width`       |               | Map width in tiles. Required.                                                                                                                                           |
| `height`      |               | Map height in tiles. Required.                                                                                                                                          |
| `random`      | `Math.random` | Source of randomness.                                                                                                                                                   |
| `minDensity`  | 0             | The chance of a tree where the noise is at its lowest, from 0 to 1.                                                                                                     |
| `maxDensity`  | 0.25          | The chance of a tree where the noise is at its highest, from 0 to 1. With the same value as `minDensity`, trees are scattered evenly.                                   |
| `scaleX`      | 40            | Size in tiles of a feature of the noise along the x axis, before rotation. Larger values make broader woods and glades. A positive number.                              |
| `scaleY`      | 40            | The same along the y axis. Different scales stretch the woods.                                                                                                          |
| `rotation`    | 0             | Clockwise rotation of the noise in degrees. A stretched wood runs diagonally with a rotation of 45. See [`transformNoise`](#noise).                                     |
| `octaves`     | 1             | Layers of the built-in noise, each finer than the one before. With 1 there is a single layer, and `persistence` and `lacunarity` do nothing. A whole number, 1 or more. |
| `persistence` | 0.2           | How much each layer counts against the one before it, from 0 to 1. Only matters with more than one octave.                                                              |
| `lacunarity`  | 1             | How much finer each layer is than the one before it. A positive number. Only matters with more than one octave.                                                         |
| `noise`       | built-in      | A [`NoiseFunction`](#noise) to use instead of the built-in simplex noise.                                                                                               |
| `groundTile`  | `Tile.Grass`  | The tile for ground without a tree. Any `Tile` value, for instance `Tile.Floor`.                                                                                        |
| `treeTile`    | `Tile.Tree`   | The tile for a tree, for instance `Tile.Wall` for a forest that blocks like rock.                                                                                       |

An injected `noise` takes the place of the built-in simplex noise: it receives positions in noise units, which is the tile center divided by the scales after the rotation, and returns a number from -1 to 1. Anything outside that range is limited to it. Since it replaces the built-in noise, `octaves`, `persistence` and `lacunarity` do not apply to it; wrap it in [`createFractalNoise`](#noise) if you want layers. `scaleX`, `scaleY` and `rotation` apply to it as they do to the built-in noise.

Non-positive or non-integer dimensions, a `minDensity` or `maxDensity` outside 0 to 1, a `groundTile` or `treeTile` that is not a `Tile` value, and invalid noise options (see [Noise](#noise)) throw a `RangeError`.

### `ForestResult`

- `grid`: the map.
- `density`: the chance of a tree on every tile, from `minDensity` to `maxDensity`, as a `Float32Array` that runs row by row, so `density[y * grid.width + x]`. A game can use it to tell thick woods from glades, for instance to put mushrooms or a hunter's hut where the trees are few.

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

> **Work in progress.** Prefabricated rooms are supported by both generators (see [Room templates](#room-templates)). Existing options and result fields will keep working as documented here.

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

Rooms are linked shortest link first, between rooms that are not connected yet, so the links form a tree. For each link:

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

The other options work as described in [`DungeonOptions`](#dungeonoptions). `roomSpacing` is the least number of wall tiles between the floors of two rooms, `fill` and `roomCount` decide when digging stops, and `placement: 'lattice'` puts rooms and corridors on the lattice of a maze. `sizeUniformity` applies, too. `partition` and `spacingUniformity` belong to `generateRoomDungeon` only.

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

`DungeonOptions` are the options shared by all dungeon generators. `RoomDungeonOptions`, the options of `generateRoomDungeon`, add `partition` and `spacingUniformity`. [`DigDungeonOptions`](#the-digger), the options of `generateDigDungeon`, add `corridorLength` and `branchChance`.

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

| Option              | Default     | Description                                                                                  |
| ------------------- | ----------- | -------------------------------------------------------------------------------------------- |
| `partition`         | `'scatter'` | How rooms are placed, `'scatter'` or `'bsp'`, see [Placement of rooms](#placement-of-rooms). |
| `spacingUniformity` | `0`         | How evenly rooms are spread over the map, from 0 to 1.                                       |

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
- The corridor rules can occasionally box in the fixed exit of a template. The ordinary rooms and corridors are then built again (dug again, by the digger), up to ten times, before giving up with a `TemplatePlacementError`. The templates keep their places.

With `placement: 'lattice'`, a template that cannot sit on the lattice is rejected before anything is generated, with a `RangeError` that names it: at least one of its variants must have an odd width and height, every `Exit` and `Door` that leads outside must face a tile with odd coordinates, which is where corridors start, and so must at least one exit candidate of any kind. Design lattice templates with their walls on even and their floors on odd rows and columns of the template, and exits on the walls at odd positions along them. An example is a 3x3 template with a floor in the middle and one exit in the top wall.

A template that cannot be placed will always throw a `TemplatePlacementError` instead of being skipped silently. Its message says which template (by `name` and index) and why, and its `templateIndex` and `templateName` fields carry the same. A template that cannot be joined to the rest of the dungeon throws the same error.

## Playground

A visual playground for the generators lives in `demo/`. It is not published to NPM. Run it with `npm run dev`; the maze, the dungeons, the caves, the forests and the noise each have their own page, and the dungeon page switches between the room-first generator and the digger. The symmetry controls apply to both generators. The dungeon page has a Templates panel: add, duplicate and remove [room templates](#room-templates), set their count, rotations, mirroring, accuracy, positions and areas, and paint their cells by clicking and dragging with the chosen brush. Templates are kept in the browser's local storage and can be exported and imported as JSON, which is the same list of `RoomTemplate` objects that the `templates` option takes. Templated rooms are outlined on the map and labeled with their template's index, and errors such as a template that does not fit show up under the map.

All pages have a **Display** switch. `simple` paints plain colored squares. `roguelike` shows the map the way a roguelike would, as colored ASCII glyphs on a black background: wall `#` (#555555), floor `.` (#aaaaaa), door `+` (#aa5500), grass `.` (#55aa55), tree `T` (#1f7a2e) and a floor with a potential exit `.` (#5555ff). Walls with only walls around them (diagonals included, the map edge counting as wall) are left blank.

The maze page has the same room controls: the count, size and exits of ordinary [rooms](#rooms-in-mazes) (a maximum count of 0 means no rooms), the door chance, and the same Templates panel under the map, which is shared with the dungeon page. Tick **Use templates** to place them in the maze, mind that they must fit the lattice. Templated rooms are outlined, and room openings without a door are highlighted by **Show room gaps**.

The **Download PNG** button next to the switch saves the map as currently displayed (in either mode, at the chosen tile size) as `angstloch-maze.png`, `angstloch-dungeon.png` or `angstloch-cave.png`, handy for illustrating settings. On the dungeon page the exit highlight follows the "Show exits" checkbox.

The forest page has a control for every `ForestOptions` field, a switch between grass-and-tree and floor-and-wall tiles, and a **density** display that paints the chance of a tree on every tile, stretched over the range from `minDensity` to `maxDensity`: white for thick woods and black for glades, so you can see what the noise settings do before the trees are rolled. In the `roguelike` display, grass is a green `.` and a tree a darker green `T`.

The noise page paints a `NoiseFunction` as gray squares, black for -1 and white for 1, with controls for the size, the seed, the fractal options and the transform: `scaleX`, `scaleY` and `rotation`. The fractal controls start at the defaults of `createFractalNoise`, and the scales start at 40, which is a size that shows a few features on the default map. The stats line shows the lowest, highest and mean value.

The cave page has a control for every `CaveOptions` field. The limits are blank by default, which means the defaults of the chosen neighborhood. The stats line shows the number of floor tiles, regions and exits, and **Mark region centers** highlights the `center` of every region, which makes it easy to see what `connect` and `minRegionSize` do to the caverns.

## Development

```
npm run dev        # playground
npm run build      # build the library to dist/
npm test           # unit tests with coverage
npm run typecheck
npm run lint
npm run format
```

## License

BSD-3-Clause
