# Cell blocks

Design in progress, not started. Delete this file once the feature is done and documented in the README.

## Scope

- **The prison is a step, not a generator**: `placeCellBlocks`, in `src/rooms/`, used through `pipeline` only. No preset key yet, since the user is rethinking the playground presets. The typical use is one or two blocks in an ordinary dungeon, then `placeScatteredRooms` and `digCorridors`.
- **Left to the game**: guard posts, solitary, service rooms and yards are ordinary rooms that the game themes. No layouts of their own (telephone pole, radial and courtyard were dropped), and no yards.
- **No new tiles**: no bars. Every door is `Tile.Door`, and the game picks the door type.

## The block

- Identical cells (one size per block), sharing walls, along a straight corridor, on one or both sides.
- Every cell has exactly one entrance onto the block corridor, always `Tile.Door`.
- Options like `digPillarHalls`: `blocks`, `area`, `count`, `cellSize` (`{ width, depth }`), `cellsPerSide`, `sides`, `corridorWidth`, `orientation`, and a setting for where the cell doors sit along the fronts (centered or jittered, drawn once per block). The defaults are the user's call in the playground.

```
#######################
#.....#...#...#...#...#
#.....#...#...#...#...#
#.....#...#...#...#...#
#.....##+###+###+###+##
+.....+...............#
#.....##+###+###+###+##
#.....#...#...#...#...#
#.....#...#...#...#...#
#.....#...#...#...#...#
#######################
```

## Rooms and the result

- **Cells and guard rooms are real rooms** in `rooms`. The cells' doors are open already, so `digCorridors` leaves them alone. The block corridor is floor outside the room shapes, a stand-in. The rejected alternative was the whole block as one templated room.
- **Every `Room` gets a `kind`**: `'room'` for the rooms of every placement step (templates included), `'cell'` and `'guardRoom'`, and, in task 5/6, `'pillarHall'` and `'cavern'`. The game never has to guess what is what. This reverses the old rule that `Room` has no `kind`.
- **Block index**: `Room.cellBlock` is an index into a `cellBlocks` extra (footprint, corridor, entrance). It only points from the room to the block, since `digCorridors` renumbers rooms and blocks are never dropped. The use case: two blocks themed differently (prisoners, monsters).

## The entrance

- **One entrance**, the only `Openable` tile of the block; every other outer wall is `Solid`. A corridor must always reach it: a stand-in is never dropped, so a cut-off block fails the map and is retried.
- The entrance gets a door by `doorChance`. The doors between a guard room and its block are fixed.
- Three cases:
  - **No guard room**: the end of the block corridor.
  - **Through the guard room**: its outer wall (the sketch above).
  - **Beside the guard room**: the step digs a tunnel from the block past the guard room's door, 2 to 4 tiles past it, and the entrance (`o`) is the tile beyond its last tile.

```
################################
#.....##...#...#...#...#...#...#
#.....##...#...#...#...#...#...#
#.....##...#...#...#...#...#...#
###+#####+###+###+###+###+###+##
o......+.......................#
################################
```

- **The guard room** is optional (absent means none), with options for its chance, size and placement (`'through'` or `'beside'`).

## Changes to the joining steps

- **`digCorridors`, change 1**: an `Openable` wall touching a stand-in is one of its potential exits, opened through `openReserved`.
- **`digCorridors`, change 2**: rooms and floor already joined by open doors count as one thing to join. This is for the through case: the guard room has its inner door, and the block corridor has no exit of its own.
- **`digVeins`** is expected to need no change: the block is one piece, entered through its `Openable` tile. To be verified.

## Halls and caverns as rooms (task 5/6)

- **"Room" versus "feature" was never about the output.** It is about how the steps treat a thing:
  - A room has a shape in `roomShapes`, reserves its footprint, is entered only through its `Openable` tiles, has `Exit` entries, and an ordinary room can be dropped.
  - A feature reserves nothing, is joined anywhere on its boundary, is never dropped, and gets no `Exit` entry.
  - The game does not care about any of this, so both are listed in `rooms` with their `kind`, and the steps key their behavior on the kind, not on being in the list.
- **`'pillarHall'`**: one room per hall of `digPillarHalls`.
- **`'cavern'`**: one room per disconnected section of `digCellularCave` and `digNoiseCave`, the mine's caverns included.
- Joining stays as it is: halls and caverns are still joined like stand-ins on their boundary, never dropped, and the rock they enclose (pillars) stays untouchable.
- **Tiles of a room**: every room, of every kind, keeps its tiles as its shape in `roomShapes` (a rectangle's floor, a template's cells with the cutout `Unused`, a hall's or cavern's floor). A hall's or cavern's shape blocks nothing and reserves nothing, so joining it does not change. The game also gets a per-tile room id (see below).
- **Exits of halls and caverns**: `digCorridors` and `digVeins` record where they enter a hall or a cavern as `Exit` entries, so every room lists all of its ways in.
- **Groups**: a cavern says which cave it belongs to, as a cell says which block (see Groups below). The mine's `halls` extra and the cave presets' `regions` go, replaced by the rooms and their groups.

- **Per-tile room id**: an exported helper, `createRoomMap(result)`, an `Int32Array` with the room id per floor tile and -1 elsewhere, computed from `roomShapes` at the end (a mask kept during the pipeline would go stale when `digCorridors` renumbers rooms). This reverses "analysis helpers stay private" for this lookup.
- **Groups**: one generic `Room.group`, an index into a `roomGroups` extra, each entry tagged by kind (`'cellBlock'` with its corridor and entrance, `'cave'` with its box). One group per copy of a step that builds several rooms (one cell block, one cave in its area, one set of pillar halls). It replaces `Room.cellBlock`, and covers the shared "region" abstraction of the backlog.
- **No connection graph**: the steps do not record what is joined to what (corridors merge, share exits and branch, veins end on veins in a T), and no algorithm needs it, so none is built.

- **Walking distances** between rooms are a feature of their own, see `designs/walking-distances.md`. It builds on `createRoomMap`.

## Later

- A T-shaped block corridor, with cells along three sides.
- An option for extra entrances (default 1).

## Tasks

Each task extends the playground and the README.

- 1/7 `Room.kind` on every room step (`'room'`).
- 2/7 `placeCellBlocks` with cells, corridor and entrance, no guard room; `Room.group` and `roomGroups` with the `'cellBlock'` group; `digCorridors` change 1; checked with `digVeins`; a playground step.
- 3/7 The guard room beside the block, with its tunnel.
- 4/7 The guard room through which the block is entered; `digCorridors` change 2.
- 5/7 Halls and caverns as rooms: kinds, shapes that block nothing, their groups; the mine's `halls` and the caves' `regions` go.
- 6/7 `Exit` entries where `digCorridors` and `digVeins` enter a hall or a cavern, and `createRoomMap`; in the playground, the room under the mouse.
- 7/7 README check, and this file deleted.
