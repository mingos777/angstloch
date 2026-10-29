# Walking distances

Design in progress, not started. Delete this file once the feature is done and documented in the README.

## Why

The game wants to put the stairs up and down in two rooms far apart, so that the player crosses the map instead of finding the exit next to the entrance. The library measures, the game picks by its own rules (no cells, at least 70% of the largest distance, a random pair among those).

## Shape

- **Plain functions the game calls on request**, on a finished map. They are not steps, and no step uses them.
- **`measureDistances(grid, places, options)`**: `places` is a list of tile sets (rooms, clearings, exits, anything). The result is a places by places matrix, row by row, -1 where there is no way. Each entry is the cheapest walk between the nearest tiles of two places. One search per place, from all its tiles at once.
- **`measureRoomDistances(result, options)`**: the same for the rooms of a result, through `createRoomMap` (from `designs/cell-blocks.md`), so every room of every kind (cells, guard rooms, halls, caverns) is a place.
- **`costs`**: a cost factor per `Tile` value (`Partial<Record<Tile, number>>`), `Infinity` for a tile that cannot be entered. By default `Wall` and `DeepWater` are `Infinity` and every other tile is 1, doors included; a game that lets the player swim gives `DeepWater` 10, say. A given entry replaces the default for that tile only. A factor must be positive (`RangeError` otherwise); below 1 is fine (a road faster than grass).
- **`metric`** (default `'euclidean'`):
  - `'manhattan'`: 4 directions, steps of 1.
  - `'chebyshev'`: 8 directions, steps of 1.
  - `'euclidean'`: 8 directions, diagonal steps of √2. √2 is a module constant, never computed per step. The distance is the walk along tiles, not the straight line between rooms.
- **A step** costs its length (1, or √2 for a euclidean diagonal) times the factor of the tile it enters. Since the factors vary, every metric runs a Dijkstra search (a binary heap), and distances may be fractional.
- **Cutting corners is allowed**: a diagonal step may pass between two walls that touch at a corner, as in the user's game and most roguelikes. No option; one can be added later.
- **Cost**: about 160,000 tile visits for 40 rooms on 80 by 50; with the heap, a few milliseconds.

## Where it lives

`measureDistances` in `src/core/` (it only needs the grid), and `measureRoomDistances` next to `createRoomMap` in `src/rooms/`. `measureDistances` can be built at any time; `measureRoomDistances` waits for `createRoomMap`, task 6/7 of the cell blocks.

## Tasks

- 1/2 `measureDistances` with the three metrics and `costs`; in the playground, the distances from a picked place.
- 2/2 `measureRoomDistances`, after `createRoomMap`; README check, and this file deleted.
