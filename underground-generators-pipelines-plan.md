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
    - **Copies:** each copy of `count` gets its own spot. A `count` above 1 with the area as big as the map is a `RangeError`.
    - **How a step builds it:** it builds the feature on a scratch map the size of the box, made from a copy of the box's contents, then copies it back. It shifts its own extras by the offset. A generic wrapper was rejected, since it cannot shift arbitrary extras.
    - **Which steps get it in this plan:** every feature-making step: `growCave`, `carveNoiseCave`, the four mine layouts, `carveMaze`, `placeMazeRooms`, `scatterRooms`, `partitionRooms`, `growRooms`. Steps that join or open what is there (`digCaveTunnels`, `carveCorridors`, `openMazeRooms`, `placeMineRooms`, `addExits`) work on the whole map. Forest steps get it later (backlog).

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
  - It sits right under `pipeline/` and uses only `core/` and `pipeline/`, because maze, cave and mine all need it and the maze may not import `cave/`.
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

- **Task 1/21: the reserved mask.**
  - **Code:** `MapState.reserved`, `Reserve`, `emptyMap`, `reserveTile`, `openReserved`, `isFree`; the forest's `placeTemplates`, `placeClearings` and the paths use `isFree`, and `placeTemplates` reserves its cells; `index.ts` exports.
  - **Tests:**
    - the mask starts empty;
    - `reserveTile` sets each kind;
    - `openReserved` turns the tile and the `Openable` tiles around it `Solid`, and leaves `None` alone;
    - `isFree` combines the three rules;
    - a forest template's cells are reserved.
  - **README:** `MapState`, `Reserve` and the free rule.
  - **Playground:** a "show reserved" overlay on the steps page, drawn from the snapshot, with `Solid` and `Openable` in two colors picked from `Color` (the user does not mind which).
- **Task 2/21: `addExits`.**
  - **Code:** `src/exits/add-exits.ts` plus its options file; `carveCaveExit` moves to `src/exits/` with a `lattice` flag and a reserved check. `generateCave` and `generateMine` import it from the new place for now.
  - **Tests:**
    - count and misses;
    - lattice coordinates;
    - symmetric twins;
    - no tunnel through a reserved tile;
    - an `exits` extra is appended to.
  - **Docs:** CLAUDE.md layout gains `exits/`.
  - **Playground:** `addExits` in the list, with a Wall base.
- **Task 3/21: areas.**
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

- **Task 4/21: `digFishbone` and `digVeins`.**
  - Options are today's fishbone and veins fields plus `density`, `area` and `count`. `density` is a share of the area. Layout options are no longer marked "fishbone only" or "veins only", since each step has its own. `assertMineOptions` splits per step.
  - **Tests:**
    - density reached;
    - border ring kept;
    - one connected piece;
    - `passages` appended and shifted by the area's offset;
    - lanes continue from an existing `passages`;
    - two copies in two areas.
- **Task 5/21: `digPillarHalls` and `digRings`.**
  - Both take `area` and `count`. A pillar hall on its own is `digPillarHalls` with `halls: 1` in a small area. `halls` boxes are shifted by the offset.
  - **Tests:** today's pillar and ring assertions, ported, plus one hall in an area.
- **Task 6/21: `placeMineRooms`.**
  - Rooms already use shapes (`createOrdinaryRoom`), so this is where the shared `roomShapes` type and `createRoomShape` move into `src/rooms/`.
  - Rooms reserve from their shapes (`Solid` and `Openable`), add or append `roomShapes`, and call `openReserved` for every opening. The step leaves reserved tiles alone.
  - A template that cannot be joined throws the ordinary `TemplatePlacementError`, which the pipeline retries.
  - **Tests:**
    - rooms on a mine;
    - rooms on a map with hand-made floor, to show that any floor works, not only a mine;
    - the reserved mask is set (walls `Solid`, potential exits `Openable`, opened exits and their neighbors `Solid`) and respected.

### Cave

- **Task 7/21: `growCave` and `carveNoiseCave`.**
  - **Options:** each has its own generator options, `borderWalls` (at the edge of its area), `symmetry`, `symmetryChance`, `minRegionSize`, `largestOnly`, `area` and `count`. Each adds or appends `caverns`.
  - **Tests:**
    - today's noise, smoothing, symmetry and culling assertions, ported;
    - a cavern in an area keeps its largest piece and leaves the rest of the map alone.
- **Task 8/21: `digCaveTunnels`.**
  - Options: `style`, `width`, `windiness`, `loops`, `borderWalls`, `symmetry`, `symmetryChance`.
  - It joins every floor region of the map, whatever made it, so it also joins a mine to its caverns.
  - The brush skips reserved tiles, and a tunnel that would need one is left out. Floor inside a room's footprint is not a region it joins; joining rooms is `carveCorridors`' job, or task 20's.
  - **Tests:**
    - the tunnel, loop and twin assertions, ported;
    - a mine and two caverns joined into one piece.
- **Task 9/21: `generateCave` and `generateNoiseCave` as presets.**
  - **Options:** nested (`cave` or `noise`, `tunnels`, `exits`). The old one-key-many-meanings `connect` goes, since a step present or absent says it.
  - **Result:** `regions` is computed after the pipeline.
  - **Docs:** rewrite the README caves section.
  - **Playground:** retire `demo/cave.html` and `demo/cave.ts`.

### Mine preset (needs the cave steps)

- **Task 10/21: `generateMine` as a preset.**
  - **Options:** nested.
    - One key per layout step (`fishbone`, `veins`, `pillars`, `rings`). At most one may be given; none means `fishbone` with defaults, and more than one throws a `RangeError`.
    - The other keys are `caverns`, `rooms` (with `templates`, `exitsPerRoom` and `doorChance` inside it) and `exits`.
  - **Caverns** become `carveNoiseCave` with `area` from `cavernSize`, `count` from `caverns`, `fill` from `cavernFill` and `largestOnly`, followed by `digCaveTunnels` with the vein width and windiness.
    - A cavern now goes on a random free spot instead of the one nearest the mine, so its tunnel can be longer. The README says so.
    - Nearest-the-floor placement is a possible later rule of decision 12.
  - **Two layouts in one map** are two step calls in a pipeline of your own, never two keys of the preset. The README says so.
  - **Code:** delete `build-mine.ts`, `lay-caverns.ts` and the mine's `retryPlacement`.
  - **Docs:** rewrite the README mines section: options, defaults, result, examples.
  - **Playground:** retire `demo/mine.html` and `demo/mine.ts`, and keep `GLYPHS` and the README colors in sync.

### Maze

- **Task 11/21: `placeMazeRooms`.**
  - **Code:** wraps `prepareMazeRooms`, without `reachExits`.
    - Options: `rooms`, `templates`, `doorChance` (doors of templates), `keepClear?: Point` (which the preset fills with `start` so rooms avoid it) and `area`.
    - Ordinary rooms get their shape from `createRoomShape`. It reserves from the shapes and adds `rooms` and `roomShapes`.
  - **Known limit:** rooms for a maze in a smaller area must land in that maze's area. Two steps pick their spots independently, so rooms in a sub-area maze wait for a rule that pins an area to a position (later).
  - **Tests:** today's room and template placement assertions, ported, plus the reserved mask: the whole ring is `Openable`, and the lattice is filtered only when openings are listed.
- **Task 12/21: `carveMaze` and `openMazeRooms`.**
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
- **Task 13/21: `generateMaze` as a preset.**
  - **Options:** nested (`rooms`, `maze`, `openings`, `exits`).
  - **Docs:** rewrite the README mazes section.
  - **Playground:** retire the maze page (`demo/index.html` and `demo/main.ts` become the index that links to the steps page and the noise page).

### Dungeon (the hardest)

- **Task 14/21: measure today's dungeons** (decisions 5 and 8).
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
