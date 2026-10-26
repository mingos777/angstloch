# Roadmap

Notes for picking the project up in a fresh session, on any computer. The rules of the code base and how we work are in `CLAUDE.md`, and the finished features are documented in `README.md`. This file holds what neither of them does: where the library stands, what is planned, the design decisions behind the plans, and what was rejected.

## Where the library stands

Implemented, documented and reviewed:

- **Mazes**: recursive backtracker, bias, loops, symmetry (whirlpool, snowflake), exits, ordinary rooms and templated rooms inside mazes.
- **Dungeons**: room-first (`generateRoomDungeon`, with `partition: 'scatter' | 'bsp'` and `connection: 'nearest' | 'bsp' | 'bsp-random'`) and the digger (`generateDigDungeon`), layout and corridor symmetry, room templates (rotations, mirroring, exits, doors).
- **Caves** (`generateCave`): cellular automaton, regions, tunnels between caverns (`connect`) with optional loops (`tunnelLoops`), exits, layout symmetry (`layoutSymmetry`, with its own chances for the noise and for tunnels).
- **Noise** (`createSimplexNoise`, `createFractalNoise`, `transformNoise`): public building blocks, no dependencies. It stays in this package; extracting it into a separate library was considered and rejected (the forest needs a default noise, and the code is small and isolated in `src/noise/`).
- **Noise caves** (`generateNoiseCave`): a cave from thresholded noise, with `shape: 'blobs' | 'veins'`, `fill` as a quantile and `cornerBias`; the connection half it shares with `generateCave` lives in `src/cave/finish-cave.ts`.
- **Forests** (`generateForest`): noise-driven tree density, roads with crossings and branches, exact roads from a `specs` list, `clearance`, `falloff` and `distance`, `Tile.Grass`, `Tile.Tree`, `Tile.Road`, and clearings (radii are `Range`s), with optional paths to them and clearings at the dead ends of branches (`at: 'branch-end'`).
- **Streams and rivers** (`streams` of `generateForest`): a stream is a road made of water, laid before the roads, with shallow banks and a deep core, tributaries, springs, bridges where roads cross (generated roads are bent to cross at 75 to 90 degrees), footbridges that keep the land in one piece, `bankClearance` and `bankFalloff`, and `at: 'stream'` clearings. See Streams and rivers under the design decisions.
- **Mines** (`generateMine`): four layouts (`fishbone`, `veins`, `pillars`, `rings`), noise caverns, rooms and room templates with doors, and exits. See Mines under the design decisions.

The tile values are part of the public contract and never change: `Wall` 0, `Floor` 1, `Door` 2, `Grass` 3, `Tree` 4, `Road` 5, `ShallowWater` 6, `DeepWater` 7, `Bridge` 8.

The source layout and its import rule (imports only point down: `core`, then `rooms` and `noise`, then `roads`, then the generators, which may also use `cave/` and `maze/` as listed) are in `CLAUDE.md`.

## Design decisions worth keeping

- **Forest `clearance` and `falloff` stay separate.** The first version of `clearance` thinned the tree chance gradually, and the user wanted a clear zone. So `clearance` is a hard strip, and `falloff` is a separate soft ramp beyond it.
- **Clearings are placed, never found in the density map**, so one is guaranteed. Plain discs were rejected, the user wants irregular shapes (domain warping with a flood fill). Radii are approximate, since the ragged edge varies the real size by up to about 40%. A clearing that finds no room is dropped, with no relaxing, since there is no minimum count (a minimum count would be the case for relaxing).
- **Clearings at branch ends are never dropped for overlapping.** Two that merge look natural, and several paths may lead to one glade. They take the branch ends in the order the branches were laid, and come last in the `clearings` result.
- **Exact roads (`roads.specs`) replace the generated network** rather than adding to it, and placement is best effort: geometry is clamped or cut short, and only a bad parent index and similar mistakes throw.
- **Mines are one generator with a `layout` option**, not a mode of the digger (the digger's short-link options would be dead in a mine) and not four generators (the layouts share the carving core, widths, density, caverns, rooms and exits). Layout-specific options are marked as such in the README and ignored by the other layouts. Layouts do not mix; an array of layouts could be added later, additively. The code is in `src/mine/` and builds on `src/roads/` (centerlines, brushes), `src/noise/` and the cave exit code and noise cave generator.
  - **Shape of the code.** `carvePassage` and `tracePassage` carve and trace a winding passage of a width, between two tiles or from a tile at an angle. A layout lays the tunnels (`lay-fishbone`, `lay-veins`, `lay-pillars`, `lay-rings`), and `generateMine` then adds caverns (`lay-caverns`), rooms (`lay-rooms`) and exits. `MinePassage.kind` says what a tunnel is: `shaft`, `adit`, `vein`, `ring`, `spoke` or `tunnel`.
  - **`density`** is the target share of floor, best effort: it stops short without throwing when there is no room. The defaults are 0.15, 0.35 for `pillars` (its halls need room to show pillars) and 0.3 for `rings` (it only picks the ring count). For pillars it only sizes the halls, and the veins between them follow `hallVeins`.
  - **fishbone**: a straight main shaft (windiness 0.1, `angle` random if omitted, width 2 to 3) through a point near the middle, and adits (width 1 to 2, windiness 0.4, length 15 to 50) off random tiles of any tunnel at 45 to 90 degrees. An adit stops short of other tunnels with a wall between, so it ends in a dead end. `loops` is the chance that it breaks through instead. Things that were hard to get right: adits ignore their parent only until they pull clear of it, a dead end must touch the mine in one place only, and a shaft that winds off the map is cut to the stretch around its origin.
  - **veins**: junctions on a jittered grid (`veinSpacing`), the shortest spanning tree always dug, then extra links between near neighbors, shortest first with some shuffling, until `density`. So the web-ness is set by `density`, and `loops` is fishbone only.
  - **pillars**: a few halls (`halls`, `hallSize`, `hallRagged`, 4 tiles of rock apart, shrinking to fit when the size comes from `density`) joined by `hallVeins` veins that leave the boundary of a hall and are routed through the rock around the halls (see Next up, built, for how), which grow into a network that may end veins on veins. Pillars (`pillarSize`, `pillarSpacing`, `pillarRagged`, `pillarJitter`) stand on a lattice centered in a hall, and each needs floor all round it and never covers a vein. Loops of veins can shut in rock of any size, which is not a pillar.
  - **rings**: concentric ovals fitted to the map (`rings`, `ringWidth`, `ringWobble`), or circles with `ringShape: 'circle'`, closed loops that wobble by smooth noise, joined by at least one radial spoke per pair of rings (`spokes`). Ovals by default, so that a wide map is filled. `ringShape: 'circle'` sets both radii to the smaller one, centered, so the ends of a wide map stay rock; `density` keeps its meaning (the share of the whole map), so a circle on a very wide map may stop short of it. There is no common main shaft, since the spokes do that job.
  - **Caverns**: `caverns`, `cavernSize` and `cavernFill`, from `generateNoiseCave` keeping the largest region. Each goes at the best of 20 random places in the rock (the nearest to the mine) and never overlaps floor. It touches the mine or is joined by a short tunnel, and is left out when it finds no room.
  - **Rooms and templates**: `rooms` (as for mazes, but any size), `templates` (the shared `RoomTemplate`), `exitsPerRoom` (1 to 3) and `doorChance` (1), copied from the maze. In rock only, 2 tiles clear of the mine and of each other. An ordinary room that finds no spot or cannot be joined is left out, and a template that cannot be placed or joined throws a `TemplatePlacementError`. Every opening gets a winding tunnel to the nearest floor round any room in the way. No two openings of a room are next to each other, diagonals included. Ordinary rooms use their own spot search, since the shared template placement scan was too slow with the whole mine as one obstacle (15 seconds for ten rooms on 200 by 120); templates still use the shared code.
  - **The border**: a ring of wall always closes the map in, except for the exits. There is no `borderWalls` option.
- **Streams and rivers** (`src/streams/`, built on `src/roads/`; tasks 1/4 to 4/4, awaiting review). A river is a stream with a larger width range, one `streams` option.
  - **Tiles**: `ShallowWater` 6 ("passable at the cost of getting wet"), `DeepWater` 7 (needs swimming), `Bridge` 8. A game may read both waters as plain water. Playground glyphs: bridge `#` Yellow, shallow `≈` BrightBlue, deep `≈` Blue.
  - **Banks shallow, middle deep**: `shoreWidth` (default 1) tiles of shallow water on each side, and a deep core of `width - 2 * shoreWidth` along the centerline (a brush, not a distance from the bank, which gave deep tiles at the bends of a narrow stream). So widths 1 and 2 are all shallow and width 3 has a one-tile band.
  - **Laid before the roads** (a natural feature has priority), on a road map of its own. The water flows the way of `angle`, so `points` run upstream to mouth; tributaries (the branches of the stream, leaving against the flow at 30 to 60 degrees) are listed reversed, from source to confluence. `spring: true` grows the stream one way only.
  - **Roads cross it at 75 to 90 degrees** (`bridgeAngle`): `addRoad` takes a `reshape` hook, and `createSteerAcrossStreams` re-lays the stretch of a generated road around each place where its centerline meets a stream's as a straight line at the angle. Two 4-connected tile paths can only cross by sharing a tile, so meeting centerlines is the right test. Exact roads (`roads.specs`) and the paths to clearings are not bent. Known limit: a crossing within about 12 tiles of the end of a road leaves a rough bend there.
  - **Road wins**: road tiles over water are `Bridge`. `bridges` in the result has a point per group of bridge tiles.
  - **One bridge, or none** (`create-steer-across-streams.ts`, `find-spans.ts`): a generated road crosses a stream once, at most: stretches near a stream within 20 tiles of each other merge into one crossing, laid as a land path to a single straight crossing (found by walking out of the water from road tiles, one band of water, no longer than the widest stream plus two) and a land path on (smooth Hermite curves, `curve-tiles.ts`, with a taut BFS path, `find-land-path.ts` and `smooth-path.ts`, as the fallback; both keep 3, 2 or 1 tiles off the water). A road end in or beside water on the map's edge slides along the edge to clear ground. A road that touches a stream and leaves on the same side goes round it by a land path. As a backstop, a group of road tiles over water that does not join two different pieces of land gives way to the water, and one that does keeps its whole width. A road that has to cross two bands of water (a stream and its tributary) crosses in hops, by the piece graph (`neighbors` in `create-steer-across-streams.ts`), picking at each hop the crossing that gets nearer the land the road is going to.
  - **The land is never cut in two** (`lay-footbridges.ts`): the pieces of walkable land (roads and their bridges count as land, trees are passable) are joined nearest first by the shortest straight crossing, a one-tile footbridge along a row or a column. A spring stream needs none. `bridges` is a minimum count on top of that, spaced 8 tiles apart, never longer than the stream's width plus two, so a footbridge never runs along a stream, and never on the edge of the map.
  - **Banks and trees**: `bankClearance` and `bankFalloff` (default 0, trees often grow at the water's edge) have their own ramp, apart from `clearance` and `falloff`, sharing `distance`.
  - **Clearings on a stream**: `at: 'stream'` is centered on a random tile of any stream centerline, placed like a random clearing (spacing, inside the map), no path, water stays water.
  - **Left for later**: ponds, lakes and swamps centered on stream tiles (a stream that ends in a lake), fords, rivers in other generators.
- **BSP corridors** are derived from room positions (a median split along the most spread axis), not from the real partition tree, so they work with every placement, templates and symmetry.

## Next up

### Streams and roads: visual review and fixes

The way generated roads cross and avoid streams (`create-steer-across-streams.ts`, `find-spans.ts`, `lay-footbridges.ts`) was tuned seed by seed in the last session, by ASCII dumps and rendered images, and the user still finds artifacts. It needs a systematic pass: verify it visually over many seeds (the playground, with the road and stream switched on, and with 0 to 2 tributaries; a script that renders a grid of seeds to PNG would help), write down every artifact class, analyse each cause, then fix them together instead of one seed at a time. Known weak spots to start from:

- Roads next to a confluence, or between a stream and its tributaries, where land is cut into thin strips; the road may need two bridges, or odd detours.
- Chunky bridges where a road crosses a diagonal stretch or a junction (a width-3 road stamped along a diagonal), and diagonal crossings that look edgy.
- Roads that run beside a stream at a fixed distance, with straight stretches, and the S-bends before a crossing at 75 to 90 degrees.
- Road ends that slide along the edge of the map, so the exit moves, and ends that sit near a stream's mouth.
- Footbridges next to each other or next to a road bridge, where thin strips of land are joined (the never-cut-the-land rule wins over spacing).
- `roads.specs` roads and paths to clearings, which are not steered at all and only get the drowning backstop.
- The steering works with stream width 3 and road width 3; other widths, windiness and `bridgeAngle` have had little visual checking.

Seeds the user flagged, with the playground at 80 by 50, a stream of width 3 (windiness 0.5) and a road of width 3 (windiness 0.3), both at a random angle: 2, 4, 5, 6, 12, 18, 20, 27, 28 without tributaries, and 5, 6, 85, 88, 90 with `tributaries` 2 to 2.

### Pillar halls: a network that grows, with a detour limit

Built (tasks 1/3 to 3/3), awaiting review. It replaced two earlier versions that the playground rejected: a noisy pinned line between random tiles of two halls (veins ran middle to middle, erased pillars and overlapped), and then veins routed around the halls between planned pairs, which sometimes ran around a whole hall and half of another, since the random entrances landed on sides that could only be joined by a long way round and nothing bounded a route.

- **The network grows from a first vein** (`grow-hall-network.ts`): the nearest pair of halls is joined (the next nearest if that fails), then the hall nearest the network, with distances recomputed after each, by one vein to the nearest boundary tile of any hall or vein in the network. A vein may end on another vein (a T-junction) but never crosses one, which would make the wall-between-veins rule much harder. Every hall ends up with one vein out, so the mine is connected by construction, with no union-find and no removal of veins.
- **Extras**: `hallVeins` is the total, so the extras are `hallVeins` minus the veins above, at least 0. Each starts at a random hall and ends on the nearest hall or vein that does not leave that hall, so it makes a loop and not a stub. With no other target, or no route, the extra is left out (joining it to the hall's own vein would make no difference to a mine that is already connected). Ends within 3 tiles of an entrance or end already used are avoided where possible.
- **Entrances** (`find-hall-boundary.ts`, `pick-entrance.ts`): boundary tiles, never interior ones. `hallEntrances` is `'facing' | 'edge'`, default `'facing'`; `'any'` was removed, since it is `'facing'` that also destroys pillars and the library is unpublished. The start is picked from the band of boundary tiles about 3 deep on the side toward the nearest network tile (or the whole boundary), 10 tiles tried, the one furthest from the junctions so far kept. The end is the nearest network tile to the start. A vein's boundary is that of the floor it carved, found with `findHallBoundary`.
- **Routing** (`dig-routed-vein.ts`, `find-rock-route.ts`, `wobble-route.ts`): an A* on the grid (edge steps only, with a tiny pull toward the straight line so that equal routes do not run in an L) between the rock tiles next to the two ends. Blocked are the map border, all floor, and everything within the vein's reach plus one tile of floor (`floor(width / 2) + 1`), so a wall is always left between a vein and a hall or an earlier vein. Close to its own ends the clearance is lifted, otherwise a vein could not leave or arrive. The wobble smooths the corners and pushes the route sideways by noise, up to 3 tiles at `veinWindiness` 1, shrinking the push where it would hit a blocked tile and falling back to the plain route when anything still does.
- **Detour limit**: a route of more than `1.5 × distance + 8` steps is rejected, the distance being Manhattan between the two ends, since routes step along edges and a perfect diagonal is up to 1.41 times the straight line. The search stops early. Constants (`DETOUR_FACTOR`, `DETOUR_SLACK`), to be tuned in the playground; no option. Best-of-several routes was considered and left for later.
- **Retries**: 10 attempts per vein between other starts and a freshly picked width; with `'facing'` the first 5 keep to the facing side and the rest use any side, since two halls that meet at a corner leave one channel between them, and the vein that takes it blocks the others.
- **No hall is dropped for want of a vein**: a hall that finds no route is tried again once the others are in, then with the rules relaxed (only floor blocks, no limit, veins may run close), which squeezes through a one-tile gap, so a boxed-in hall joins what it is boxed in by. The old removal of a hall that no vein reaches stays in `layPillars` as a guard that should never be reached (its lines are the only uncovered ones).
- **Rejected**: entrance tiles that stay inside the hall's outer band (the vein then cuts into the hall); keeping `'any'` as the "old look"; falling back to the straight pinned line when there is no route (it would cross halls and each other); a planned tree between hall middles (the greedy nearest-first order replaced it).
- **Known limit**: halls only 4 tiles apart take one vein at a time through the gap, and wide veins (3) need the whole gap; a crowded map therefore gets fewer extras than `hallVeins` says.

## Backlog

Roughly in the order the user wants them. Each needs a design talk before it is built.

### Caves

- **Rooms and templates inside caves**, like rooms in mazes and mines: rectangular rooms and `RoomTemplate`s placed in the cave, joined to the caverns. The cave regions and tunnels are there to build on, and the room code of `src/mine/` could be reused. Not wanted in the near future.
- **Water and lava**: needs new `Tile` values and a rule that keeps lakes from cutting the map in two. Much later.

### Forests and roads

All of this is optional follow-up to the finished forest.

- **Glades and pools**, now that the streams exist (see Ponds, lakes and swamps; a pool in a clearing or at a stream tile was the design in mind, and found glades were to be dropped), depending on the clearing code: natural openings in the forest, such as a drained lake bed or a pond, made from the clearing shapes. Pools need a water tile (see Water and lava) and a rule that keeps them from cutting the map in two. A found-glade mode (detecting the openings that the noise already leaves) belongs here. Needs a design talk.
- **Forest connectivity and regions.** Left out on purpose until the user has seen what forests come out. If wanted, the cave's region and tunnel code would move into a shared directory, with `connect` defaulting to `'none'`, since forests are usually see-through.
- **Clearings with templates**, to put a ruin or a camp in a glade.
- **Roads in other generators**: the `src/roads/` module (`layRoads`) is meant to be reused by the village and the town. `RoadNetwork` is currently internal; export it when a generator needs it.

### Village, town and castle

- **Village or hamlet** is definitely wanted: a handful of buildings along a road or around a green, no walls. Roads from `src/roads/` and room templates for buildings are the likely ingredients.
- **Town**: streets, lots, buildings, an outer wall with gates (gates as `exits`), districts and plazas. A street grid with jitter, a radial layout and recursive subdivision of blocks into lots were considered; subdivision is the simplest.
- **Castle or fortress**: probably a variant of the town machinery (concentric walls, towers, gatehouse, keep, courtyards). Decide when designing the town.
- The tile model for buildings needs a decision before building (`Road` exists; building interiors, walls and floors may reuse `Wall` and `Floor` or get new values).

### Mines, follow-ups

Nothing is planned, and everything here is optional:

- **Symmetry** for mines was deferred; it would fit the cave's layout symmetry.
- **Cave-ins**: parts of a mine cut off by a collapse, which the always-connected rule rules out now.
- **Mixed layouts**, for example pillar halls joined by a fishbone, as an array of layouts.
- **Rooms in caves** (see Caves) could reuse the room code of the mine.

### Catacombs

Undecided. They feel like a very structured variant of the digger (rigid, often on a lattice, with niches along the walls and a few crypts from room templates), and may or may not get a generator of their own. The mine is done, so this can be designed now. The carving core and the room and cavern code of `src/mine/` may carry over.

### Ponds, lakes and swamps

Streams and rivers are done. What is left is standing water, which the stream code now allows: a pond or lake centered on a stream tile (the design already has `at: 'stream'`), possibly with the stream flowing through it or ending in it, and swamps. The earlier idea of pools in clearings (a smaller ragged oval clipped to keep a bank of ground) still fits. A pool must not cut the map in two, which `layFootbridges` already guards for streams. Fords are open. Needs a design talk.

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
