# Plan: underground generators on steps (mine, cave, maze, dungeon)

## Context

The forest now runs on composable steps (`pipeline`, `step`, `emptyMap`; see ROADMAP › Composable generation). The user's direction is that every generator moves onto steps and the playground becomes one steps page with no subpages. This plan ports the four underground generators: mine, cave, maze and dungeon. A feasibility review found all four portable. They differ in how much private state passes between their stages:

- **Mine:** almost none.
- **Cave:** the symmetry settings.
- **Maze:** a blocked mask and the template exits.
- **Dungeon:** the corridor builder's internals. The digger also interleaves rooms and corridors, so it is replaced rather than ported (decision 8).

The planning also added two kinds of composition the old generators could not do:

- **Features in part of the map:** a cavern or a pillar hall on a 20×20 piece of an 80×50 map (decision 12).
- **Corridors that join more than rooms:** mines, caves, halls and caverns too (decision 11).

The work is ordered from simplest to hardest, one task at a time with a review after each (CLAUDE.md workflow). This plan is saved in the repo as `underground-generators-pipelines-plan.md`, and ROADMAP › Next up points to it.

## Decisions (user, this session)

1. **A `reserved` mask in `MapState`.** It is a byte per tile next to `prunable`. Room steps set it over their footprint, walls included, because a room wall is `Tile.Wall` just like rock. No digging step writes a reserved tile.
2. **Symmetry is per step, not an extra.** Every step that can be symmetric takes its own symmetry options. A symmetric map passes the same settings to each step. Partial symmetry is fine, e.g. symmetric rooms with free corridors. Symmetry may later spread to roads, streams and tree planting.
3. **One exit step**, `addExits`, for every generator that has border exits.
4. **One step per variant, never a mode switch.**
   - There are four mine layout steps.
   - The cellular-automaton cave and the noise cave are separate steps, even where they share machinery.
   - Callers who want a random variant write their own chooser step.
5. **Dungeon retries.** Only templated rooms (and, from task 20, the features of decision 11) can make a dungeon fail; ordinary rooms that can't be joined are dropped silently.
   - **Inside the step:** `carveCorridors` restores its entry snapshot and routes again, up to 10 times (today's `MAX_ATTEMPTS`, now routing only, with new draws).
   - **After that:** it throws an ordinary `TemplatePlacementError`, and `pipeline` rebuilds the map: 3 attempts, which also redraw the rooms.
   - **Task 14** measures today's failure rate and cost, and task 16 checks that the new rule does no worse. Only the constants are tuned from the figures.
6. **Loops and dead ends stay inside the corridor step**, which is called `carveCorridors`. It must not assume which step came before it.
7. **The steps page keeps a flat list** of every step. The noise page stays as a subpage, since the noise is public though not a generator.
8. **The digger is replaced by a `growRooms` placement step plus `carveCorridors`.**
   - **What it keeps:** most of the digger's look comes from where it puts rooms: grown from a seed room, clustered, with short gaps.
   - **How:** `growRooms` places each new room beyond the wall of an existing room at a `gap` from a range. "Nearest" linking then joins most rooms to their parent with a short corridor.
   - **What is lost, and accepted:** rooms off a fork in a corridor (`branchChance`), the exact parent → child tree, and the random-walk corridors. Corridors are routed instead.
   - **What goes:** the digger code and the half of the builder's interface that only it uses.
   - **Gate:** the digger is deleted only after a side-by-side comparison in the playground and in `check:dungeon` (task 18). If the user rejects the look, task 19 ports the digger as one `digDungeon` step instead.
   - **The preset** of `growRooms` plus `carveCorridors` keeps the name `generateDigDungeon`.
9. **Placement variants are separate steps; corridor linking stays one step.**
   - `scatterRooms`, `partitionRooms` (BSP) and `growRooms` replace `partition`.
   - `carveCorridors` keeps its `connection` option, since it only picks which links to build inside one step.
10. **Placed rooms mark their potential exits, at two levels.**
    - **Shapes:** every room, ordinary or templated, carries a shape in a dense `roomShapes` extra. An ordinary room's shape is a ring of `OptionalExit`, as the mine does today. That gives one code path for openings (the builder's rectangle branches and `findRoomOpenings` go).
    - **Mask:** `reserved` gets a third value, `Openable`, written by room steps from the start. Opening an exit updates it, so steps that know nothing about rooms (cave tunnels, exits, your own) can find and use a room's potential exits, including the nearest one from a point.
    - **The look of the maps is meant to stay the same.** The candidates, the lattice rule and the order along a wall match today's. The one trap is the shared-wall door, which must keep keying on `Room.template`.
11. **Halls and caverns are features, not rooms.**
    - **No room entries:** a game asks for them explicitly ("one cavern with an exit"), with settings of their own. They come from their own generator steps: the cave steps (cellular automaton or noise) and `digPillarHalls`, placed in an area of the map (decision 12). They never appear in `rooms`, and `Room` gets no `kind`.
    - **The mine's `addNoiseCaverns` goes.** A mine cavern is `carveNoiseCave` or `growCave` in a small area, joined by a tunnel step.
    - **Joining is the corridor step's job.** `carveCorridors` finds every patch of floor that is not a room (a cavern, a hall, a mine, a cave) and treats it internally as a stand-in room: its floor, its holes such as pillars, and the walls that touch it from outside as potential exits. That is task 20.
      - Corridors route round a stand-in, never through it.
      - A stand-in is never dropped; one that cannot be joined is a failure, like a template.
      - A corridor that reaches it just opens the wall into floor: no `Exit` entry and no door, since `Exit.rooms` stays about rooms.
    - **Features reserve nothing**, so `digCaveTunnels` can still dig through cave rock, and the extras are untouched.
12. **Feature steps take an `area`** (`{ width?: Range; height?: Range }`) and a `count` (`Range`, default 1).
    - **The default** is the map's size, which is today's behavior. An area may be smaller than the map but never larger, checked in `validate`.
    - **A smaller area** goes on a random free spot: a box whose tiles are all free (`isFree`), with a margin of one free tile, tried a number of times, then an ordinary failure that the pipeline retries.
    - **Later rules:** rules per feature (keep off roads and streams, as clearings do; stay near the existing floor) may come later, as additions.
    - **`count` may be 0** (confirmed in task 3), so a feature step can be optional; a caller who wants a feature with a chance of, say, 50% sets `count: { min: 0, max: 1 }`. The caller decides which features a map has.
    - **Errors** need not have a special class, but their message, which ends up in the result's `failures`, must say what was wrong and what to do about it.
    - **Copies:** each copy of `count` gets its own spot. A `count` above 1 with the area as big as the map is a `RangeError`.
    - **How a step builds it:** it builds the feature on a scratch map the size of the box, made from a copy of the box's contents, then copies it back. It shifts its own extras by the offset. A generic wrapper was rejected, since it cannot shift arbitrary extras.
    - **Which steps get it in this plan:** every feature-making step: `growCave`, `carveNoiseCave`, the four mine layouts, `carveMaze`, `placeMazeRooms`, `scatterRooms`, `partitionRooms`, `growRooms`. Steps that join or open what is there (`digCaveTunnels`, `carveCorridors`, `openMazeRooms`, `placeMineRooms`, `addExits`) work on the whole map. Forest steps get it later (backlog).
13. **Cave steps take a `placement`** (settled in task 10/21, when the mine caverns of the plan failed on most maps for want of a free box):
    - **`'free'`**, the default, is decision 12's rule: the box and a margin of one tile are all free.
    - **`'beside'`** is the old mine caverns' rule. The cave is built and culled on its own grid first, so its shape is known. It is then tried at up to 100 random spots (20 at first, raised in task 10/21: with 2 caverns of the preset on 80×50 maps, failed maps fell from 11–66% to 1–26%, rings aside). A spot fits when every floor tile of the cave, and the 8 tiles round it, is free. Of the spots that fit, the one whose floor comes nearest the dug ground wins. The box may overlap tunnels; the cavern's floor never touches them.
      - **When no spot fits:** the copies up to `count.min` fail the map (an ordinary error the pipeline retries), and the copies above it are left out. So a `count` with a `min` of 0 never fails.
    - **`'overlap'`** puts the box on any spot clear of the other copies and lays floor on free tiles only, so the cavern runs into what is there (a cave-in). Reserved tiles are never dug.
    - **The mine preset's `caverns`** use `'beside'`, with an `area` of 12 to 24 a side, `largestOnly`, a noise scale of 7 and `count` 1 by default (to be tuned later).
    - **Later:** the overlap may become a share, a fraction or a `Range` of the cave's tiles that may overlap other things (default 0 to 0), still never over reserved tiles.

## What the port changes for all four generators

- **Seeds give different maps.** The order of `random()` calls changes, as it did for the forest. No test pins a generated map beyond the 3×3 maze, so the tests survive: they are structural, plus same-seed comparisons.
- **Presets stay.** `generateMine`, `generateCave`, `generateNoiseCave`, `generateMaze`, `generateRoomDungeon` and `generateDigDungeon` (decision 8) become compositions, like `generateForest`:
  - Their options are nested, one key per step.
  - Their results gain `attempts` and `failures`.
  - An internal `createXSteps(options)` lists the steps for the playground and for scripts.
- **`retryPlacement` and the `build-*.ts` wrappers go.** The pipeline owns retries. `retry-placement.ts` is deleted with the digger.
- **Step names are verbs** (ROADMAP naming rule). An internal function whose name a step takes is renamed, to keep "one export named after its file":
  - `carve-maze.ts` becomes `backtrack-maze.ts`.
  - `rooms/scatter-rooms.ts` and `rooms/partition-rooms.ts` become `scatter-room-plan.ts` and `partition-room-plan.ts`.
  - `dungeon/place-rooms.ts`, which only switched between them, is deleted.
- **Hidden state** is rebuilt from extras, or from the grid and the `reserved` mask, never passed privately (ROADMAP rule).
- **Every task** documents its steps in the README › Composing maps, adds them to `demo/step-defs.ts` and runs the four checks.

## Machinery added (tasks 1 to 3)

- **`MapState.reserved: Uint8Array`**, one byte per tile, with the values of a new `Reserve` constant (`src/pipeline/reserve.ts`, part of the contract like `Tile`):
  - `None` 0: free.
  - `Solid` 1: never dug through.
  - `Openable` 2: also never dug through, but a step may open it as an exit (decision 10).
  - **Helpers:**
    - `emptyMap` creates it all `None`.
    - A new `reserveTile(state, x, y, kind)` in `src/pipeline/` sets it.
    - A new `openReserved(state, x, y)` marks an exit that was opened: the tile and every `Openable` tile around it, diagonals included, become `Solid`, so no two exits end up side by side.
  - `stampTile` leaves it alone. Anything that only asks "may I dig here" checks `!== None`, so `Openable` costs nothing there.
  - A new `isFree(state, x, y)` replaces the inline `grid === base || prunable` checks of the forest. It is true when the tile holds `base` or is prunable, and is `None`.
  - The forest's `placeTemplates` reserves its non-`Unused` cells as `Solid`, so a later underground step cannot dig through a ruin.
- **`addExits`**, in a new `src/exits/` directory:
  - It sits right under `rooms/` (not under `pipeline/`, as first planned) and uses `core/`, `pipeline/` and `rooms/`, because it mirrors exits with `createTransforms` of `rooms/templates/`, and maze, cave and mine all need it while the maze may not import `cave/`.
  - It is built from `carveCaveExit` (`src/cave/carve-cave-exit.ts`), which moves there.
  - Options:
    - `count: Range` (default 0 to 0);
    - `lattice?: boolean`: odd border coordinates only, for mazes;
    - `symmetry?: LayoutSymmetry`, `symmetryChance?: number`;
    - `tile?: Tile` (default `Door`).
  - The tunnel never crosses a reserved tile. It keeps the 10-misses rule and adds `exits: Point[]`. An existing `exits` extra is appended to, and its doors count as neighbors to keep away from.
  - The maze's `carveExit` (`src/maze/carve-exit.ts`) is deleted in task 12, when the maze moves onto `addExits` with `lattice: true`. Maze exits then prefer the shortest tunnel per side, like cave exits; that is accepted.
- **Areas** (decision 12), in `src/pipeline/`:
  - `AreaSize` (`{ width?: Range; height?: Range }`), the type of the `area` option. It is not called `Area`, since `core/area.ts` is the rectangle type already.
  - `assertAreaSize(area, count, width, height)` for `validate`.
  - `placeAreas(state, random, area, count, { lattice? })` returns one `Area` box per copy, or throws the ordinary error when a copy finds no spot. `lattice` keeps an even offset and odd sizes, so a maze or lattice rooms line up with the map's lattice.
  - `buildInArea(state, box, build)` makes the scratch state (grid, `prunable`, `reserved`, `base`, copied from the box), runs `build` on it, copies the three back, and returns what `build` returned. Shifting the extras by the offset is left to the step.

## Steps by family

| Step             | Dir        | Needs   | Reads if present                               | Adds                                           | Notes                                                                                                 |
| ---------------- | ---------- | ------- | ---------------------------------------------- | ---------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `addExits`       | `exits/`   | none    | `exits`                                        | `exits`                                        | above                                                                                                 |
| `digFishbone`    | `mine/`    | none    | `passages`                                     | `passages`                                     | wraps `layFishbone`, draws `angle` itself; area, count                                                |
| `digVeins`       | `mine/`    | none    | `passages`                                     | `passages`                                     | wraps `layVeins`; area, count                                                                         |
| `digPillarHalls` | `mine/`    | none    | `passages`, `halls`                            | `passages`, `halls`                            | wraps `layPillars`; area, count                                                                       |
| `digRings`       | `mine/`    | none    | `passages`                                     | `passages`                                     | wraps `layRings`; area, count                                                                         |
| `placeMineRooms` | `mine/`    | none    | `passages`, `rooms`, `roomExits`, `roomShapes` | `passages`, `rooms`, `roomExits`, `roomShapes` | wraps `layRooms`, sets `reserved`, on any map with floor                                              |
| `growCave`       | `cave/`    | none    | `caverns`                                      | `caverns`                                      | cellular automaton (`createCaveNoise` plus `smoothCave`), with region culling; area, count            |
| `carveNoiseCave` | `cave/`    | none    | `caverns`                                      | `caverns`                                      | `createNoiseCaveGrid` plus optional smoothing, with region culling; area, count                       |
| `digCaveTunnels` | `cave/`    | none    | none                                           | none                                           | wraps `connectCaves`, with style, width, windiness, loops and symmetry                                |
| `placeMazeRooms` | `maze/`    | none    | none                                           | `rooms`, `roomShapes`                          | templates and ordinary rooms on the lattice, sets `reserved`; area                                    |
| `carveMaze`      | `maze/`    | none    | none                                           | `start`                                        | the backtracker, treating reserved tiles as blocked; area (lattice-aligned), count                    |
| `openMazeRooms`  | `maze/`    | `rooms` | `roomShapes`                                   | `rooms`, `roomExits`                           | reaches the fixed exits, then opens rooms                                                             |
| `scatterRooms`   | `dungeon/` | none    | `rooms`, `roomShapes`                          | `rooms`, `roomShapes`                          | rooms tried at random spots, sets `reserved`; area, count                                             |
| `partitionRooms` | `dungeon/` | none    | `rooms`, `roomShapes`                          | `rooms`, `roomShapes`                          | one room per BSP area, sets `reserved`; area, count                                                   |
| `growRooms`      | `dungeon/` | none    | `rooms`, `roomShapes`                          | `rooms`, `roomShapes`                          | rooms grown from a seed room (or the existing rooms) at a `gap`, sets `reserved`; area, count         |
| `carveCorridors` | `dungeon/` | `rooms` | `roomShapes`                                   | `rooms`, `exits`, `roomShapes`                 | the dungeon builder: links, stubs, extra exits, loops, dead ends; from task 20 it also joins features |

The three placement steps share one core (`prepareTemplates`, `createRoomPlan`, carving, reserving, the `roomShapes` extra) and differ only in how they pick spots. A placement step that finds `rooms` already in the state appends to them, keeping the ids in order, so rooms of two placement steps can be combined.

Shared rules:

- **Mine passages.** Each mine step builds its own simplex noise from `ctx.random`. It takes the lane offset from the passage count, `0.5 + passages.length * LANE_SPACING` (`src/mine/dig-vein.ts`), and returns the earlier `passages` with its own appended, as `addClearingPaths` does with `roads`.
- **Mine layouts in two parts of a map** are two step calls, each with its own area. Two layouts in the same area may leave two pieces that are not joined; a tunnel step joins them.
- **Cave steps cull their own regions** (`minRegionSize`, `largestOnly`, the old `connect: 'largest'`) on their scratch map, so a small cavern keeps its largest piece without touching the rest of the map. The approved `cullCaves` step goes, since culling the whole map after composing would also eat other features. `caverns` reports the box of each copy (the old mine `caverns`, an `Area[]`).
- **Cave `regions`** are not an extra, since they go stale. The presets compute them after the pipeline with `findCaveRegions` and `describeCaveRegion`.
- **`roomShapes`** is a shared plain-data extra in `src/rooms/`, used by the mine, the maze and the dungeon (decision 10):
  - It holds one entry per room id, for every room. Each entry is a `TemplatePlacement`.
  - An ordinary room's shape is a ring of `OptionalExit` around its floor, with wall corners. That is the mine's `createOrdinaryRoom`, which moves to `src/rooms/` as `createRoomShape`. A templated room's shape is its placement, as today.
  - Each entry carries its door decisions as a list of `{ x, y, door }`. A helper rebuilds the `ReadonlyMap` that `carveTemplate`, `findTemplateOpenings` and `createDungeonBuilder` take.
  - `TemplatePlacement` is already plain data.
  - **Whether a room is templated** is still told by `Room.template`, never by "has a shape". It matters for:
    - shared-wall doors, which join ordinary rooms only;
    - fixed exits;
    - which rooms may be dropped;
    - `fill`.
  - `Room.x/y/width/height` keep their public meaning: the floor of an ordinary room, the bounding box of a templated one.
- **Room steps reserve from the shape:** `Wall` and `Floor` cells as `Solid`, `OptionalExit` cells as `Openable`, and fixed `Exit` and `Door` cells as `Solid` once they are opened. Every step that opens an exit, of a room or of the map, calls `openReserved`.
- **Symmetry option names:**
  - `symmetry` and `symmetryChance` mean the mirror layout (`LayoutSymmetry`) everywhere.
  - The patterns that steer corridors are `corridorSymmetry` and `corridorSymmetryChance` (dungeon), and `pattern` and `patternChance` (maze, whirlpool and snowflake).
  - With a smaller area, a symmetry mirrors about the center of the area.

## Tasks (stop and report after each)

### Machinery

- **Task 1/21: the reserved mask. Done, awaiting review.**
  - **Code:** `MapState.reserved`, `Reserve`, `emptyMap`, `reserveTile`, `openReserved`, `isFree`; the forest's `placeTemplates`, `placeClearings` and the paths use `isFree`, and `placeTemplates` reserves its cells; `index.ts` exports.
  - **Tests:**
    - the mask starts empty;
    - `reserveTile` sets each kind;
    - `openReserved` turns the tile and the `Openable` tiles around it `Solid`, and leaves `None` alone;
    - `isFree` combines the three rules;
    - a forest template's cells are reserved.
  - **README:** `MapState`, `Reserve` and the free rule.
  - **Playground:** a "show reserved" overlay on the steps page, drawn from the snapshot, with `Solid` and `Openable` in two colors picked from `Color` (the user does not mind which).
- **Task 2/21: `addExits`. Done, awaiting review.**
  - **Code:** `src/exits/add-exits.ts` plus its options file; `carveCaveExit` moves to `src/exits/` with a `lattice` flag and a reserved check. `generateCave` and `generateMine` import it from the new place for now.
  - **Tests:**
    - count and misses;
    - lattice coordinates;
    - symmetric twins;
    - no tunnel through a reserved tile;
    - an `exits` extra is appended to.
  - **Docs:** CLAUDE.md layout gains `exits/`.
  - **Playground:** `addExits` in the list, with a Wall base.
- **Task 3/21: areas. Done, awaiting review.**
  - **Code:** `AreaSize`, `assertAreaSize`, `placeAreas`, `buildInArea` (decision 12), exported.
  - **Tests:**
    - the default is the whole map;
    - an area larger than the map fails `validate`;
    - `count` above 1 with a whole-map area fails `validate`;
    - spots are free with a one-tile margin and do not overlap each other;
    - no spot gives the ordinary error that the pipeline retries;
    - the lattice alignment;
    - `buildInArea` copies the grid and both masks back, and a whole-map area gives the same map as building in place.
  - **README:** an "Areas" part under Composing maps.
  - **Playground:** an `areaFields` helper in `demo/step-fields.ts` (width and height ranges, blank for the map, and `count`), first used by task 4.

### Mine (the simplest: the stages already read only the grid)

- **Task 4/21: `digFishbone` and `digVeins`. Done, awaiting review.**
  - Options are today's fishbone and veins fields plus `density`, `area` and `count`. `density` is a share of the area. Layout options are no longer marked "fishbone only" or "veins only", since each step has its own. `assertMineOptions` splits per step.
  - **Tests:**
    - density reached;
    - border ring kept;
    - one connected piece;
    - `passages` appended and shifted by the area's offset;
    - lanes continue from an existing `passages`;
    - two copies in two areas.
  - **As built:**
    - `layFishbone` and `layVeins` take an optional `lane` (the first lane of the noise) and `protect` (a mask of tiles never dug, fed from `reserved`) in their settings; `carvePassageTiles` protects any non-zero byte.
    - `digInAreas` is the shared core: it picks the boxes with `placeAreas`, digs each with `buildInArea` on one noise shared by the copies, and shifts the passages by the box. Lanes continue from the passages so far.
    - `assertFishboneOptions` and `assertVeinOptions` hold the checks that belong to one layout, and `assertMineOptions` calls them.
    - Both steps need a map that starts as wall (`assertDigArea`, in `validate`), since the layouts only dig wall. A map of another base throws a `RangeError` that says how to start it.
    - `buildMine` is untouched until task 10.
    - The playground has cards for both and a "Load a mine" button that sets the base to wall.

- **Task 5/21: `digPillarHalls` and `digRings`. Done, awaiting review.**
  - Both take `area` and `count`. A pillar hall on its own is `digPillarHalls` with `halls: 1` in a small area. `halls` boxes are shifted by the offset.
  - **Tests:** today's pillar and ring assertions, ported, plus one hall in an area.
  - **As built:**
    - `layPillars`, `growHallNetwork`, `digRoutedVein` and `layRings` take the optional `lane` and `protect` of task 4. A hall is never placed over a protected tile, and a routed vein treats protected tiles as blocked. The wobble of the rings moves with the lane, so two ring sets do not wobble alike; at the default lane the old mines are unchanged.
    - `digInAreas` now returns `{ passages, halls }` and shifts both; `lay` may return `halls`.
    - `assertPillarOptions` and `assertRingOptions` hold the checks of the two layouts, and `assertMineOptions` calls them.
    - The tests port the core assertions (halls apart, pillars standing, one piece, rings first and closed, ring count, border ring); the full set stays on `generateMine` until task 10.
    - The playground has cards for both and an **Outline halls** overlay, and the stats count `passages` and `halls`.
- **Task 6/21: `placeMineRooms`. Done, awaiting review.**
  - Rooms already use shapes (`createOrdinaryRoom`), so this is where the shared `roomShapes` type and `createRoomShape` move into `src/rooms/`.
  - Rooms reserve from their shapes (`Solid` and `Openable`), add or append `roomShapes`, and call `openReserved` for every opening. The step leaves reserved tiles alone.
  - A template that cannot be joined throws the ordinary `TemplatePlacementError`, which the pipeline retries.
  - **Tests:**
    - rooms on a mine;
    - rooms on a map with hand-made floor, to show that any floor works, not only a mine;
    - the reserved mask is set (walls `Solid`, potential exits `Openable`, opened exits and their neighbors `Solid`) and respected.
  - **As built:**
    - `RoomShape` (`src/rooms/room-shape.ts`) is a `TemplatePlacement` plus `doors: { x, y, door }[]`, the door decisions of its `Exit` and `Door` cells in map coordinates. It is exported, with `TemplatePlacement` and `TemplateExit`. The helper that rebuilds the door map from it waits for the task that first reads it (11 or 16).
    - `createRoomShape(floor: Area)` returns the ring placement round a floor. `reserveRoomShape(state, shape)` reserves walls, floor and inner doorways as `Solid`, and `OptionalExit` cells plus the `Exit` and `Door` cells that lead outside as `Openable`; the step then calls `openReserved` for every opening.
    - `layRooms` takes `protect` (fed from `reserved`): protected tiles are solid for room spots, templates (through the mine obstacle), the reach and the tunnels, so their floor is never joined. It also returns `roomShapes`. `generateMine` is unchanged.
    - Options follow the dungeon's names: `roomCount` (default 1 to 1), `roomWidth`, `roomHeight`, `sizeUniformity`, plus `templates`, `exitsPerRoom`, `doorChance`, `veinWidth`, `veinWindiness`, with today's defaults. `assertMineRoomOptions` checks them and validates the templates when the step is made.
    - `assertWallBase` was split out of `assertDigArea`, since the step needs a wall base but has no area.
    - The playground has a card (templates as JSON) and an **Outline rooms** overlay, and the stats count `rooms` and `roomExits`.

### Cave

- **Task 7/21: `growCave` and `carveNoiseCave`. Done, awaiting review.**
  - **Options:** each has its own generator options, `borderWalls` (at the edge of its area), `symmetry`, `symmetryChance`, `minRegionSize`, `largestOnly`, `area` and `count`. Each adds or appends `caverns`.
  - **Tests:**
    - today's noise, smoothing, symmetry and culling assertions, ported;
    - a cavern in an area keeps its largest piece and leaves the rest of the map alone.
  - **As built:**
    - The shared options are `CaveAreaOptions` (`src/cave/cave-area-options.ts`, exported), checked by `assertCaveAreaOptions`. Defaults are today's: `borderWalls` true, `symmetry` none, `symmetryChance` 1, `minRegionSize` 0, `largestOnly` false (today's default `connect: 'tunnel'` culls nothing either).
    - `carveCaveInAreas` is the shared core, like the mine's `digInAreas`: per box it makes the cave on its own grid (`createCaveNoise` plus `smoothCave`, or `createNoiseCaveGrid`), lays it over the scratch, culls, and stamps floor on free tiles only. Every other tile keeps what it has, so earlier floor and doors survive and reserved tiles get no floor.
    - **Culling and old floor:** unreserved floor that was there already counts as part of a cavern it touches, so a cavern cut by an earlier tunnel is still one cavern for `largestOnly`, and reserved tiles count as wall. A piece of old floor that no new floor touches is not a cavern of this cave, so it can never win `largestOnly` or be culled.
    - `carveNoiseCave` makes one noise per run and samples it at map coordinates (box offset added after the scale and rotation), so copies in two areas differ, a custom `noise` included.
    - Both need a wall base. `assertWallBase` moved from `src/mine/` to `src/pipeline/`, since `cave/` may not import `mine/`; its message now says the step "digs its floor out of rock".
    - New checks that today's generators lack: `neighborhood` and `shape` must be one of their values.
    - The playground has cards for both (sharing `caveFields`, and a `SYMMETRIES` list now also used by `addExits`), an **Outline caverns** overlay in cyan, and the stats count `caverns`.
- **Task 8/21: `digCaveTunnels`. Done, awaiting review.**
  - Options: `style`, `width`, `windiness`, `loops`, `borderWalls`, `symmetry`, `symmetryChance`.
  - It joins every floor region of the map, whatever made it, so it also joins a mine to its caverns.
  - The brush skips reserved tiles, and a tunnel that would need one is left out. Floor inside a room's footprint is not a region it joins; joining rooms is `carveCorridors`' job, or task 20's.
  - **Tests:**
    - the tunnel, loop and twin assertions, ported;
    - a mine and two caverns joined into one piece.
  - **As built:**
    - Defaults are today's (`winding`, width 1, windiness 0.5, loops 0, `borderWalls` true, `symmetry` none, `symmetryChance` 1). New check: `style` must be `winding` or `direct`. It adds no extras and needs a wall base.
    - It runs `connectCaves` on a copy of the grid with reserved floor turned to wall, with a `blocked` mask (new optional field of `TunnelOptions`): reserved tiles, the border ring with `borderWalls`, and every tile that is neither floor nor free (a door, a road). New floor is stamped back with `stampTile`.
    - The mask reaches `carveTunnelBrush`, the winding walk (a step onto a blocked tile is not taken), `findCaveLink`, `planCaveLoops` and `stampCaveTwins` (a twin on a blocked tile is left out). `carveDirectTunnel` takes the other bend when the drawn one is blocked, and the shortest way round (new `findTunnelPath`) when both are. Without a mask every path draws and digs as before, so `generateCave` and `generateNoiseCave` make the same maps.
    - **"Left out" means stranded, not dropped:** a group that cannot reach another piece without crossing a blocked tile is marked stranded and the next largest group carries on, so a reserved wall that splits the map leaves two joined halves rather than stopping. A dig that fails to join its ends also strands the group, so the loop always ends.
    - The mine-plus-caverns test lives in `src/mine/mine-with-caverns.test.ts`, since `cave/` may not import `mine/`.
    - The playground has a card for it (before `addExits`).
- **Task 9/21: `generateCave` and `generateNoiseCave` as presets. Done, awaiting review.**
  - **Options:** nested (`cave` or `noise`, `tunnels`, `exits`). The old one-key-many-meanings `connect` goes, since a step present or absent says it.
  - **Result:** `regions` is computed after the pipeline.
  - **Docs:** rewrite the README caves section.
  - **Playground:** retire `demo/cave.html` and `demo/cave.ts`.
  - **As built:**
    - The key is `cave` for both presets (not `noise` for the noise cave, which would give `noise.noise` for a custom noise function). `tunnels` is on by default and `false` leaves it out, like the forest's `footbridges`; `exits` is left out unless given. `connect: 'largest'` is now `cave: { largestOnly: true }, tunnels: false`, and the old one `layoutSymmetry` is passed to each step that should follow it.
    - `createCaveSteps` and `createNoiseCaveSteps` list the steps; `runCaveSteps` runs them on a wall map and computes `regions` with `findCaveRegions` and `describeCaveRegion`. `CaveResult` gains `attempts` and `failures` (always 1 and empty, since no cave step throws) and has no `caverns`, which would only hold the whole map.
    - Gone: `finish-cave.ts`, `cave-connection-options.ts` (`CaveConnect`, `CaveConnectionOptions`), `resolve-cave-connection-options.ts` and the four `generate-cave-*.test.ts` files, whose assertions the step tests hold. `CaveNeighborhood`, `NoiseCaveShape` and `CaveTunnelStyle` moved to files of their own.
    - Tests that only the old presets had moved to the steps: fill, corner bias, rotation, scales and shapes to `carveNoiseCave`, the limits and the von Neumann defaults to `growCave`, wide direct twins to `digCaveTunnels`. `carveNoiseCave` now checks `scaleX`, `scaleY`, `rotation`, `octaves`, `persistence` and `lacunarity` when it is made (they were checked only when it ran).
    - The mine's `layCaverns` calls the new `generateNoiseCave` until task 10 deletes it; a mine caverns test changed seed, since the draws moved.
    - Playground: the cave page is gone; the steps page has **Load a cave** and **Load a noise cave**, a **Mark region centers** overlay, and the regions of floor in the stats.

### Mine preset (needs the cave steps)

- **Task 10/21: `generateMine` as a preset. Done, awaiting review.**
  - **Options:** nested.
    - One key per layout step (`fishbone`, `veins`, `pillars`, `rings`). At most one may be given; none means `fishbone` with defaults, and more than one throws a `RangeError`.
    - The other keys are `caverns`, `rooms` (with `templates`, `exitsPerRoom` and `doorChance` inside it) and `exits`.
  - **Caverns** become `carveNoiseCave` with `placement: 'beside'` (decision 13), `area` from `cavernSize`, `count` from `caverns`, `fill` from `cavernFill` and `largestOnly`, followed by `digCaveTunnels`.
    - `placement` (`'free'`, `'beside'`, `'overlap'`) is built in this task, for `growCave` and `carveNoiseCave`, with a `placeBeside` helper in `src/pipeline/` and a field on both cave cards.
  - **Two layouts in one map** are two step calls in a pipeline of your own, never two keys of the preset. The README says so.
  - **Code:** delete `build-mine.ts`, `lay-caverns.ts` and the mine's `retryPlacement`.
  - **Docs:** rewrite the README mines section: options, defaults, result, examples.
  - **Playground:** retire `demo/mine.html` and `demo/mine.ts`, and keep `GLYPHS` and the README colors in sync.
  - **As built:**
    - `createMineSteps` lists the steps: the layout (a `RangeError` for two or more keys, which points to `pipeline`), then `carveNoiseCave` and `digCaveTunnels` when `caverns` is given (`tunnels: false` leaves the tunnel step out), then `placeMineRooms` for `rooms` and `addExits` for `exits`. `MineOptions` and the new `MineStepOptions` have the keys `fishbone`, `veins`, `pillars`, `rings`, `caverns`, `tunnels`, `rooms` and `exits`; `MineResult` gains `attempts` and `failures`, and its `caverns`, `rooms` and `roomExits` are now documented in the README too.
    - The preset's `caverns` default to `placement: 'beside'`, sides of 12 to 24 (cut down to the map less its border ring, so a small map does not throw for an area the caller never set), scales of 7 and `largestOnly`. Without it, the old `cavernSize` failed maps under 24 tiles a side.
    - **Placement (decision 13):** `CavePlacement` on `CaveAreaOptions`, checked by `assertCaveAreaOptions`. `carveCaveInAreas` takes it: `'beside'` builds and culls the cave on its own grid, with the noise sampled at a random spot, and places it with the new `placeBeside` (`src/pipeline/`, exported); `'overlap'` uses `placeAreas` with a new `overlap` flag that checks only the other boxes. `pickAreaSize` moved out of `place-areas.ts` to be shared. `placeBeside` tries 100 spots, not 20 (see decision 13).
    - Failure rates measured with the preset on 80×50, seeds 1–100, maps that still failed after 3 attempts: 1 cavern 0% (fishbone), 2% (veins), 0% (pillars), 93% (rings, which fill the map); 2 caverns 1%, 26%, 7%, 100%. A `count` with a `min` of 0, or `'overlap'`, never fails.
    - **Behavior changes:** the tunnels that join caverns are no longer in `passages` (`digCaveTunnels` adds none); `rooms` with `templates` alone now also places one ordinary room (`roomCount` defaults to 1 to 1), so templates alone need `roomCount: { min: 0, max: 0 }`; caverns are joined by `digCaveTunnels` instead of the old vein tunnel.
    - Gone: `build-mine.ts`, `lay-caverns.ts`, `assert-mine-options.ts`, `mine-layout.ts` (`MineLayout`), and the `MineRoomOptions` export (the type stays, for `layRooms`). `retryPlacement` stays for the dungeons.
    - **Tests:** the layout tests of `generate-mine.test.ts`, `generate-mine-veins.test.ts`, `generate-mine-pillars.test.ts` and `generate-mine-rings.test.ts` moved to the step tests, through a `dig` helper that runs the step alone, without the ones the step tests had already, the exit tests and "ignores the other layouts". One pillar test changed seed (a vein that runs too long is left out on some seeds). The room tests stay on the preset, nested; the cavern tests are new, for the new placement. New tests for `placeBeside`, the `overlap` flag and `placement` on both cave steps.
    - **Playground:** the mine page and its links are gone. The steps page gains **Load a mine with caverns** (cards may now be loaded with values of their own), a **Placement** select on both cave cards, and a **Mark tunnels** overlay, carried over from the mine page. **Load a mine** now loads `digFishbone` alone, the preset's default.

### Maze

- **Task 11/21: `placeMazeRooms`. Done, awaiting review.**
  - **Code:** wraps `prepareMazeRooms`, without `reachExits`.
    - Options: `rooms`, `templates`, `doorChance` (doors of templates), `keepClear?: Point` (which the preset fills with `start` so rooms avoid it) and `area`.
    - Ordinary rooms get their shape from `createRoomShape`. It reserves from the shapes and adds `rooms` and `roomShapes`.
  - **Known limit:** rooms for a maze in a smaller area must land in that maze's area. Two steps pick their spots independently, so rooms in a sub-area maze wait for a rule that pins an area to a position (later).
  - **Tests:** today's room and template placement assertions, ported, plus the reserved mask: the whole ring is `Openable`, and the lattice is filtered only when openings are listed.
  - **As built:**
    - **Options are flat**, as `placeMineRooms`' are, not a nested `rooms`: `roomCount` (default 1 to 1), `roomWidth`, `roomHeight`, `sizeUniformity`, `templates`, `doorChance`, `keepClear` and `area` (one box, on the lattice through `placeAreas({ lattice: true })`, so no `count`). Templates alone need `roomCount: { min: 0, max: 0 }`, as in the mine.
    - It wraps `prepareMazeRooms` in `buildInArea`, so template positions and areas are in the coordinates of the box. `prepareMazeRooms` now also returns `placements`, `doors` and `fail`, and no longer throws for a `start` in a template: `generateMaze` checks that itself (same `RangeError`), and the step fails the attempt with a `TemplatePlacementError` naming the template that covers `keepClear` (retried, since another map may put the template elsewhere).
    - The internal `src/maze/place-maze-rooms.ts` (ordinary rooms only) is renamed `plan-maze-rooms.ts` (`planMazeRooms`), to free the name. The `doorsOf` helper of `lay-rooms.ts` moved to `src/rooms/list-shape-doors.ts` (`listShapeDoors`), shared by both room steps.
    - **Not done:** on the whole map the rooms ignore what earlier steps built (as `prepareMazeRooms` always did); with an `area` the box only goes where the map is free. Avoiding non-free tiles is the composition work of task 15, and could be brought here then.
    - **Tests:** `place-maze-rooms.test.ts`, the room and template placement assertions of the two maze test files, ported to the step (those stay on `generateMaze` until task 13), plus the reserved mask (the whole ring of an ordinary room `Openable` at odd and even offsets alike, corners and floor `Solid`; a template's exit `Openable`, its walls `Solid`; nothing outside the footprints), the shapes and their door lists, rooms in an area on the map's lattice, appending to an earlier step's rooms, and the option checks.
    - **Playground:** a `placeMazeRooms` card (keep-clear x and y, blank for none, and the area without copies: `areaFields(false)`); the Templates label of both room cards now points to the template editor, as the mine page is gone.
- **Task 12/21: `carveMaze` and `openMazeRooms`. Done, awaiting review.**
  - **`carveMaze`:** the backtracker, with `isBlocked` from `reserved`.
    - Options: biases, `loopChance`, `fill`, `straight`, `pattern`, `patternChance`, `start`, `area` (lattice-aligned) and `count`.
    - A `start` on a reserved tile throws a `RangeError`.
    - It adds `start`, the start of the first copy.
  - **The rooms-with-symmetry throw goes:** partial symmetry is allowed, per decision 2.
  - **`openMazeRooms`:** rebuilds the openings from `roomShapes` and `reserved` with `findTemplateOpenings` alone, runs the `reachExits` logic, then opens the rooms, calling `openReserved` for each opening.
    - `findRoomOpenings` is deleted. Before deleting it, a test checks that both give the same openings for a ring shape, odd offsets included.
    - Options: `exitsPerRoom`, `doorChance`.
  - **Exits:** `addExits({ lattice: true })` replaces `carveExit`, which is deleted.
  - **Tests:** the maze, room-opening and template-exit assertions, ported, plus a maze in an area.
  - **As built:**
    - **`carveMaze`** (`CarveMazeOptions`, checked by `assertCarveMazeOptions`): the backtracker keeps off every tile that is not free (`isFree`, taken before carving), not only reserved ones, so it routes round the floor of earlier steps too. `start` is in the coordinates of the map and only for a maze on the whole map (a `RangeError` with an `area`); a `start` that is not a cell, or an area below 3, is a `RangeError` in `validate`; a `start` that is not free fails the attempt (a `RangeError` thrown in the run, so retried). Each copy starts at `start` or at the free cell nearest the middle of its box. It reserves nothing and adds `start` (none for 0 copies). The internal `carve-maze.ts` is renamed `backtrack-maze.ts` (`backtrackMaze`).
    - **`openMazeRooms`** needs `rooms` and `roomShapes` (not only `rooms`: every room step adds shapes) and opens only the rooms with no exits yet, on copies of them. Openings are `findTemplateOpenings` on each shape, with `isBlocked` from `reserved`, keeping only walls that are `Openable`; the fixed exits are reached by `reachFixedExits` (from `prepareMazeRooms`' `reachExits`, which goes), and the rest by the internal `openMazeOpenings` (the old `open-maze-rooms.ts`, renamed). Every exit goes through `openReserved` after all are made, so a room can still open two walls that meet diagonally at a corner, as before. A fixed exit that cannot be reached is a `TemplatePlacementError` with the template's index but no name, since the step has no templates.
    - **`findRoomOpenings`** is deleted. A one-off test gave the same openings for five ring shapes (map edges and a blocked cell included) before it went; the order differs, so seeds give other maps.
    - **`generateMaze`** now runs `placeMazeRooms` (with `rooms` or non-empty `templates`), `carveMaze`, `openMazeRooms` and `addExits({ lattice: true })` through `pipeline` with `attempts: 1`, keeping its flat options and result until task 13. Hence: the rooms-with-symmetry throw is gone; a template that covers `start` is a `TemplatePlacementError` (was a `RangeError`); room option errors name `roomCount`, `roomWidth` and `roomHeight`; `carveExit` is deleted. `prepareMazeRooms` lost its openings and `reachExits`.
    - **Tests:** `carve-maze.test.ts` (31: carving, perfect maze, loops, fill, start, pattern, reserved tiles and the parts they cut off, floor of earlier steps, a reserved start, an area on the lattice, copies, 0 copies, option checks) and `open-maze-rooms.test.ts` (21: room and template openings ported, the reserved mask after opening, rooms with exits left alone, appending to `roomExits`, rooms of earlier steps unchanged, needs, option checks). The `generateMaze` tests stay, with the throws above updated.
    - **Playground:** `carveMaze` and `openMazeRooms` cards, and **Load a maze with rooms** (`placeMazeRooms` with 3 to 5 rooms, `carveMaze`, `openMazeRooms`, `addExits` on the lattice). That composition failed on none of 100 seeds at 80×50.
- **Task 13/21: `generateMaze` as a preset. Done, awaiting review.**
  - **Options:** nested (`rooms`, `maze`, `openings`, `exits`).
  - **Docs:** rewrite the README mazes section.
  - **Playground:** retire the maze page (`demo/index.html` and `demo/main.ts` become the index that links to the steps page and the noise page).
  - **As built:**
    - `createMazeSteps` lists the steps: `placeMazeRooms` for `rooms` (its `keepClear` defaulting to `maze.start`), `carveMaze`, `openMazeRooms` with `openings` when there are `rooms` (`openings` alone is ignored, as the mine's `tunnels` are without `caverns`), and `addExits` for `exits` (its `lattice` defaulting to true). `MazeOptions` and the new `MazeStepOptions` have the keys `maze`, `rooms`, `openings` and `exits`; `maze` is `CarveMazeOptions` less `area` and `count`, so the preset's maze is always on the whole map and `start` is always reported. The pipeline's 3 attempts replace the single one of task 12/21; `MazeResult` gains `attempts` and `failures`.
    - **Behavior changes:** the old flat options are gone (`symmetry` and `symmetryChance` are `maze.pattern` and `maze.patternChance`, `minExits` and `maxExits` are `exits.count`, the room options are named as `placeMazeRooms`' are, `templates` is under `rooms`, and templates alone need `roomCount: { min: 0, max: 0 }`, as in the mine); a template that finds no place or covers the start is retried. `MazeRoomOptions` is no longer exported (the type stays, for `planMazeRooms`), and `prepareMazeRooms` takes only `templates` and `rooms`.
    - **Tests:** the carving tests of `generate-maze.test.ts` (tiny maze, dead ends, loops, fill 0, even-sized start, biases, straight, both patterns, the pattern chance, other seeds) moved to `carve-maze.test.ts`. `generate-maze-rooms.test.ts` and `generate-maze-templates.test.ts` are deleted, since the step tests of tasks 11/21 and 12/21 cover them; what only the preset can check moved into `generate-maze.test.ts`: the options reaching each step, rooms kept off `maze.start`, a start outside rooms and templates in the middle, every room opened and joined, template exits joined at a low fill, rooms with a pattern, a retry (seed 3: a template whose two spots include the start) and the error after 3 attempts, option errors named after their steps, and the exits on the lattice.
    - **Playground:** the maze page is gone; `index.html` links to the steps, dungeon and noise pages, and every page's nav starts with **Index**. The steps page gains **Load a maze** (`carveMaze` alone, the preset's default) and the maze page's two overlays, **Show room gaps** and **Mark maze start**. The template editor is now on the dungeon page only.

### Dungeon (the hardest)

- **Task 14/21: measure today's dungeons** (decisions 5 and 8). **Done, awaiting review.**
  - **Code:** `scripts/check-dungeon.ts`, run through Vite's `runnerImport` like `check-forest.ts`, plus `npm run check:dungeon`. It runs today's two dungeons over seeds 1 to 200, with 0, 2 and 5 templates that have fixed exits (from the playground's templates).
  - **Failure figures:**
    - inner attempts used;
    - map attempts used;
    - final failures;
    - time per map.
  - **Look figures, the baseline for the digger comparison of task 18:**
    - mean and longest corridor length;
    - the share of the map covered by the rooms' bounding box (how clustered they are);
    - mean exits per room;
    - dead ends;
    - room count.
  - **Outcome:** report the numbers. They are the baseline against which task 16 checks the retry rule of decision 5 and task 18 compares `growRooms` with the digger.
  - **As built:**
    - `npm run check:dungeon` (`scripts/check-dungeon.ts`) runs room-first scatter, room-first bsp (added, as the baseline of `partitionRooms`) and the digger at 61×41 with the dungeon page's defaults, over seeds 1 to 200, with 0, 2 and 5 templated rooms: the playground's closet and hall, both with a fixed exit, two in five of them halls (2 is a closet and a hall, 5 is three closets and two halls). Flags: `--from`, `--to`, `--seeds`, `--templates 10,15,20` and `--placement lattice`.
    - **Counting the tries:** `buildRoomDungeon` and `buildDigDungeon` take an optional `onTry` callback, called before each of their 10 tries; the script does the 3 maps of `retryPlacement` itself, to count them. The maps are unchanged. Both functions go in tasks 17 and 19.
    - **Look figures:** a corridor is a piece of open tiles outside every room and exit, joined orthogonally, so a piece that branches or joins several rooms counts as one. "Longest" is the mean of each map's longest piece. Spread is the box round every room over the map. Exits per room count a shared door for both rooms. Dead ends are corridor tiles with one open neighbor; at the default `deadEndChance` of 0 there are none.
    - **Baseline (free placement, 200 seeds):**

      | dungeon, templates | tries (most) | maps | retried | failed | ms (most)  | rooms | corridor | longest | spread | exits |
      | ------------------ | ------------ | ---- | ------- | ------ | ---------- | ----- | -------- | ------- | ------ | ----- |
      | scatter, 0         | 1.00 (1)     | 1.00 | 0       | 0      | 2.6 (13)   | 12.8  | 22.3     | 66.6    | 0.77   | 1.98  |
      | scatter, 2         | 1.00 (1)     | 1.00 | 0       | 0      | 4.0 (14)   | 14.3  | 24.0     | 73.8    | 0.79   | 1.92  |
      | scatter, 5         | 1.00 (1)     | 1.00 | 0       | 0      | 8.0 (24)   | 16.2  | 26.3     | 82.8    | 0.83   | 1.81  |
      | bsp, 0             | 1.00 (1)     | 1.00 | 0       | 0      | 4.3 (40)   | 16.5  | 20.2     | 68.3    | 0.88   | 1.99  |
      | bsp, 2             | 1.00 (1)     | 1.00 | 0       | 0      | 5.0 (43)   | 17.2  | 23.0     | 78.2    | 0.89   | 1.93  |
      | bsp, 5             | 1.00 (2)     | 1.00 | 0       | 0      | 11.7 (570) | 19.2  | 25.9     | 90.1    | 0.89   | 1.83  |
      | digger, 0          | 1.00 (1)     | 1.00 | 0       | 0      | 2.1 (30)   | 13.2  | 10.0     | 35.0    | 0.58   | 1.98  |
      | digger, 2          | 1.00 (1)     | 1.00 | 0       | 0      | 2.8 (11)   | 14.7  | 11.7     | 43.6    | 0.65   | 1.91  |
      | digger, 5          | 1.00 (1)     | 1.00 | 0       | 0      | 6.9 (17)   | 16.5  | 15.5     | 59.4    | 0.74   | 1.78  |

    - **Under load** (`--templates 10,15,20`): no seed fails, but tries and time grow from 15 templated rooms on. Room-first scatter: 1.11 tries per map, 2 seeds of 200 needing a second map, 81 ms per seed and 3.9 s at most at 15; 1.21 tries, 4 seeds, 94 ms and 2.2 s at 20. Bsp is alike (1.10 and 1.20 tries, 1 and 4 seeds, 3.1 and 2.1 s at most). The digger holds out longer: 1.02 and 1.05 tries, 0 and 1 seeds, 2.6 s at most at 20. At 10 templated rooms no dungeon needs a second try.
    - **Lattice placement:** no retries at 0, 2 and 5, with a look close to free placement (scatter 13.1 rooms, corridors 23.6, spread 0.79; digger 13.5, 9.7, 0.58).
    - **What it means for tasks 16 and 18:** at the defaults the retry rule is all but untested, so task 16 compares at `--templates 15,20` too, where the failures and the slow seeds are. For the look, the digger's corridors are half as long as room-first's (10 against 22, longest 35 against 67) and its rooms cluster (spread 0.58 against 0.77): those are the figures `growRooms` has to come near.
- **Task 15/21: `scatterRooms` and `partitionRooms`.**
  - **Code:** the shared placement core plus the two steps. The core wraps `prepareTemplates`, `createRoomPlan`, carving and reserving. The steps wrap the renamed `scatterRoomPlan` and `partitionRoomPlan`.
    - Options (both steps):
      - room sizes, count, fill and spacing;
      - `placement`;
      - `templates` and `templateSymmetry`;
      - `doorChance` for the doors of templates;
      - `symmetry` and `symmetryChance`;
      - `area` and `count`. `fill` is a share of the area.
    - Each step also takes its own `spacingUniformity`.
    - Each gives ordinary rooms a shape with `createRoomShape`, carves its rooms, reserves from the shapes, and adds or appends `rooms` and `roomShapes`, shifted by the offset.
    - With `roomSpacing: 1` the wall rings of two neighbors overlap. A tile that is `Openable` for both stays `Openable`, and the shared-wall door of task 16 uses it.
  - **Composition:** ordinary rooms also avoid tiles that are not free, with spacing, through a summed-area table of the "not free" mask, so the check stays O(1) per candidate. Templates go through the existing blocker. If the template scan proves slow on a busy map (the mine lesson, ROADMAP › Rooms and templates), report it and leave that part out.
  - **Tests:** the placement assertions of both partitions, ported, plus appending to existing `rooms`, avoiding hand-made floor, and rooms in an area.
- **Task 16/21: `carveCorridors`.**
  - **Code:** wraps `connectRooms` and `createDungeonBuilder` (`src/dungeon/connect-rooms.ts`, `dungeon-builder.ts`).
    - Options:
      - `connection`, `exitsPerRoom`, `loopChance`, `deadEndChance`;
      - `straight` and the biases;
      - `doorChance`, `placement` (lattice);
      - `symmetry` and `symmetryChance`, with the mirror transforms rebuilt by `createTransforms(symmetry, w, h, lattice)`;
      - `corridorSymmetry` and `corridorSymmetryChance` (`createSteering`).
  - **One path for exits (decision 10):** every room has a shape, so the rectangle branches of the builder's room registration and of `slotsOf` go.
    - `sharedWalls` keeps joining only ordinary rooms, keyed on `Room.template`, not on whether a room has a shape. Otherwise rooms one wall apart would need a corridor that cannot fit and would be dropped.
    - The builder's internal `reserved` starts from `state.reserved`, so corridors avoid what earlier steps built.
    - Every exit it opens goes through `openReserved`.
  - **Same look:** with the same options, `check:dungeon`'s look figures should match the task 14 baseline in size. Any drift is reported.
  - **Dropping rooms:**
    - It snapshots grid and `reserved` on entry.
    - A stranded ordinary room, with its twins, is dropped by setting its tiles back to `base` and clearing `reserved`. That replaces the `new Grid` plus re-carving loop.
    - Templated rooms are never dropped (a stranded template is a failure), and a twin search never matches one.
    - Rooms and `roomShapes` are renumbered together and both returned anew, since appended placement steps mean templated rooms no longer always hold the lowest ids.
  - **Failures:** decision 5. `check:dungeon` reports the final failures and the time per map against the task 14 baseline; if it does worse, the constants are tuned and the change reported.
  - **Tests:** connection, loops, dead ends, symmetry, partial symmetry (symmetric rooms with free corridors), dropping, the template throw and the retry.
- **Task 17/21: `generateRoomDungeon` as a preset.**
  - **Options:** nested (`scatter` or `partition`, at most one, `scatter` by default; `corridors`). `fill` in the result is computed from `rooms` and `roomShapes`.
  - **Code:** delete `build-room-dungeon.ts`.
  - **Docs:** rewrite the README dungeon section for room-first.
  - **Playground:** the dungeon page loses its room-first mode and keeps only the digger, for the comparison of task 18.
- **Task 18/21: `growRooms`, and the comparison with the digger.**
  - **Code:** a third placement step on the shared core.
    - **Seed:** the first template, or a center room (`createCenterRoom`), or the existing `rooms` when there are any and the area is the whole map.
    - **Loop:** it repeats until `roomCount` and `fill` are met or 300 tries in a row fail (the digger's `MAX_FAILURES`):
      - pick a room that is not crowded;
      - pick a wall, tipped by `horizontalBias` and `verticalBias`;
      - place a room beyond it with `roomBeyond`, at a `gap` drawn from a range.
    - **Gaps:**
      - a gap of `n` is `n` tiles of corridor between two walls, as `corridorLength` was;
      - 0 is a shared wall, which `carveCorridors` turns into one door;
      - gaps that leave no room for a corridor are skipped, like `roomSpacing: 2`.
    - **Options:**
      - `gap` (default 1 to 8, as `corridorLength`);
      - room sizes, count, fill and spacing;
      - `placement`;
      - `templates` and `templateSymmetry`;
      - `doorChance`;
      - `symmetry` and `symmetryChance`;
      - the two biases;
      - `area` and `count`.
    - It sets `reserved`.
  - **Preset:** `generateDigDungeon` becomes `growRooms` plus `carveCorridors`.
  - **Gate:**
    - `check:dungeon` gains a grown-dungeon run with the look figures of task 14, next to the digger's baseline.
    - The playground shows the digger page and the steps page side by side at the same options.
    - Report and stop; the user gives the verdict.
  - **Tests:** growth from a seed, from a template and from existing rooms; the gap, including 0; the stop rule; symmetry; growth in an area.
- **Task 19/21: retire the digger** (or, if the user rejected the look, port it as one `digDungeon` step instead).
  - **Code:**
    - Delete `build-dig-dungeon.ts`, `dig-corridor.ts` and `retry-placement.ts`. `generate-dig-dungeon.ts` holds the `growRooms` preset.
    - Trim the builder's public interface to what `carveCorridors` uses. Adding rooms after creation, `place` with `accepts`, `slotsOf`, `atCapacity`, `ownerOf`, `isExitAllowed`, `map` and `corridors` are digger-only; `place` stays as an internal function.
    - `corridorLength` and `branchChance` go.
  - **Docs:** README: the digger section becomes the `growRooms` section, and what was dropped (rooms off corridor forks) is not mentioned as a feature any more.
  - **Playground:** retire `demo/dungeon.html` and `demo/dungeon.ts`.

### Joining more than rooms (decisions 10 and 11)

- **Task 20/21: features join the network.**
  - **`carveCorridors` stand-ins** (decision 11):
    - **Finding them:** on entry it flood-fills the floor that lies outside every room's shape. Each piece becomes an internal `TemplatePlacement`:
      - its floor and its holes (walls that the piece encloses, such as pillars) as cells;
      - the walls that touch it from outside, unreserved, as `OptionalExit`.
    - **Linking:** stand-ins take part like templated rooms, except that they are never dropped (a stranded one is the failure of decision 5), never joined by a shared-wall door, and get no `Exit` entry. Distances to a stand-in are measured to its nearest tile, not to its box, since a whole mine's box covers the map.
    - **Not in the extras:** `rooms` and `roomShapes` never hold a stand-in.
  - **`digCaveTunnels` into rooms:** a cave tunnel may now end at a room, entering it through its nearest `Openable` tile and opening it with `openReserved`. So "a cave with rooms, joined by cave tunnels" works.
  - **A helper:** `findNearestOpenable(state, from)` (`src/pipeline/`) is a breadth-first search to the nearest `Openable` tile, with the direction read from its unreserved neighbor. It is the first reader of the mask outside the room steps.
  - **Tests:**
    - a pillar hall in an area plus scattered rooms, joined into one piece;
    - a noise cavern plus grown rooms, joined;
    - a whole mine plus rooms;
    - stand-ins never dropped and never in `rooms`;
    - a cave tunnel into a room through an `Openable` tile;
    - the nearest-openable search.
  - **Figures:** `check:dungeon` gains a run with a hall and a cavern, for failures and time per map.
  - **Playground:** these compositions available on the steps page.

### Wrap-up

- **Task 21/21: docs tidy.**
  - **ROADMAP:**
    - where the library stands, next up, and the underground design decisions as clean sections (memory: tidy the roadmap after sign-off);
    - the backlog entries below.
  - **CLAUDE.md:** the scope sentence, steps and presets for every generator, the `retryPlacement` lines removed, and the layout with `exits/`.
  - **README › Composing maps:** an overview table of all steps.
  - **Playground:** `demo/noise.html` stays as a subpage; every generator lives on the one steps page; the index page links to both.

## Backlog entries written in task 21

- **Corridor-first dungeon:** tunnels laid first (straight, lattice-friendly), rooms sprouted off them where they fit, with doors, and dead ends where none fit. It is kept only if it produces dungeons clearly distinct from `scatterRooms`, `partitionRooms` and `growRooms` with `carveCorridors`, and from a mine with rooms; otherwise it is dropped. Needs a design talk.
- **Areas for the forest steps** (`plantTrees`, `addStreams`, `addRoads`, `placeClearings`, `placeTemplates`).
- **Overlap as a share** (decision 13): `placement: 'overlap'` may become a fraction or a `Range` of a cave's tiles that may overlap other things (default 0 to 0), never over reserved tiles.
- **Rules for area spots per feature:** keep off roads and streams, stay near the existing floor (the old mine caverns), or a pinned position, which also lets rooms land in a sub-area maze.

## Critical files

- **Machinery:** `src/pipeline/map-state.ts`, `empty-map.ts`, new `reserve.ts`, `reserve-tile.ts`, `open-reserved.ts`, `is-free.ts`, `area-size.ts`, `assert-area-size.ts`, `place-areas.ts`, `build-in-area.ts`, `find-nearest-openable.ts`, `src/index.ts`.
- **Room shapes:** `src/mine/create-ordinary-room.ts` (moves to `src/rooms/create-room-shape.ts`), new `src/rooms/room-shape.ts`; `src/rooms/find-room-openings.ts` is deleted.
- **Exits:** new `src/exits/` (from `src/cave/carve-cave-exit.ts`); `src/maze/carve-exit.ts` is deleted.
- **Mine:** `src/mine/build-mine.ts` and `lay-caverns.ts` (deleted), `lay-*.ts`, `lay-rooms.ts`, `assert-mine-options.ts`, `mine-options.ts`, `generate-mine.ts`.
- **Cave:** `src/cave/finish-cave.ts` (split up), `create-cave-noise.ts`, `create-noise-cave-grid.ts`, `smooth-cave.ts`, `connect-caves.ts`, `carve-tunnel-brush.ts`, `resolve-cave-connection-options.ts`, `generate-cave.ts`, `generate-noise-cave.ts`.
- **Maze:** `src/maze/prepare-maze-rooms.ts`, `carve-maze.ts` (renamed), `open-maze-rooms.ts`, `generate-maze.ts`.
- **Dungeon:**
  - in `src/dungeon/`: `build-room-dungeon.ts`, `build-dig-dungeon.ts`, `connect-rooms.ts`, `dig-corridor.ts`, `dungeon-builder.ts` (interface trimmed, stand-ins), `place-rooms.ts` (deleted);
  - in `src/rooms/`: `scatter-rooms.ts` and `partition-rooms.ts` (renamed), `room-beyond.ts`, `create-center-room.ts`, `templates/prepare-templates.ts`, `templates/retry-placement.ts`.
- **Reused as they are:** `createTransforms`, `createSteering`, `createTemplateBlocker`, `carveTemplate`, `findTemplateOpenings`, `findCaveRegions`, `describeCaveRegion`, `createSimplexNoise`, `makePermanent`, `TemplatePlacementError`.
- **Playground and docs:** `demo/step-defs.ts`, `demo/step-fields.ts`, `demo/steps.ts`, the retired pages, `README.md`, `CLAUDE.md`, `ROADMAP.md`, new `scripts/check-dungeon.ts`.

## Verification (every task)

- `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm test` (80% coverage).
- `npm run dev`: the new steps show up on the steps page, can be added and configured (areas included), and are visible after each step. From task 9 on, each preset's composition can be rebuilt there by hand.
- Task 14 onward: `npm run check:dungeon` before and after each dungeon task, compared with the baseline.
- `npm run check:forest` after task 1, which touches the forest's free rule: the counts should not change in size.

## Settled in planning (user)

- **Step names:** approved (`digFishbone`, `digVeins`, `digPillarHalls`, `digRings`, `placeMineRooms`, `growCave`, `carveNoiseCave`, `digCaveTunnels`, `placeMazeRooms`, `carveMaze`, `openMazeRooms`, `scatterRooms`, `partitionRooms`, `growRooms`, `carveCorridors`, `addExits`). `addNoiseCaverns` and `cullCaves` went with decisions 11 and 12.
- **Symmetry option names:** as listed under Shared rules.
- **Mine preset:** one key per layout, at most one. Two layouts in one map are two step calls.
- **Dungeon retries:** decision 5.
- **Joining foreign floor:** decision 11, built in task 20.
- **Halls and caverns:** features from their own steps, not rooms (decision 11).
- **Areas and counts:** decision 12. A random free spot to begin with, with rules per feature possibly later.
- **`demo/noise.html`** stays as a subpage. Overlay colors are mine to pick.
- **`growRooms`:** the option is `gap`, and the preset keeps the name `generateDigDungeon`.
- **Corridor-first generator:** goes in the backlog, kept only if clearly distinct.

## Open questions (for when a task reaches them)

- None at present. New ones are raised at the start of the task they belong to.
