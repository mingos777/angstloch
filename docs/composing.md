# Composing maps

A map can be composed from an empty base and a list of steps, like middleware, instead of one generator with many options. `pipeline` runs the steps in order, merges what each reports into the map state, and builds the map again from the start when a step throws. Every generator of this library is a preset, a ready-made composition of the steps listed under [Steps at a glance](#steps-at-a-glance): [`generateForest`](generators/forest.md), [`generateCave`](generators/cave.md), [`generateNoiseCave`](generators/cave.md#noise-caves), [`generateMine`](generators/mine.md), [`generateMaze`](generators/maze.md), [`generateRoomDungeon`](generators/dungeon.md) and [`generateDigDungeon`](generators/dungeon.md#grown-dungeons). Each preset passes its keys straight to its steps, so whatever a preset makes, a pipeline of the same steps with the same options makes too, and steps of different generators mix in one map (rooms round a cavern, a mine with a maze in a corner). You can write steps of your own, and the machinery is the same.

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

## Steps at a glance

Every ready-made step, grouped by the map it was made for, though any of them may go in any pipeline. **Needs** are the extras that an earlier step must have added, which `pipeline` checks before the first attempt; **adds** are the extras it reports (an extra that is there already is appended to, or replaced, as the step's section says). **Rock** marks the steps that dig out of rock and need a map that starts as wall. **Area** marks the steps that take an [`area`](#areas), and **count** those that also take a number of copies.

| Step                                                        | What it does                                                                                          | Needs                 | Adds                                             | Rock | Area, count |
| ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | --------------------- | ------------------------------------------------ | ---- | ----------- |
| [`plantTrees`](steps/plant-trees.md)                        | plants trees by noise on the base tile                                                                |                       |                                                  |      |             |
| [`layStreams`](steps/lay-streams.md)                        | lays streams and rivers, with banks and tributaries                                                   |                       | `streams`                                        |      |             |
| [`layRoads`](steps/lay-roads.md)                            | lays roads, with crossings, branches and bridges over streams                                         |                       | `roads`, `junctions`, `exits`, `bridges`         |      |             |
| [`placeClearings`](steps/place-clearings.md)                | clears ragged glades                                                                                  |                       | `clearings`                                      |      |             |
| [`placeTemplates`](steps/place-templates.md)                | stamps templates in clearings or on free spots                                                        |                       | `templates`                                      |      |             |
| [`layClearingPaths`](steps/lay-clearing-paths.md)           | lays paths from the roads to the clearings that ask for one                                           | `clearings`           | `roads`, `junctions`, `exits`, `bridges`         |      |             |
| [`layFootbridges`](steps/lay-footbridges.md)                | joins the land that streams cut apart                                                                 | `streams`             | `bridges`                                        |      |             |
| [`digFishbone`](steps/dig-fishbone.md)                      | a main shaft with adits off it                                                                        |                       | `passages`                                       | yes  | area, count |
| [`digVeins`](steps/dig-veins.md)                            | veins that join every piece of floor, and a web of their own                                          |                       | `passages`, `rooms`, `roomExits`                 | yes  |             |
| [`digPillarHalls`](steps/dig-pillar-halls.md)               | halls with pillars                                                                                    |                       | `rooms`, `roomShapes`, `roomGroups`              | yes  | area, count |
| [`digRings`](steps/dig-rings.md)                            | rings joined by spokes                                                                                |                       | `passages`                                       | yes  | area, count |
| [`placeMineRooms`](steps/place-mine-rooms.md)               | rooms in the rock, each joined to the nearest floor by a tunnel                                       |                       | `passages`, `rooms`, `roomExits`, `roomShapes`   | yes  |             |
| [`digCellularCave`](steps/dig-cellular-cave.md)             | a cave from a cellular automaton                                                                      |                       | `rooms`, `roomShapes`, `roomGroups`              | yes  | area, count |
| [`digNoiseCave`](steps/dig-noise-cave.md)                   | a cave from thresholded noise                                                                         |                       | `rooms`, `roomShapes`, `roomGroups`              | yes  | area, count |
| [`placeMazeRooms`](steps/place-maze-rooms.md)               | rooms on the maze lattice, not opened yet                                                             |                       | `rooms`, `roomShapes`                            | yes  | area        |
| [`digMaze`](steps/dig-maze.md)                              | a maze by the recursive backtracker, round whatever is there                                          |                       | `start`                                          | yes  | area, count |
| [`openMazeRooms`](steps/open-maze-rooms.md)                 | opens the maze rooms into the maze                                                                    | `rooms`, `roomShapes` | `rooms`, `roomExits`                             |      |             |
| [`placeScatteredRooms`](steps/place-scattered-rooms.md)     | dungeon rooms at random spots                                                                         |                       | `rooms`, `roomShapes`                            | yes  | area, count |
| [`placePartitionedRooms`](steps/place-partitioned-rooms.md) | one dungeon room per area of a binary space partition                                                 |                       | `rooms`, `roomShapes`                            | yes  | area, count |
| [`placeClusteredRooms`](steps/place-clustered-rooms.md)     | dungeon rooms grown off each other, clustered                                                         |                       | `rooms`, `roomShapes`                            | yes  | area, count |
| [`placeCellBlocks`](steps/place-cell-blocks.md)             | cell blocks of a prison, entered at one end                                                           |                       | `rooms`, `roomShapes`, `roomExits`, `roomGroups` | yes  | area, count |
| [`digSewers`](steps/dig-sewers.md)                          | a sewer: a trunk canal and branches, with walkways, bridges and cisterns                              |                       | `rooms`, `roomShapes`, `roomGroups`              | yes  | area, count |
| [`digCatacombs`](steps/dig-catacombs.md)                    | a catacomb: a lattice of galleries, main and side, lined with niches and burial chambers, with crypts |                       | `rooms`, `roomShapes`, `roomExits`, `roomGroups` | yes  | area        |
| [`digCorridors`](steps/dig-corridors.md)                    | joins the rooms, and every other piece of floor, by corridors                                         | `rooms`, `roomShapes` | `rooms`, `roomShapes`, `roomExits`               | yes  |             |
| [`openExits`](steps/open-exits.md)                          | carves exits into the border, or opens the outfalls of sewers                                         |                       | `exits`                                          |      |             |

The presets are these steps in this order: a forest is `plantTrees`, then the outdoor steps it is given; a cave is `digCellularCave` or `digNoiseCave`, `digVeins` and `openExits`; a mine is one layout step, then `digNoiseCave` and `digVeins` for caverns, `placeMineRooms` and `openExits`; a maze is `placeMazeRooms`, `digMaze`, `openMazeRooms` and `openExits`; a room-first dungeon is `placeScatteredRooms` or `placePartitionedRooms`, then `digCorridors`; a grown dungeon is `placeClusteredRooms`, then `digCorridors`. The building blocks for steps of your own are [`MapState`](#mapstate) and its helpers, [`pruneVerge`](#verges-and-pruneverge) and [areas](#areas).

## `emptyMap`

`emptyMap({ width, height, tile })` is the start of a pipeline: a map of one tile, grass for a forest and a wall for a dungeon or a mine. The dimensions and the tile are checked at once, and a bad one throws a `RangeError`. It returns a factory (`MapBase`, a function that returns a `MapState`), so that every attempt starts from a fresh state. Any function that returns a state works in its place.

## `MapState`

The map while it is built: `{ grid, base, prunable, reserved, ...extras }`.

- `grid` is the `Grid`.
- `base` is the tile the map started as. A tile that still holds it is untouched ground.
- `prunable` is a `Uint8Array` with a byte per tile, row by row: 1 where the tile is ground cover that a later step may remove (a tree), 0 elsewhere. A step that lays something down clears the byte of its tiles, so that a later step does not take a wall or a road for ground cover. `stampTile(state, x, y, tile)` sets a tile and clears its byte in one go, and throws a `RangeError` outside the grid.
- `reserved` is a `Uint8Array` with a byte per tile, row by row, holding a `Reserve` value. `Reserve.None` (0) is a tile that a step may build on, `Reserve.Solid` (1) is one that no step digs through, such as the wall and floor of a room or a template, and `Reserve.Openable` (2) is also never dug through but may be opened as an exit, which is what a room's potential exits are. A room needs this because its wall is `Tile.Wall`, just like the rock round it. `emptyMap` starts it all `None`, and `stampTile` leaves it alone. The values are part of the contract: new ones may be added, existing ones never change.
- The extras are what the steps return: `streams`, `roads`, and so on.

`reserveTile(state, x, y, kind)` sets the byte of a tile, and throws a `RangeError` outside the grid. `openReserved(state, x, y)` records that an exit was opened on a tile: the tile and every `Openable` tile around it, diagonals included, become `Solid`, so that no two exits end up side by side.

`findNearestOpenable(state, from, { blocked?, accepts? })` finds the `Openable` tile nearest to any of the points `from`, such as the potential exit of a room that a step knows nothing about, by a breadth-first search over the tiles that are `Reserve.None` and not marked by `blocked` (a byte per tile, 1 to keep out). It returns `{ openable, outside, direction, start }`: the tile, the free tile next to it that the search reached it from, the way from the tile to that one (an index into north, east, south, west), and the index into `from` of the start it came from; or `undefined` when there is none to reach. `accepts(openable, direction)` can turn a tile down, and the search goes on past it.

**The free rule.** `isFree(state, x, y)` says whether a step may build on a tile: it holds the base tile or is prunable (untouched ground or ground cover), and it is `Reserve.None`. A tile outside the grid is not free. `placeTemplates` and `layClearingPaths` use it, and `placeTemplates` reserves the cells it stamps as `Solid`, so that a step that comes later and digs, such as a mine or a corridor step, leaves a ruin whole.

## `step`

`step(name, spec, run)` makes a `MapStep`. `run(state, context)` changes `state.grid`, `state.prunable` and `state.reserved` in place and returns the extras the step adds, which the pipeline merges into the state (a later extra replaces an earlier one of the same name). It never mutates anything else.

The type parameters are `step<Needs, Adds>`: `Needs` is what the state must hold, and `Adds` is what `run` returns. The `spec` lists the same extras by name, for run-time checks: `needs` the required ones (leave out an extra that the step only uses when it is there, which you type as `Partial<...>`), and `adds` the ones it returns. A step with none says `{}`.

A step can also have a `validate(state)` in its `spec`, for what only the map can tell, such as its size. `pipeline` calls it once with a fresh base state before the first attempt, and whatever it throws, a `RangeError` for a bad option, is thrown at once and never retried.

The context has `random`, the source of randomness, and `trace`, an optional function that receives the step's internal data for diagnostics, as `trace?.(name, data)`.

A step can also be called by hand, as `mapStep(state, context?)`. The context is optional then, and `random` defaults to `Math.random`. A step whose needs are not in the state throws a `TypeError` that names the step and the extra. Its `stepName`, `needs` and `adds` are readable properties.

## `pipeline`

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

## Verges and `pruneVerge`

A verge is the strip beside a feature that is kept clear of ground cover. Steps that lay a feature (`layStreams`, `layRoads`, `placeClearings`, `placeTemplates` and `layClearingPaths`) take the three fields of a `Verge` among their options, and you can use the same code in a step of your own: `pruneVerge(state, mask, verge, random)`, where `mask` is a `Uint8Array` with a byte per tile, 1 where the feature is.

| Field       | Default       | Meaning                                                                                                                                                                                                                          |
| ----------- | ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `clearance` | 0             | Whole tiles beside the feature with no ground cover at all. Tiles count in any direction, so 1 clears all eight neighbors, diagonals included.                                                                                   |
| `falloff`   | 0             | Whole tiles beyond the clearance over which the cover thickens from none to full, in equal steps: with 3, the first tile keeps a quarter of its cover, the next half, the next three quarters, and the one after that all of it. |
| `distance`  | `'chebyshev'` | How the distance to the feature is measured: `'chebyshev'` makes square verges, `'manhattan'` diamonds and `'euclidean'` round ones.                                                                                             |

`pruneVerge` touches prunable tiles only: a tile it removes goes back to the base tile and stops being prunable, and everything else, such as a road or a wall stamped by another step, is left alone. A tile in the falloff is removed with the chance that the ramp gives, so a tree planted with chance `p` ends up with `p` times the share kept. Verges from several steps add up, so where two overlap, slightly more is pruned than either alone. In a map with nothing prunable (a dungeon) it does nothing.

## Areas

A step that makes a feature (a cave, a maze, a room layout) can build it in part of the map. Such a step takes two options, which every feature step has, and which this section describes once:

- `area`, an `AreaSpec`: `{ width?: Range; height?: Range; x?: AreaWindow; y?: AreaWindow; gravity?: AreaGravity }`, the size in tiles of the part it builds in, and where it may go. A size is drawn from each range for every copy. A missing range is the size of the map, so a step without an `area` builds on the whole map, as it always did. An area may be smaller than the map but never larger: a range that is not whole numbers of at least 1, or reaches beyond the map, throws a `RangeError` when the pipeline starts. `x` and `y` are windows and `gravity` a pull toward a side, see [Where an area goes](#where-an-area-goes).
- `count`, a `Range` of whole numbers of at least 0, default 1 to 1: how many copies of the feature to make. Each copy gets a spot of its own. A `count` above 1 with an area as big as the map throws a `RangeError`, since two copies cannot fit. A smaller `area` with a `count` of 2 gives two features on the map.

A copy that is as big as the map takes the whole map. Any other goes on a random free spot: a box whose tiles, and a margin of one tile round it, are all [free](#mapstate) (untouched ground or ground cover that nothing has reserved). The copies of one step never touch, and floor that earlier steps dug is not free, so a feature never lands on another. After 100 tries without a spot, an ordinary `Error` is thrown, which `pipeline` answers with a new map. A feature in a smaller area is built on a scratch map the size of the box, so it knows nothing of the rest of the map; a symmetry mirrors about the center of the area. The cave steps have a `placement` option with two more rules, a spot beside what is there and a spot over it (see [`digCellularCave`](steps/dig-cellular-cave.md)). Later rules, such as keeping off roads, may be added.

### Where an area goes

A window limits where a box goes along one axis. `x` is an `AreaWindow` of `{ min, max, anchor? }` with the anchor `'left'`, `'center'` or `'right'`, and `y` the same with `'top'`, `'center'` or `'bottom'`:

| Field    | Default    | Meaning                                                                                                                                                                                            |
| -------- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `min`    | (required) | The first tile the anchor may fall on, in map coordinates, a whole number. It may lie off the map; the window is cut to the map.                                                                   |
| `max`    | (required) | The last tile the anchor may fall on, a whole number of at least `min`.                                                                                                                            |
| `anchor` | `'center'` | The point of the box that must fall in the window: its first tile (`'left'`, `'top'`), its last tile (`'right'`, `'bottom'`) or its center tile (`x + floor(width / 2)`, `y + floor(height / 2)`). |

A missing window leaves its axis free, so a box may have a window across the map and none down it. Each copy is placed on its own with the same window: a random spot is drawn from those whose anchor falls in the window, and the other rules stay (the box and its margin free, clear of the other copies, 100 tries). A box as big as the map takes the whole map, whatever the window.

```ts
// a cave on the left edge of the map, anywhere down it
digCellularCave({
  area: {
    width: { min: 20, max: 30 },
    height: { min: 15, max: 25 },
    x: { min: 0, max: 0, anchor: 'left' },
  },
});

// two sets of rooms whose centers lie in the middle third of the map's height (on a map 60 tall)
placeScatteredRooms({
  area: {
    width: { min: 20, max: 20 },
    height: { min: 10, max: 14 },
    y: { min: 20, max: 39 },
  },
  count: { min: 2, max: 2 },
});
```

On the lattice (`digMaze`, `placeMazeRooms`, and the room steps and `placeCellBlocks` with `placement: 'lattice'`) a box starts on even coordinates. When no even start puts the anchor in the window, as with a center anchor on a single odd column, the box goes one tile off the window's edge instead.

A window that is wrong throws a `RangeError` when the pipeline starts: `min` or `max` that is not a whole number, `min` above `max`, an unknown `anchor`, a window with no spot for the largest box the size range draws (checked for the largest, which is the hardest), and on the lattice a window of one odd coordinate. A window that is right but too crowded is the ordinary `Error` after 100 tries, which `pipeline` answers with a new map. The cave steps throw a `RangeError` when they are made for a window with `placement: 'beside'`, which picks its own spot; `'free'` and `'overlap'` keep to the window.

Gravity pulls a box toward a side, a corner or the middle of the map instead. `gravity` is an `AreaGravity` of `{ toward, strength }`:

| Field      | Default    | Meaning                                                                                                                                                                                                                                                                                  |
| ---------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `toward`   | (required) | Where the box is pulled: `'left'`, `'top'`, `'right'` or `'bottom'` flush to that side and centered along it, `'top left'`, `'top right'`, `'bottom right'` or `'bottom left'` flush into that corner, or `'center'` centered both ways. Centered is `round((map size - box size) / 2)`. |
| `strength` | (required) | The share of the way to that spot the box slides, from 0 to 1. At 0 it stays where it was drawn, at 1 it goes all the way unless something stops it.                                                                                                                                     |

The box is drawn on a random spot as usual, then slides `round(strength × distance)` tiles toward its target on each axis, one tile at a time and the two axes in turn. A move is only made when the box and its margin are still free and clear of the other copies, so an axis that meets something stops there for good while the other carries on: a box pulled to the `'bottom left'` past a room ends against the room's side, and as low as it can go. It never jumps over anything, so a box drawn on the far side of a room stays against that room. The copies of one step are placed in turn, so with gravity they pile up against the side and then against each other. It is all best effort: gravity never makes a step fail.

```ts
// three caverns pulled up toward the top of the map, piling up against each other
digCellularCave({
  area: {
    width: { min: 15, max: 20 },
    height: { min: 10, max: 12 },
    gravity: { toward: 'top', strength: 1 },
  },
  count: { min: 3, max: 3 },
});
```

On the lattice a box slides two tiles at a time, and its target is snapped down to an even coordinate. A box as big as the map takes the whole map, whatever the gravity. Gravity cannot be given with a window: one with `x` or `y`, an unknown `toward` or a `strength` outside 0 to 1 throws a `RangeError` when the pipeline starts, and the cave steps throw one when they are made for gravity with `placement: 'beside'`.

The building blocks are public, for steps of your own:

- `assertAreaSpec(area, count, width, height, { lattice? })` checks the two options against the size of the map, the windows and the gravity included. Call it from the `validate` of the step, with `lattice: true` when the boxes go on the lattice.
- `placeAreas(state, random, area, count, { lattice?, overlap?, accepts? })` returns one box (`Area`: `x`, `y`, `width`, `height`) per copy, or throws when a copy finds no spot. With `lattice: true` the boxes have odd sizes and start on even coordinates, so that a maze or the rooms of a lattice line up with the map's lattice. The windows of `area` limit the spots and its gravity slides the boxes, as above. With `overlap: true` a spot need only be clear of the other boxes, and may cover anything. With `accepts: (box) => boolean`, a box must also pass it: it is asked about every spot that is otherwise clear, about every step of a gravity slide (the slide stops at the first step it turns down), and about the whole map for a box as big as the map, which throws when turned down. A step uses it to turn spots down by what they hold.
- `placeBeside(state, random, size, floor)` picks a spot for a shape that is already made: `size` is its `width` and `height`, and `floor` lists its floor tiles in its own coordinates. It tries 100 random spots and returns the box at the one where every floor tile and the 8 tiles round it are free, nearest the dug ground, or `undefined` when none fits. The step stamps the shape itself.
- `buildInArea(state, box, build)` makes a scratch `MapState` from a copy of the box (the grid, `prunable` and `reserved`), runs `build` on it, copies the three back and returns what `build` returned. Coordinates in `build` start at the corner of the box, so the step shifts the extras it returns by the box's `x` and `y` itself. When `build` throws, the map is left as it was. For a box as big as the map the result is the same as building in place.
