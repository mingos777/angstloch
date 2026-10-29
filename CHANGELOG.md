# Changelog

All notable changes to Angstloch are listed here, newest first. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the version numbers follow [Semantic Versioning](https://semver.org/).

## Unreleased

### Added

Initial release. The README documents everything below in full.

- **Generators** (each a preset made of public steps): `generateMaze`, `generateRoomDungeon`, `generateDigDungeon`, `generateCave`, `generateNoiseCave`, `generateMine` (four layouts: fishbone, veins, pillars and rings) and `generateForest` (with roads, streams, clearings, paths and footbridges).
- **Composable steps**: `emptyMap`, `step` and `pipeline` build a map from named steps, with ordering checks, retries and a `reserved` mask. The steps are `placeScatteredRooms`, `placePartitionedRooms`, `placeClusteredRooms`, `placeMazeRooms`, `placeMineRooms`, `placeClearings`, `placeTemplates`, `digCorridors`, `digMaze`, `digCellularCave`, `digNoiseCave`, `digFishbone`, `digVeins`, `digPillarHalls`, `digRings`, `layStreams`, `layRoads`, `layClearingPaths`, `layFootbridges`, `openExits`, `openMazeRooms` and `plantTrees`.
- **Room kinds**: every `Room` has a `kind` (`RoomKind`), `'room'` for the rooms of every room placement step, `'cell'` for the cells of a cell block and `'guardRoom'` for its guard room.
- **Cell blocks**: `placeCellBlocks`, a step that places the cell blocks of a prison, rows of identical cells along a corridor, entered at one end. Its cells are rooms that point to their block in the new `roomGroups` extra with `Room.group` (`RoomGroup`, `CellBlockGroup`). `digCorridors` joins a block through its entrance: a wall reserved `Openable` outside every room is a potential exit of a feature, which gets a door by `doorChance` and is opened through `openReserved`. With `guardRoom` (`GuardRoomOptions`), a block gets a guard room beside a tunnel that leads from the end of its corridor to the entrance, and its group a `tunnel`. `digCorridors` and `digVeins` open an `Openable` wall that has the floor of two different pieces on opposite sides, such as a block entrance that a later hall reaches, with no corridor or vein.
- **Room templates** for dungeons, mazes, mines and forests, with rotation and mirroring.
- **Exits** carved into the map border for mazes, caves and mines.
- **Symmetry** for caves and dungeons, and **areas** that confine a feature to part of the map.
- **Determinism**: every generator takes an injected `Random`, so a seed gives the same map.
- **Walking distances**: `measureDistances` measures the walk between places of a finished map, with the `manhattan`, `chebyshev` and `euclidean` metrics and a cost factor per tile.
- **Data model**: `Grid` and `Tile` (`Wall`, `Floor`, `Door`, `Grass`, `Tree`, `Road`, `ShallowWater`, `DeepWater`, `Bridge`) with plain `{ x, y }` points.
- Zero runtime dependencies, ESM only, tree-shakable.
