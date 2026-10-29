# Cell blocks

Tasks 1/8 to 3/8 done. Delete this file once the feature is done and documented in the README.

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
- **Every `Room` gets a `kind`**: `'room'` for the rooms of every placement step (templates included), `'cell'` and `'guardRoom'`, and, in task 6/8, `'pillarHall'` and `'cavern'`. The game never has to guess what is what. This reverses the old rule that `Room` has no `kind`.
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

- **Open question, the approach.** Nothing keeps a later step off the two tiles beyond the entrance. A later hall that reaches them is handled (`joinTouchingPieces` opens the entrance in `digCorridors` and `digVeins`), but a later room whose wall lands there cuts the block off and the map is retried: with 1 to 2 blocks, `digPillarHalls`, `placeScatteredRooms` and `digCorridors` on 80 by 50, about one map in four is retried and 2 in 200 fail; without the hall, one in ten and none. A fix would need a new kind of reservation (no step builds there, a joining step may dig), which is a change to `Reserve`.

## The lattice

- **The need**: in a lattice dungeon (`placement: 'lattice'` on the rooms and on `digCorridors`), a corridor leaves an exit only toward a tile with odd coordinates. A block entrance lands there only by chance, so with 1 to 2 blocks, lattice `placeScatteredRooms` and lattice `digCorridors` on 81 by 51, 132 of 200 maps fail today.
- **Option**: `placement: 'free' | 'lattice'` (`Placement`), as on the room placement steps, default `'free'`. It takes nothing from the other steps (no config inheritance), so a lattice dungeon gives it to every step.
- **What the lattice fixes**: walls on even coordinates, floors on odd ones.
  - The footprint starts on even coordinates and has odd sides; the area goes through `placeAreas` with `lattice: true`.
  - Cell width and depth, corridor width and the guard room's size are narrowed to odd numbers, as the rooms' sizes are (`{ 4, 4 }` rounds up to 5). The arithmetic then works out: the cells share walls on even columns, the fronts are even rows, the corridor starts on an odd row and the far fronts are even again.
  - The entrance sits on an odd row of the corridor, so the tile beyond it is odd on both axes.
  - The tunnel's length is made odd, so its entrance is on an even column and the tile beyond on an odd one.
  - Flipping a one-sided block keeps the parity, since the footprint has odd sides.
- **The guard room beside**: with the double wall of the free layout, its near wall lands on an odd column. On the lattice it shares the block's end wall, its floor starting on the first odd column out.
- **The doors inside stay centered**: the cell doors and the guard room door open onto the block corridor and the tunnel, which no outside corridor touches, so only the shell is on the lattice. A 3-wide cell keeps its door in the middle, on an even tile, off the lattice.
- **The free layout keeps its double wall** (no preference from the user, so the sketch stands).
- **Checked by** lattice `placeScatteredRooms` and `digCorridors` with blocks, guard rooms or not, over 200 seeds, as the other runs were.

## Changes to the joining steps

- **`digCorridors`, change 1**: an `Openable` wall touching a stand-in is one of its potential exits, opened through `openReserved`.
- **`digCorridors`, change 2**: rooms and floor already joined by open doors count as one thing to join. This is for the through case: the guard room has its inner door, and the block corridor has no exit of its own.
- **`digVeins`** is expected to need no change: the block is one piece, entered through its `Openable` tile. To be verified.

## Halls and caverns as rooms (task 6/8)

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

- 1/8 `Room.kind` on every room step (`'room'`).
- 2/8 `placeCellBlocks` with cells, corridor and entrance, no guard room; `Room.group` and `roomGroups` with the `'cellBlock'` group; `digCorridors` change 1; checked with `digVeins`; a playground step.
- 3/8 The guard room beside the block, with its tunnel.
- 4/8 The lattice: `placement` on `placeCellBlocks`, the guard room beside included.
- 5/8 The guard room through which the block is entered, on the lattice too; `digCorridors` change 2.
- 6/8 Halls and caverns as rooms: kinds, shapes that block nothing, their groups; the mine's `halls` and the caves' `regions` go.
- 7/8 `Exit` entries where `digCorridors` and `digVeins` enter a hall or a cavern, and `createRoomMap`; in the playground, the room under the mouse.
- 8/8 README check, and this file deleted.
