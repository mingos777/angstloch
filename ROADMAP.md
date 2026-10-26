# Roadmap

Notes for picking the project up in a fresh session, on any computer. The rules of the code base and how we work are in `CLAUDE.md`, and the finished features are documented in `README.md`. This file holds what neither of them does: where the library stands, what is planned, the design decisions behind the plans, and what was rejected.

## Where the library stands

Implemented, documented and reviewed:

- **Mazes**: recursive backtracker, bias, loops, symmetry (whirlpool, snowflake), exits, ordinary rooms and templated rooms inside mazes.
- **Dungeons**: room-first (`generateRoomDungeon`, with `partition: 'scatter' | 'bsp'` and `connection: 'nearest' | 'bsp' | 'bsp-random'`) and the digger (`generateDigDungeon`), layout and corridor symmetry, room templates (rotations, mirroring, exits, doors).
- **Caves** (`generateCave`): cellular automaton, regions, tunnels between caverns (`connect`) with optional loops (`tunnelLoops`), exits, layout symmetry (`layoutSymmetry`, with its own chances for the noise and for tunnels).
- **Noise** (`createSimplexNoise`, `createFractalNoise`, `transformNoise`): public building blocks, no dependencies. It stays in this package; extracting it into a separate library was considered and rejected (the forest needs a default noise, and the code is small and isolated in `src/noise/`).
- **Forests** (`generateForest`): noise-driven tree density, roads with crossings and branches, exact roads from a `specs` list, `clearance`, `falloff` and `distance`, `Tile.Grass`, `Tile.Tree`, `Tile.Road`, and clearings (radii are `Range`s), with optional paths to them and clearings at the dead ends of branches (`at: 'branch-end'`).

The tile values are part of the public contract and never change: `Wall` 0, `Floor` 1, `Door` 2, `Grass` 3, `Tree` 4, `Road` 5.

The source layout and its import rule (imports only point down: `core`, then `rooms` and `noise`, then `roads`, then the generators) are in `CLAUDE.md`.

## Design decisions worth keeping

- **Forest `clearance` and `falloff` stay separate.** The first version of `clearance` thinned the tree chance gradually, and the user wanted a clear zone. So `clearance` is a hard strip, and `falloff` is a separate soft ramp beyond it.
- **Clearings are placed, never found in the density map**, so one is guaranteed. Plain discs were rejected, the user wants irregular shapes (domain warping with a flood fill). Radii are approximate, since the ragged edge varies the real size by up to about 40%. A clearing that finds no room is dropped, with no relaxing, since there is no minimum count (a minimum count would be the case for relaxing).
- **Clearings at branch ends are never dropped for overlapping.** Two that merge look natural, and several paths may lead to one glade. They take the branch ends in the order the branches were laid, and come last in the `clearings` result.
- **Exact roads (`roads.specs`) replace the generated network** rather than adding to it, and placement is best effort: geometry is clamped or cut short, and only a bad parent index and similar mistakes throw.
- **BSP corridors** are derived from room positions (a median split along the most spread axis), not from the real partition tree, so they work with every placement, templates and symmetry.

## Backlog

Roughly in the order the user wants them. Each needs a design talk before it is built.

### Caves

- **Rooms and templates inside caves**, like [rooms in mazes](#mazes-and-rooms): rectangular rooms and `RoomTemplate`s placed in the cave, joined to the caverns. The cave regions and tunnels are there to build on.
- **Noise caverns** (designed, not built): a cave made by thresholding noise (`src/noise/`) instead of running the automaton. Decisions:
  - A separate generator, `generateNoiseCave`, with its own `NoiseCaveOptions`, as the two dungeon generators are separate. Not a `mode` on `generateCave`, since the automaton and noise fields would each be dead in the other mode.
  - The second half of `generateCave` (filling small regions, `connect`, exits, region description) is extracted into a function in `cave/`, and the connection options (`minRegionSize`, `connect`, `tunnel*`, `layoutSymmetry*`, `minExits`, `maxExits`) into an interface that both option types extend. `CaveOptions` does not change for callers. Nothing moves out of `cave/`.
  - `fill` is a proportion of walls from 0 to 1 (default about 0.45), applied as a quantile: every tile is sampled and the threshold is chosen so that about that share are walls. This keeps `fill` predictable whatever the scale, octaves or custom noise. A raw `threshold` could be added later.
  - Noise options as in the forest (`scaleX`, `scaleY`, `rotation`, `octaves`, `persistence`, `lacunarity`, `noise`), with defaults suited to caves: smaller features (about 12 tiles) and 3 octaves for ragged edges. The caller stretches blobs with the scales and rotation. These defaults are a first guess, to be tuned in the playground.
  - An optional smoothing pass (`iterations`, reusing `smoothCave`), defaulting to 0 for now.
  - Layout symmetry: each tile samples the noise at its canonical twin (the lowest-index mirror image, as in `createCaveNoise`) with chance `layoutSymmetryChance`, and at its own position otherwise. The quantile is taken after that substitution.
  - `borderWalls` stays as it is: the outer ring is forced to wall.
  - Task split: (1) extract the shared half, a pure refactor; (2) `generateNoiseCave` with tests, README and public export; (3) the playground gets a cave type switch with the noise controls.
  - `shape: 'blobs' | 'veins'` (default `blobs`), part of this feature. `blobs` makes floor of the low (or high) part of the noise. `veins` makes floor of the tiles nearest the noise's midpoint, so the floor follows its zero crossings: a network of winding corridors instead of caverns. It takes the absolute value of the noise before the quantile step, so `fill` still sets the share of walls (a higher `fill` makes thinner veins). Symmetry and everything after the noise work the same for both. It overlaps with the mines idea.
  - Task 2 therefore also covers `shape`, with tests and README for both shapes, and the playground (task 3) gets a shape switch.
- **Water and lava**: needs new `Tile` values and a rule that keeps lakes from cutting the map in two. Much later.

### Forests and roads

All of this is optional follow-up to the finished forest.

- **Glades and pools**, depending on the clearing code: natural openings in the forest, such as a drained lake bed or a pond, made from the clearing shapes. Pools need a water tile (see Water and lava) and a rule that keeps them from cutting the map in two. A found-glade mode (detecting the openings that the noise already leaves) belongs here. Needs a design talk.
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

- The base generators are considered finished, and the README no longer marks any of them as work in progress. New features are added as optional fields, and existing options and results do not change.
- Reference material for ideas: the old attempt in `../angstloch-old` and rot.js 2.2.1 in `../ur/node_modules/rot-js`. Reimplement algorithms our own way, never copy code.
