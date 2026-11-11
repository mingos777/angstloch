# Angstloch documentation

For installing Angstloch and a first map, see the [README](../README.md).

- [Concepts](concepts.md): the grid and its tiles, options, randomness and seeds, ranges, attempts and failures.
- [Composing maps](composing.md): `pipeline`, `step`, `emptyMap`, `MapState`, the steps at a glance, verges and areas.
- [Rooms](rooms.md): `Room`, `RoomGroup`, `Exit` and `createRoomMap`, what the room and feature steps report.
- [Room templates](room-templates.md): rooms of your own design, placed as they are.
- [Noise](noise.md): simplex and fractal noise, for terrain-like maps.
- [Walking distances](distances.md): `measureDistances` and `measureRoomDistances`, the walk between places of a finished map.
- [Playground](playground.md): try the generators and steps on screen and copy the code.
- [Development](development.md): working on Angstloch itself.

## Generators

Each generator is a ready-made composition of steps.

- [Mazes](generators/maze.md): `generateMaze`, perfect and braid mazes, with rooms and templates.
- [Caves](generators/cave.md): `generateCave`, from a cellular automaton, and `generateNoiseCave`, from noise.
- [Forests](generators/forest.md): `generateForest`, trees, clearings, roads, streams and rivers.
- [Mines](generators/mine.md): `generateMine`, in four layouts, with caverns and rooms.
- [Dungeons](generators/dungeon.md): `generateRoomDungeon`, room-first, and `generateDigDungeon`, grown out of a first room.

## Steps

The steps that make the maps, grouped by the map they were made for, though any of them may go in any [pipeline](composing.md#pipeline).

Forests:

- [`plantTrees`](steps/plant-trees.md): plants trees by noise on the base tile.
- [`layStreams`](steps/lay-streams.md): lays streams and rivers, with banks and tributaries.
- [`layRoads`](steps/lay-roads.md): lays roads, with crossings, branches and bridges over streams.
- [`placeClearings`](steps/place-clearings.md): clears ragged glades.
- [`placeTemplates`](steps/place-templates.md): stamps templates in clearings or on free spots.
- [`layClearingPaths`](steps/lay-clearing-paths.md): lays paths from the roads to the clearings that ask for one.
- [`layFootbridges`](steps/lay-footbridges.md): joins the land that streams cut apart.

Mines:

- [`digFishbone`](steps/dig-fishbone.md): a main shaft with adits off it.
- [`digVeins`](steps/dig-veins.md): veins that join every piece of floor, and a web of their own.
- [`digPillarHalls`](steps/dig-pillar-halls.md): halls with pillars.
- [`digRings`](steps/dig-rings.md): rings joined by spokes.
- [`placeMineRooms`](steps/place-mine-rooms.md): rooms in the rock, each joined to the nearest floor by a tunnel.

Caves:

- [`digCellularCave`](steps/dig-cellular-cave.md): a cave from a cellular automaton.
- [`digNoiseCave`](steps/dig-noise-cave.md): a cave from thresholded noise.

Mazes:

- [`placeMazeRooms`](steps/place-maze-rooms.md): rooms on the maze lattice, not opened yet.
- [`digMaze`](steps/dig-maze.md): a maze by the recursive backtracker, round whatever is there.
- [`openMazeRooms`](steps/open-maze-rooms.md): opens the maze rooms into the maze.

Dungeons:

- [`placeScatteredRooms`](steps/place-scattered-rooms.md): dungeon rooms at random spots.
- [`placePartitionedRooms`](steps/place-partitioned-rooms.md): one dungeon room per area of a binary space partition.
- [`placeClusteredRooms`](steps/place-clustered-rooms.md): dungeon rooms grown off each other, clustered.
- [`placeCellBlocks`](steps/place-cell-blocks.md): cell blocks of a prison, entered at one end.
- [`digSewers`](steps/dig-sewers.md): a sewer: a trunk canal and branches, with walkways, bridges and cisterns.
- [`digCatacombs`](steps/dig-catacombs.md): a catacomb: a lattice of galleries lined with niches and burial chambers, with crypts.
- [`digCorridors`](steps/dig-corridors.md): joins the rooms, and every other piece of floor, by corridors.

Any map:

- [`openExits`](steps/open-exits.md): carves exits into the border, or opens the outfalls of sewers.
