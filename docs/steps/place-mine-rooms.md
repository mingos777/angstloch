# `placeMineRooms`

`placeMineRooms(options?)` is a step that places rooms in the rock beside the floor that is there and joins each to it by a tunnel from every exit it opens (see [rooms and templates](../generators/mine.md#rooms-and-templates) for how rooms are placed and opened). The floor need not be a mine: any floor the steps before it made, or that a step of your own carved, will do. Like `digFishbone` it needs a map that starts as wall, and it checks every option and template when it is made. It works on the whole map and takes no `area`.

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

| Option           | Default    | Meaning                                                                                                                                                                                                              |
| ---------------- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `roomCount`      | `{ 1, 1 }` | How many ordinary rooms to place, a `Range` of whole numbers, 0 or more. Fewer are placed when no more fit.                                                                                                          |
| `roomWidth`      | `{ 3, 7 }` | Room width in tiles, without the walls, 1 or more.                                                                                                                                                                   |
| `roomHeight`     | `{ 3, 7 }` | Room height in tiles, without the walls, 1 or more.                                                                                                                                                                  |
| `sizeUniformity` | 0          | How alike room sizes are, from 0 (anything within the ranges) to 1 (every room has the middle size).                                                                                                                 |
| `templates`      | none       | [`RoomTemplate`](../room-templates.md) objects, placed before the ordinary rooms. One that cannot be placed or joined fails the attempt.                                                                             |
| `exitsPerRoom`   | `{ 1, 3 }` | Number of openings per room, 1 or more. The fixed exits of a template count, and more are opened from the optional ones.                                                                                             |
| `doorChance`     | 1          | Chance that an opening gets a door, from 0 to 1. `Door` cells of a template are always doors. A template's `Exit` and `OptionalExit` cells are decided when it is placed, so an opened one agrees with `roomShapes`. |
| `veinWidth`      | `{ 1, 2 }` | Width of the tunnels that join the rooms to the floor, in whole tiles.                                                                                                                                               |
| `veinWindiness`  | 0.5        | How much the tunnels wind, from 0 (straight) to 1.                                                                                                                                                                   |

- **Templates.** A template that cannot be placed, or cannot be joined to the floor, throws a [`TemplatePlacementError`](../room-templates.md), which [`pipeline`](../composing.md#pipeline) answers with a new map, up to its `attempts`. A map with no floor at all cannot join a template, and always fails. `Room.template` is an index into the `templates` of the step that placed the room.
- **Reserved ground.** No room and no tunnel is built on a [reserved](../composing.md#mapstate) tile, and the floor of a reserved tile, such as an earlier room's, is not floor to join, so a tunnel never ends in another room.
- **What it reserves.** Every room reserves its footprint: its walls, its floor and its inner doorways are `Reserve.Solid`, and its potential exits, the `OptionalExit` cells and the `Exit` and `Door` cells that lead outside, are `Reserve.Openable`. Every opening it makes goes through `openReserved`, so the opening and the potential exits around it become `Solid`. An ordinary room's unopened wall stays `Openable`, which later steps can open as an exit.
- **Uses** `passages`, `rooms`, `roomExits` and `roomShapes`, from the steps before it, and **adds** all four again with its own appended: `tunnel` entries in `passages`, and rooms whose ids, and exits whose indices, follow on from the ones there are. Its rooms are templated ones first, then ordinary ones. A tunnel that ends in a hall or a cavern gives it an exit too (see [ways into halls and caverns](../rooms.md#ways-into-halls-and-caverns)), appended after the exits of the new rooms.
- **`roomShapes`** holds a `RoomShape` for every room, by id: the cells of the room as placed on the map (`x`, `y`, `width`, `height`, `cells`, `exits`, `rotation` and `mirrored`, as a `TemplatePlacement`), plus `doors`, a list of `{ x, y, door }` that says, in the coordinates of the map, whether each `Exit`, `Door` and `OptionalExit` cell gets a door, as decided when the room was placed. An `OptionalExit` is listed whether or not it is ever opened: a step that opens it later uses its entry instead of its own `doorChance`, and one that stays shut is a wall whatever its entry says. A templated room's shape is its placement. An ordinary room's is a ring of `OptionalExit` round its floor, with wall corners, and has no `doors`, so its exits get the `doorChance` of the step that opens them. Steps that work with rooms read their walls, floors and potential exits from it.
