# angstloch

A suite of map generators for roguelike games, on a 2D square grid. Written in TypeScript, ESM only, with no runtime dependencies. The generators use no DOM or Node APIs, so they run in a browser, Node or a web worker.

Currently available:

- [`generateMaze`](#mazes): perfect and braid mazes.
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
grid.toString(); // '#' wall, '.' floor, '+' door, one line per row
```

Positions are plain `{ x, y }` objects (`Point`). `x` grows to the right and `y` grows downwards.

The numeric values of `Tile` are part of the public contract and never change; new kinds may be added.

| Tile         | Value | Meaning                                                 |
| ------------ | ----- | ------------------------------------------------------- |
| `Tile.Wall`  | 0     | Solid rock.                                             |
| `Tile.Floor` | 1     | Passable floor.                                         |
| `Tile.Door`  | 2     | A potential door placement. What to put there is yours. |

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

| Option            | Default       | Description                                                                                                                      |
| ----------------- | ------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `width`, `height` | required      | Map size in tiles, at least 3.                                                                                                   |
| `random`          | `Math.random` | Source of randomness.                                                                                                            |
| `horizontalBias`  | `0`           | Weight of horizontal corridors against `verticalBias`. Only the ratio matters, so set both; a lone value against 0 means always. |
| `verticalBias`    | `0`           | Weight of vertical corridors against `horizontalBias`.                                                                           |
| `loopChance`      | `0`           | Chance of turning a dead end into a loop: 0 is a perfect maze, 1 a braid maze.                                                   |
| `fill`            | `1`           | Fraction of the maze to carve, from 0 to 1.                                                                                      |
| `symmetry`        | `'none'`      | `'whirlpool'` twirls corridors around the map center, `'snowflake'` makes them radiate from it.                                  |
| `symmetryChance`  | `1`           | How strongly symmetry is enforced, from 0 to 1.                                                                                  |
| `straight`        | `0`           | Preference for continuing straight, from 0 to 1.                                                                                 |
| `minExits`        | `0`           | Minimum number of exits to add on the map border.                                                                                |
| `maxExits`        | `minExits`    | Maximum number of exits.                                                                                                         |
| `start`           | near center   | Where carving starts. Must be a cell with odd coordinates.                                                                       |

### `MazeResult`

| Field   | Description                                 |
| ------- | ------------------------------------------- |
| `grid`  | The maze.                                   |
| `start` | The cell where carving started.             |
| `exits` | Door tiles on the map border, one per exit. |

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

> **Work in progress.** Prefabricated rooms are on the way. Existing options and result fields will keep working as documented here.

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

Corridors are one tile wide. They stay a tile away from the walls of rooms, except where they leave through an exit, and they never run alongside another corridor, which would make a section two tiles wide, nor diagonally past one, which would let a diagonal step jump from one corridor to the other. Corridors do not touch themselves either. If the direct route is blocked, a corridor may cross an existing one, but only straight on. A corridor that would have to wind far around to get anywhere is not built; another route is tried instead.

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

| Field             | Description                                                                  |
| ----------------- | ---------------------------------------------------------------------------- |
| `id`              | The room's index in `rooms`.                                                 |
| `x`, `y`          | Position of the room's top-left floor tile. The room's wall is not included. |
| `width`, `height` | Dimensions of the room's floor in tiles.                                     |
| `exits`           | Indices into `DungeonResult#exits` of the room's exits.                      |
| `exitCount`       | Number of exits of the room.                                                 |
| `doorCount`       | Number of exits of the room that have a door.                                |

### `Exit`

| Field      | Description                                                                                                                |
| ---------- | -------------------------------------------------------------------------------------------------------------------------- |
| `position` | The wall tile of the gap, as a `Point`.                                                                                    |
| `rooms`    | Ids of the rooms the exit belongs to: one, or two when a single door joins two rooms that face each other across one wall. |
| `door`     | Whether a door was placed.                                                                                                 |

## Playground

A visual playground for the generators lives in `demo/`. It is not published to NPM. Run it with `npm run dev`; the maze and the dungeons each have their own page, and the dungeon page switches between the room-first generator and the digger. The symmetry controls apply to both generators.

Both pages have a **Display** switch. `simple` paints plain colored squares. `roguelike` shows the map the way a roguelike would, as colored ASCII glyphs on a black background: wall `#` (#555555), floor `.` (#aaaaaa), door `+` (#aa5500) and a floor with a potential exit `.` (#5555ff). Walls with only walls around them (diagonals included, the map edge counting as wall) are left blank.

The **Download PNG** button next to the switch saves the map as currently displayed (in either mode, at the chosen tile size) as `angstloch-maze.png` or `angstloch-dungeon.png`, handy for illustrating settings. On the dungeon page the exit highlight follows the "Show exits" checkbox.

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

BSD-2-Clause
