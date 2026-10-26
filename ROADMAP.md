# Roadmap

Notes for picking the project up in a fresh session, on any computer. The rules of the code base and how we work are in `CLAUDE.md`, and the finished features are documented in `README.md`. This file holds what neither of them does: where the library stands, what is planned, the design decisions behind the plans, and what was rejected.

## Where the library stands

Implemented, documented and reviewed:

- **Mazes**: recursive backtracker, bias, loops, symmetry (whirlpool, snowflake), exits, ordinary rooms and templated rooms inside mazes.
- **Dungeons**: room-first (`generateRoomDungeon`, with `partition: 'scatter' | 'bsp'`) and the digger (`generateDigDungeon`), layout and corridor symmetry, room templates (rotations, mirroring, exits, doors).
- **Caves** (`generateCave`): cellular automaton, regions, tunnels between caverns (`connect`) with optional loops (`tunnelLoops`), exits.
- **Noise** (`createSimplexNoise`, `createFractalNoise`, `transformNoise`): public building blocks, no dependencies. It stays in this package; extracting it into a separate library was considered and rejected (the forest needs a default noise, and the code is small and isolated in `src/noise/`).
- **Forests** (`generateForest`): noise-driven tree density, roads with crossings and branches, `clearance`, `Tile.Grass`, `Tile.Tree`, `Tile.Road`.

The tile values are part of the public contract and never change: `Wall` 0, `Floor` 1, `Door` 2, `Grass` 3, `Tree` 4, `Road` 5.

The source layout and its import rule (imports only point down: `core`, then `rooms` and `noise`, then `roads`, then the generators) are in `CLAUDE.md`.

## Next up

### BSP corridors

`partition: 'bsp'` already places rooms by binary space partitioning, but rooms are then joined shortest link first, as a tree (`connectAll` in `src/dungeon/dungeon-builder.ts`). The classic BSP dungeon joins the two halves of every cut instead. Design agreed, not implemented yet:

- A new option on `RoomDungeonOptions`, `connection: 'nearest' | 'bsp'`, default `'nearest'` (today's behavior). The digger does not join pre-placed rooms, so it does not get the option.
- With `'bsp'`, the rooms are split in two by a vertical or horizontal cut, recursively, and every cut gets one corridor, joining the closest pair of rooms across it. Cuts are processed from the smallest groups up, so rooms join into small clusters first and the clusters are then joined. The result is a tree, like today.
- The cuts are derived from room positions, not from the real partition tree: each group of rooms is split along the axis where the room centers are most spread out, at the median. The outcome is the same as using the real tree, it needs no change to the partition code, and it works with every placement, templates and symmetry.
- Across a cut, the closest pair of rooms is tried first. If that corridor is blocked, the next-closest pair is tried, and if every pair is blocked, the existing recovery for stranded rooms applies. A random pair across the cut (as in the textbook algorithm) could be a later variant. Loops, dead ends and exits per room are unchanged and come after the tree.
- Symmetry: the builder already mirrors every link, so only the order in which pairs are tried changes. Verify with a symmetric test.
- Task split: 1) a pure function that turns a list of rooms into the ordered cuts (groups of candidate pairs per cut), with tests; 2) the option, wired into `connectAll`, with fallback and symmetry tests; 3) README (the Connections section) and the dungeon playground (a Connection select for the room-first generator).
- Progress: task 1 is done. `planBspLinks(rooms)` in `src/dungeon/plan-bsp-links.ts` returns the groups of candidate links per cut (children first, closest pair first, the room of the first half as `a`), `RoomLink` is in `room-link.ts`, and `distanceBetween` moved out of the builder into `distance-between.ts`. Task 2 is done: `RoomDungeonOptions.connection` (`RoomConnection`, validated by `assert-connection.ts`) is passed to the builder, and `connectAll` first builds one corridor per BSP cut (the first link of a cut that can be built, skipping cuts whose sides are joined already) and then runs the usual nearest-first pass as the fallback. Note that corridors may cross, so a tree-shaped dungeon can still have a cycle from a crossing, and rooms asking for more exits than 1 add links, so default dungeons have cycles whatever the connection. Task 3 is done too: the README's Connections section, the `connection` option tables and the playground's Connection select. The feature is complete. A fourth step was added at the user's request: `connection: 'bsp-random'` joins a random room on each side of a cut (the textbook algorithm), via an optional `random` argument of `planBspLinks` and the new `shuffle` helper in `core/`.

## Backlog

Roughly in the order the user wants them. Each needs a design talk before it is built.

### Caves

- **Rooms and templates inside caves**, like [rooms in mazes](#mazes-and-rooms): rectangular rooms and `RoomTemplate`s placed in the cave, joined to the caverns. The cave regions and tunnels are there to build on.
- **Symmetric caves.** Roguelikes like an unnatural look. Reuse the layout symmetry of dungeons (`horizontal`, `vertical`, `both`, `rotational`).
- **Noise caverns**: a cave made by thresholding noise (`src/noise/`) instead of running the automaton. Connectivity, regions and exits from the cave generator should carry over, and may have to move into a shared directory.
- **Water and lava**: needs new `Tile` values and a rule that keeps lakes from cutting the map in two. Much later.

### Forests and roads

All of this is optional follow-up to the finished forest.

- **A soft falloff beside roads.** `clearance` is a hard strip with no trees. A separate option could thin the trees out beyond it. (The first version of `clearance` thinned the chance gradually, and the user wanted a clear zone, so keep the two apart.)
- **Dead-end paths that end in a small clearing**, a natural place for a camp or a hut. Branches already end in the forest when `branchLength` is short.
- **A caller-supplied list of road specs** (angle, width, windiness per road) for callers who want exact control.
- **Forest connectivity and regions.** Left out on purpose until the user has seen what forests come out. If wanted, the cave's region and tunnel code would move into a shared directory, with `connect` defaulting to `'none'`, since forests are usually see-through.
- **Clearings with templates**, to put a ruin or a camp in a glade.
- **Roads in other generators**: the `src/roads/` module (`layRoads`) is meant to be reused by the village and the town. `RoadNetwork` is currently internal; export it when a generator needs it.

### Village, town and castle

- **Village or hamlet** is definitely wanted: a handful of buildings along a road or around a green, no walls. Roads from `src/roads/` and room templates for buildings are the likely ingredients.
- **Town**: streets, lots, buildings, an outer wall with gates (gates as `exits`), districts and plazas. A street grid with jitter, a radial layout and recursive subdivision of blocks into lots were considered; subdivision is the simplest.
- **Castle or fortress**: probably a variant of the town machinery (concentric walls, towers, gatehouse, keep, courtyards). Decide when designing the town.
- The tile model for buildings needs a decision before building (`Road` exists; building interiors, walls and floors may reuse `Wall` and `Floor` or get new values).

### Mines and catacombs

The user loves this one. A first idea: long straight shafts with side branches and the occasional chamber, between a maze and the digger. It may be a mode of the digger and not a separate generator.

### Lakes and rivers

A river is a winding centerline like a road, so it can share the code in `src/roads/` (`growCenterline`). It needs a water tile and a way to cross it (bridges, fords) where it meets a road.

### Mazes and rooms

The first iteration of rooms inside mazes is done. Still open, from earlier sessions: mazes inside dungeon rooms, cellular automata inside rooms, and a shared "region" abstraction that several generators could use.

## Rejected

- **Multi-level dungeons.** The game generates the individual levels and joins them.
- **Wilderness or overworld.** Usually a single level, and games often make it by hand, so it is not worth a generator here.
- **A separate noise package.** See above.
- **Cellular automata for forests.** Noise gives broad woods and glades, and a cellular automaton cannot.

## Loose ends

- The README marks `generateCave`, `generateForest`, `generateRoomDungeon` and `generateDigDungeon` as _Work in progress_. Drop the tags when the user says a generator is done.
- Reference material for ideas: the old attempt in `../angstloch-old` and rot.js 2.2.1 in `../ur/node_modules/rot-js`. Reimplement algorithms our own way, never copy code.
