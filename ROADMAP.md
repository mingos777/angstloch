# Roadmap

What is wanted next, roughly in the user's order, and what was rejected. Finished features are documented in `README.md`, the rules of the code base and how we work in `CLAUDE.md`, and designs in progress in `designs/`, one file per feature.

## Next up

Walking distances, below; the sewers, also needed by the user's own game, come next under More generators, and the parallel adits of the fishbone are wanted under Mines, follow-ups.

### Walking distances

Functions the game calls on a finished map to measure the walk between rooms or other places, for putting the stairs far apart. Being designed in `designs/walking-distances.md`.

## Backlog

Roughly in the order the user wants them. Each needs a design talk before it is built.

### Caves

- **Rooms and templates inside caves** are a composition now: `digCellularCave` or `digNoiseCave` in an area, a room placement step, then `digVeins` (which enters the rooms) or `digCorridors` (which joins the cave as a stand-in). A preset key for it on `generateCave` is not wanted yet.
- **Overlap as a share**: `placement: 'overlap'` of the cave steps may become a fraction or a `Range` of a cave's tiles that may overlap other things (default 0 to 0), still never over reserved tiles.
- **Water and lava**: needs new `Tile` values and a rule that keeps lakes from cutting the map in two. Much later.

### Forests and roads

All of this is optional follow-up to the finished forest.

- **Glades and pools**, now that the streams exist (see Ponds, lakes and swamps; a pool in a clearing or at a stream tile was the design in mind, and found glades were to be dropped), depending on the clearing code: natural openings in the forest, such as a drained lake bed or a pond, made from the clearing shapes. Pools need a water tile (see Water and lava) and a rule that keeps them from cutting the map in two. A found-glade mode (detecting the openings that the noise already leaves) belongs here. Needs a design talk.
- **Forest connectivity and regions.** Left out on purpose until the user has seen what forests come out. If wanted, the cave's region and tunnel code would move into a shared directory, with `connect` defaulting to `'none'`, since forests are usually see-through.
- **To check: tributaries that overlap the main stream.** The user saw a tributary run over the main stream and make a loop, after the move to steps. It is thought to predate the pipeline (not checked), so it likely sits in how `buildStreams` places and grows tributaries (`src/streams/build-streams.ts`). Not wanted, though not a big issue; the user would rather tributaries never did that. Whether it can also happen between two tributaries is unchecked. Not for the session it was reported in; it needs a look and a design talk first.
- **Areas for the forest steps** (`plantTrees`, `layStreams`, `layRoads`, `placeClearings`, `placeTemplates`), as the underground feature steps have.
- **Rivers in other generators.**
- **Templates and roads**: a "road connection" cell that joins a road to a template; routing roads and streams round a template (today a template is placed after them, on a spot clear of roads and water).
- **Templates in other places**: in other generators' clearings, and in caves.
- **Roads in other generators**: the `src/roads/` module (`buildRoads`) is meant to be reused by the village and the town. `RoadNetwork` is currently internal; export it when a generator needs it.

### Village, town and castle

- **Village or hamlet** is definitely wanted: a handful of buildings along a road or around a green, no walls. Roads from `src/roads/` and room templates for buildings are the likely ingredients.
- **Town**: streets, lots, buildings, an outer wall with gates (gates as `exits`), districts and plazas. A street grid with jitter, a radial layout and recursive subdivision of blocks into lots were considered; subdivision is the simplest.
- **Castle or fortress**: probably a variant of the town machinery (concentric walls, towers, gatehouse, keep, courtyards). Decide when designing the town.
- The tile model for buildings needs a decision before building (`Road` exists; building interiors, walls and floors may reuse `Wall` and `Floor` or get new values).

### Mines, follow-ups

The first entry is wanted; the rest are optional:

- **Roughly parallel adits in the fishbone.** The user wants the adits of `digFishbone` (and of the fishbone layout of `generateMine`) to run roughly parallel to each other, instead of leaving their tunnels at independent random angles as they do now. Needs a design talk.
- **Symmetry** for mines was deferred; it would fit the cave's layout symmetry.
- **Cave-ins**: parts of a mine cut off by a collapse, which the always-connected rule rules out now.
- **Mixed layouts**, for example pillar halls joined by a fishbone: two layout steps, each in an area of its own, then `digVeins`, in a pipeline of your own. The preset takes one layout only, and no array of layouts is planned.

### More generators

Wanted, not designed yet. Each needs a design talk. Prison and sewers are needed by the user's own game, so they come first.

- **Prison**: became the `placeCellBlocks` step, see Cell blocks under Next up.
- **Sewers**: a `digSewers` step, being designed in `designs/sewers.md`.
- **Graveyard**: grave plots on a lattice, paths from `src/roads/`, a fence or wall, crypts and chapels from room templates, trees from the forest noise.
- **Ruins**: a decayed dungeon, town or building. Whether it is a generator of its own or an option on the existing ones is open (see the open questions below).
- **Farmland or countryside**: a patchwork of fields split by hedges and lanes, with farmhouses from templates. The natural surround of the village.
- **Mountains, ravines and canyons**: noise ridges and cliffs with passes and trails. Needs a cliff or rock tile.
- **Shore and beach**: an area spanning the entire side of the map covered with water, with an optional beach strand. Could give rise to generators like piers or ports.

Decisions:

- **New terrain tiles are decided when a generator needs them**, not in one batch up front. Add new values, never renumber.
- **Analysis helpers** (distance maps, farthest tile, dead ends, connectivity checks), should they ever be written, stay private, inside `src/`, and are not exported from `src/index.ts`.

Open questions:

- **Ruins**: a "post-processor" would be a function or option that takes a finished map and changes it, such as breaking gaps in the walls with noise and scattering rubble or trees, instead of generating one from scratch. It would break the rule that results are composed by the caller, so the user is unsure about it. The alternative is a `ruined` option (with a decay amount) on the generators that make buildings.

### Cell blocks, follow-ups

`placeCellBlocks` is done and documented in the README. Optional follow-ups:

- **A T-shaped block corridor**, with cells along three sides.
- **Extra entrances**: an option for more than one entrance per block (default 1).
- **Keeping the approach clear.** Nothing keeps a later step off the two tiles beyond a block's entrance. A later hall that reaches them is handled (`joinTouchingPieces` opens the entrance), but a later room whose wall lands there cuts the block off and the map is retried: with 1 to 2 blocks, `digPillarHalls`, `placeScatteredRooms` and `digCorridors` on 80 by 50, about one map in four is retried and 1 in 200 fails (5 in 200 with guard rooms the blocks are entered through); without the hall, one in ten and none. A fix needs a new kind of reservation (no step builds there, a joining step may dig), a change to `Reserve`.

### Dungeons, follow-ups

- **Known limits** worth fixing: rooms for a maze in a smaller area cannot be made to land in that maze's area (two steps pick their spots on their own); a room whose wall touches a feature directly cannot open straight into it, since a corridor needs a free tile between; a mine of rings fills the map, so `'beside'` caverns fail on most such maps unless `count.min` is 0.
- **Veins**: best of several routes per vein; halls only 4 tiles apart take one vein at a time through the gap, and wide veins (3) need the whole gap, so a crowded map gets fewer extras.
- **Corridor-first dungeon**: tunnels laid first (straight, lattice-friendly), rooms sprouted off them where they fit, with doors, and dead ends where none fit. It is kept only if it makes dungeons clearly distinct from `placeScatteredRooms`, `placePartitionedRooms` and `placeClusteredRooms` with `digCorridors`, and from a mine with rooms; otherwise it is dropped. Needs a design talk.

### Catacombs

Undecided. They feel like a very structured dungeon, something like `placeClusteredRooms` and `digCorridors` made rigid (often on a lattice, with niches along the walls and a few crypts from room templates), and may or may not get a generator of their own. The mine is done, so this can be designed now. The carving core and the room and cavern code of `src/mine/` may carry over.

### Ponds, lakes and swamps

Streams and rivers are done. What is left is standing water, which the stream code now allows: a pond or lake centered on a stream tile (the design already has `at: 'stream'`), possibly with the stream flowing through it or ending in it, and swamps. The earlier idea of pools in clearings (a smaller ragged oval clipped to keep a bank of ground) still fits. A pool must not cut the map in two, which `buildFootbridges` already guards for streams. Fords are open. Needs a design talk.

### Mazes and rooms

The first iteration of rooms inside mazes is done. Still open, from earlier sessions: mazes inside dungeon rooms, cellular automata inside rooms, and a shared "region" abstraction that several generators could use.

## Rejected

- **Multi-level dungeons.** The game generates the individual levels and joins them.
- **Wilderness or overworld.** Usually a single level, and games often make it by hand, so it is not worth a generator here.
- **A separate noise package.** The forest needs a default noise, and the code is small and isolated in `src/noise/`.
- **Cellular automata for forests.** Noise gives broad woods and glades, and a cellular automaton cannot.
