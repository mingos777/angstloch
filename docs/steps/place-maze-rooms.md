# `placeMazeRooms`

`placeMazeRooms(options?)` is a step that places the rooms of a maze on its lattice and carves their floor, for a maze to be carved round them by a later step: the templates first, then the ordinary rooms, at random spots (see [rooms in mazes](../generators/maze.md#rooms-in-mazes) and [templates in mazes](../generators/maze.md#templates-in-mazes) for how they sit on the lattice). The rooms are not opened: their walls stay whole until a step opens them onto the maze. It needs a map that starts as wall, and it checks every option and template when it is made. [`digMaze`](dig-maze.md) carves the maze round them, and [`openMazeRooms`](open-maze-rooms.md) opens them.

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

| Option           | Default    | Meaning                                                                                                                                                                                                                                                                       |
| ---------------- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `roomCount`      | `{ 1, 1 }` | How many ordinary rooms to place, a `Range` of whole numbers, 0 or more. Fewer are placed when no more fit.                                                                                                                                                                   |
| `roomWidth`      | `{ 3, 7 }` | Room width in tiles, without the walls, 1 or more. Only odd widths are used.                                                                                                                                                                                                  |
| `roomHeight`     | `{ 3, 7 }` | Room height in tiles, without the walls, 1 or more. Only odd heights are used.                                                                                                                                                                                                |
| `sizeUniformity` | 0          | How alike room sizes are, from 0 (anything within the ranges) to 1 (every room has the middle size).                                                                                                                                                                          |
| `templates`      | none       | [`RoomTemplate`](../room-templates.md) objects, placed before the ordinary rooms. They must fit the lattice, which is checked when the step is made; one that cannot be placed fails the attempt.                                                                             |
| `doorChance`     | 1          | Chance that an `Exit` or `OptionalExit` cell of a template gets a door, from 0 to 1, decided when it is placed and kept by `openMazeRooms` if it opens an optional exit. `Door` cells always do. The openings of ordinary rooms are decided by the step that opens the rooms. |
| `keepClear`      | none       | A tile, `{ x, y }` in whole coordinates of the map, that the rooms leave free, such as the cell a maze starts from. Ordinary rooms keep off it; a template that covers it fails the attempt.                                                                                  |
| `area`           | the map    | The size of the box the rooms go in, an `AreaSpec` (see [Areas](../composing.md#areas)), placed on the lattice: odd sizes at even coordinates. There is one box, so the step takes no `count`.                                                                                |

- **Spacing.** At least three wall tiles separate the floors of two rooms, ordinary or templated, which leaves room for a maze cell between them.
- **Templates.** A template that cannot be placed, or that covers `keepClear`, throws a [`TemplatePlacementError`](../room-templates.md), which [`pipeline`](../composing.md#pipeline) answers with a new map, up to its `attempts`. `Room.template` is an index into the `templates` of the step that placed the room.
- **In an area.** The rooms go in one box of `area`, picked as [Areas](../composing.md#areas) describes, and the positions and areas of the templates are in the coordinates of that box. A maze in a smaller area picks its own box, so its rooms do not yet land in it.
- **What is in the way.** On the whole map the rooms do not look at what the steps before them built, so put this step first, or give it an `area`: a box goes only where the map is free.
- **What it reserves.** Every room reserves its footprint, as [`placeMineRooms`](place-mine-rooms.md) does: walls, floor and inner doorways are `Reserve.Solid`, and potential exits are `Reserve.Openable`. The whole ring of an ordinary room, but its corners, is `Openable`, though only the tiles that face a maze cell (at odd offsets along a wall) can become an exit; which ones do is worked out when the rooms are opened.
- **Uses** `rooms` and `roomShapes` from the steps before it, and **adds** both again with its own appended, with ids that follow on: templated rooms first, then ordinary ones, each with a [`RoomShape`](place-mine-rooms.md) in `roomShapes`. Its rooms have no exits yet.
