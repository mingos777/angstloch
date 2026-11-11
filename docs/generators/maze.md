# Mazes

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

`generateMaze` is a preset: a ready-made composition of [steps](../composing.md) on a map of `Tile.Wall`, with one key of its options per step, each holding the options of that step. A maze is made in this order:

1. **[Rooms and templates](#rooms-in-mazes)** when `rooms` is given: [`placeMazeRooms`](../steps/place-maze-rooms.md), with its options under `rooms`.
2. **The maze** itself: [`digMaze`](../steps/dig-maze.md), with its options under `maze`, on the whole map. It goes round the rooms.
3. **The openings** of the rooms when there are `rooms`: [`openMazeRooms`](../steps/open-maze-rooms.md), with its options under `openings`.
4. **Exits** on the border when `exits` is given: [`openExits`](../steps/open-exits.md), with its options under `exits`.

Each step takes only its own options, with the defaults of that step; nothing passes from one key to another. So a maze with a given `start` and rooms gives the same point to `rooms.keepClear`, or a room may cover the start and the attempt fails, and exits whose doors face the cells of the maze want `exits: { lattice: true }`.

When a step throws, as a template that finds no place or covers the start does, the map is built again, up to 3 times in all, before the error is thrown; `attempts` and `failures` in the result say how it went. A maze in part of a map, several mazes, or any other order are compositions of your own: run the steps with [`pipeline`](../composing.md#pipeline). Every option is checked before the first map is built, and a bad one throws a `RangeError` named after the option of its step.

## Example map

The map this code makes with seed 1 (`mulberry32` is defined in the [quick start](../../README.md#quick-start)):

<!-- map: generate-maze -->

```ts
import { generateMaze } from 'angstloch';

const result = generateMaze({ width: 79, height: 25, random: mulberry32(1) });
```

```text
###############################################################################
#.#...........#...#.........#.............#.....#.......#.......#.....#.......#
#.#.#######.#.#.#.###.#####.#.#.#########.###.#.#.#####.#####.#.#.#####.#####.#
#.#...#.#...#...#...#...#...#.#.#.....#.......#.#.#...#...#...#.#.#.....#...#.#
#.###.#.#.#########.###.#.###.###.###.#########.#.#.#####.#.###.#.#.#######.#.#
#.#...#.#...#...........#...#...#.#.#.......#.....#...#...#.#...#...........#.#
#.#.###.###.#.#################.#.#.#######.#######.#.#.###.###.#.###########.#
#...#.....#.#.#...........#...#.#.#.......#.......#.#.#.#.....#.#.#.......#...#
#.#######.#.###.#########.#.#.#.#.#######.#####.#.###.#.#####.#.#.#.#####.#.#.#
#.....#...#...#...#.....#...#.#.#.#.......#...#.#...#.#.#.....#.#.#...#.....#.#
#####.#.#.###.###.#.###.#.###.#.#.#.###.###.#.#.###.#.#.#.#####.###.#.#########
#...#.#.#.#.#...#.#...#.#...#.#...#.#...#...#.#.#...#...#.#...#...#.#.........#
#.#.#.#.#.#.###.#.###.#.#####.#####.#####.###.###.###.###.#.#.###.#####.#####.#
#.#.#...#.#.#...#.#.#.#.....#.....#.#...#.#...#...#...#...#.#...#.....#.#.....#
#.#.#####.#.#.###.#.#.#####.#.###.#.#.###.#.###.###.###.#######.#####.#.#.###.#
#.#.#.....#.#.......#.#.....#.#.....#.#...#.....#.#.#...#.......#.#...#.#...#.#
#.#.#.#####.#########.#.#####.#######.#.#########.#.#.###.#####.#.#.#######.#.#
#.#.#.......#.........#.......#.....#.#.#.........#.#.#...#.....#.#...#...#.#.#
#.#.#####.###.#################.###.#.#.#.#######.#.#.#.#####.###.###.#.#.#.#.#
#.#.#.....#...#.....#.........#...#.#...#.#.#.....#...#.#...#.......#...#.#.#.#
###.#.#####.#.#.###.#.#######.#.###.#####.#.#.###.#####.#.#.#############.#.###
#...#.....#.#.#...#...#.....#...#...#...#.#.#...#.#.......#.......#.....#.#...#
#.#######.#.#####.#########.#####.###.#.#.#.###.###.#############.#.###.#.###.#
#.........#.....................#.....#.......#.................#.....#.......#
###############################################################################
```

<!-- /map -->

## `MazeOptions`

| Option            | Default       | Description                                                                                                                                                                                |
| ----------------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `width`, `height` | required      | Map size in tiles, at least 3.                                                                                                                                                             |
| `random`          | `Math.random` | Source of randomness.                                                                                                                                                                      |
| `maze`            | `{}`          | The options of [`digMaze`](../steps/dig-maze.md) but its `area` and `count`: the biases, `loopChance`, `fill`, `straight`, `pattern`, `patternChance` and `start`.                         |
| `rooms`           | none          | The options of [`placeMazeRooms`](../steps/place-maze-rooms.md): ordinary rooms (`roomCount`, `roomWidth`, `roomHeight`, `sizeUniformity`), `templates` and their `doorChance`. See below. |
| `openings`        | `{}`          | The options of [`openMazeRooms`](../steps/open-maze-rooms.md): `exitsPerRoom` and `doorChance`. Only used with `rooms`.                                                                    |
| `exits`           | none          | The options of [`openExits`](../steps/open-exits.md): `count` (how many exits), `lattice`, `symmetry`, `symmetryChance` and `tile`.                                                        |

## `MazeResult`

| Field       | Description                                                                                                                                                                   |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `grid`      | The maze.                                                                                                                                                                     |
| `start`     | The cell where carving started.                                                                                                                                               |
| `exits`     | Door tiles on the map border, one per exit. Empty without `exits`.                                                                                                            |
| `rooms`     | The [rooms](#rooms-in-mazes), templated ones first, with ids in that order. Empty without `rooms`. Each is a [`Room`](../rooms.md#room) whose `exits` index into `roomExits`. |
| `roomExits` | The openings of the rooms into the maze, each an [`Exit`](../rooms.md#exit) whose `door` says whether it got a door. They are not the `exits` on the map border.              |
| `attempts`  | How many times the maze was built, 1 or more: a map is built again when a step throws, up to 3 in all.                                                                        |
| `failures`  | One entry per failed attempt, with the step that threw and what it threw, also when a later attempt succeeded.                                                                |

## Rooms in mazes

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

The room options are those of [`placeMazeRooms`](../steps/place-maze-rooms.md): `roomCount` is how many (1 to 1, so `rooms: {}` places one), `roomWidth` and `roomHeight` their size (3 to 7, odd sizes only), and `sizeUniformity` how alike they are (0). For templates alone, set `roomCount` to `{ min: 0, max: 0 }`.

Each room draws its number of openings from `openings.exitsPerRoom`, and every opening is a gap in the wall that leads to a maze cell, opened as a door with the chance `openings.doorChance` (a template's openings excepted, see below). The result stays connected: when a room cuts off a stretch of the maze, or leaves a room that nobody reaches, extra openings are made where they join the parts, so a room may have more openings than `exitsPerRoom` asks for. A room gets fewer when no carved maze cell is next to its walls, which happens with a low `fill`.

Rooms may be combined with a `pattern`, which then steers the corridors round them: the rooms themselves are not mirrored. `fill` counts only the cells outside the rooms. Without a `start`, the maze starts at the free cell nearest the middle, outside the rooms.

## Templates in mazes

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

`rooms.templates` takes the same [`RoomTemplate`](../room-templates.md) objects as the dungeons, with the same `count`, `rotate`, `mirror`, `positions`, `areas` and `positionAccuracy`. They are placed first, before the ordinary rooms, which keep away from them, and the maze is carved around them. `templateSymmetry` does not exist for mazes.

A maze is a lattice, so templates are placed [on the lattice](dungeon.md#placement): a template's bounding box starts on even coordinates, its dimensions must be odd, and every `Exit` and `Door` that leads outside must face a tile with odd coordinates, which is where the maze has its cells. A template that has no variant that fits throws a `RangeError` at once. At least three wall tiles separate a template's footprint from another room's.

- The exit cells of a template open straight onto a maze cell. `Door` cells are always doors and `Exit` cells are doors with the chance `rooms.doorChance`. Every `Exit` and `Door` is opened, and if `fill` left the cell in front of it uncarved, a passage is carved from the nearest carved cell.
- `OptionalExit` cells are opened as far as `openings.exitsPerRoom` asks, counting the fixed exits. More are opened where they join parts of the map that would be cut off. Each is a door with the chance `rooms.doorChance` too, decided when the template is placed, whatever `openings.doorChance` says.
- The maze never digs through a template's walls or floors. `Unused` cells are free space like any other, so the maze may wind into a notch of a template's bounding box that is open to the outside.
- **Failures.** A template that finds no place, covers `rooms.keepClear`, or has an exit that cannot be joined to the maze fails the attempt, and a new map is built, up to three in all, before a [`TemplatePlacementError`](../room-templates.md) is thrown. A template is never left out.

Templated rooms are in `rooms`, listed before the ordinary ones, with `template`, `rotation` and `mirrored` set, and their openings are in `roomExits`. `roomCount` counts only ordinary rooms.
