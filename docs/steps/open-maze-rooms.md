# `openMazeRooms`

`openMazeRooms(options?)` is a step that opens the rooms onto the maze round them, the rooms of [`placeMazeRooms`](place-maze-rooms.md) once [`digMaze`](dig-maze.md) has carved the maze. Only rooms that have no exits yet are opened, so rooms opened by another step are left alone.

| Option         | Default    | Meaning                                                                                                                                                                                       |
| -------------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `exitsPerRoom` | `{ 1, 3 }` | Number of openings per room, a `Range` of 1 or more. A room may get more where they join parts of the maze that a room cuts off, and fewer when no carved maze cell is next to its walls.     |
| `doorChance`   | 1          | Chance that an opening gets a door, from 0 to 1. Openings without a door are plain gaps in the wall. The exits of templates, their optional exits included, were decided by `placeMazeRooms`. |

- **Where a room opens.** A room's openings come from its shape in `roomShapes`: the potential exits that face a maze cell (odd coordinates, not reserved) and are still `Reserve.Openable`, and only onto a cell that was carved.
- **Fixed exits first.** Every `Exit` and `Door` of a template is opened. If `fill` left the cell in front of it uncarved, a passage is carved from the nearest carved cell; should that be impossible, the step throws a [`TemplatePlacementError`](../room-templates.md), which `pipeline` answers with a new map.
- **Then the rest.** Each room draws its number of openings from `exitsPerRoom`, the fixed ones included, and more are opened wherever they join parts of the map that are not joined yet, as described under [rooms in mazes](../generators/maze.md#rooms-in-mazes).
- **What it reserves.** Every opening goes through [`openReserved`](../composing.md#mapstate), so it and the potential exits round it become `Reserve.Solid`.
- **Needs** `rooms` and `roomShapes`, **uses** `roomExits` from the steps before it, and **adds** `rooms` and `roomExits` again, with the exits of the rooms it opened appended. The rooms of the state are copied, not changed.

## Example map

The map this code makes with seed 1 (`mulberry32` is defined in the [quick start](../../README.md#quick-start)), before and after `openMazeRooms`:

<!-- map: open-maze-rooms -->

```ts
import {
  emptyMap,
  pipeline,
  Tile,
  placeMazeRooms,
  digMaze,
  openMazeRooms,
} from 'angstloch';

const result = pipeline(
  emptyMap({ width: 37, height: 21, tile: Tile.Wall }),
  [
    placeMazeRooms({ roomCount: { min: 2, max: 3 } }),
    digMaze(),
    openMazeRooms(),
  ],
  { random: mulberry32(1) },
);
```

```text
before                                   after
#####################################    #####################################
#...........#.........#...........#.#    #...........#.........#...........#.#
#.###########.###.#####.#########.#.#    #.#########+#.###.#####.#########.#.#
#...#...#...#...#.......#.....#...#.#    #...#...#...#...#.......#.....#...#.#
#.#.#.#.#...###.###########.###.###.#    #.#.#.#.#...###.###########.###.###.#
#.#...#.#...#.#.#...........#...#...#    #.#...#.#...#.#.#...........#...#...#
#######.#...#.#.#.#####.#####.###.#.#    ###+###.#...#.#.#.#####.#####.###.#.#
#...#...#...#...#.#...#...#...#...#.#    #...#...#...#...#.#...#...#...#...#.#
#...#.#.#####.#####.#.###.#.#####.#.#    #...#.#.#####.#####.#.###.#.#####.#.#
#...#.#...#.#...#...#.....#.#.....#.#    #...#.#...#.#...#...#.....#.#.....#.#
#####.###.#.###.#.#########.#.#.#####    #####.###.#.###.#.#########.#.#.#####
#.#.....#.....#...#.........#.#.....#    #.#.....#.....#...#.........#.#.....#
#.#.###.#.#######.###########.#####.#    #.#.###.#.#######.#+#########.#####.#
#...#...#.#...#...#.......#.#.....#.#    #...#...#.#...#...+.......#.#.....#.#
#.###.###.#.#.#.###.......#.###.###.#    #.###.###.#.#.#.###.......#.###.###.#
#.#.#.#...#.#.#...#.......#...#.#...#    #.#.#.#...#.#.#...#.......#...#.#...#
#.#.#.#.###.#.###.#########.###.#.###    #.#.#.#.###.#.###.#########.###.#.###
#...#.#.#...#...#.....#...#.....#...#    #...#.#.#...#...#.....#...#.....#...#
###.#.###.#####.#####.#.#.#########.#    ###.#.###.#####.#####.#.#.#########.#
#...#.........#.........#...........#    #...#.........#.........#...........#
#####################################    #####################################
```

<!-- /map -->
