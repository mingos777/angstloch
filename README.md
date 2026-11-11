# angstloch

A suite of map generators for roguelike games, on a 2D square grid. Written in TypeScript, ESM only, with no runtime dependencies. The generators use no DOM or Node APIs, so they run in a browser, Node or a web worker.

Currently available:

- [`generateMaze`](docs/generators/maze.md): perfect and braid mazes.
- [`generateCave`](docs/generators/cave.md): organic caves, grown with a cellular automaton.
- [`generateNoiseCave`](docs/generators/cave.md#noise-caves): caves cut out of noise, as rounded caverns or winding corridors.
- [`createSimplexNoise`](docs/noise.md): smooth 2D noise that can be stretched and turned, for terrain-like maps. Forests are built on it.
- [`generateForest`](docs/generators/forest.md): forests of scattered trees with clearings and denser stands, from noise, with roads, crossroads and paths through them, and streams and rivers that the roads bridge.
- [`generateMine`](docs/generators/mine.md): mines, as a main shaft with side tunnels branching off it, a web of winding veins, halls with pillars left standing, or concentric rings, dug until the map is as full as you want.
- [`generateRoomDungeon`](docs/generators/dungeon.md): room-first dungeons: rooms are placed first and joined by corridors afterwards.
- [`generateDigDungeon`](docs/generators/dungeon.md#grown-dungeons): dungeons that grow out of a first room: each room is built beyond a wall of one there is, and corridors join them.
- [`pipeline`](docs/composing.md): builds a map from an empty base and a list of steps, with retries. Every generator above is a preset of these steps, and steps of different generators mix in one map.
- [`placeCellBlocks`](docs/steps/place-cell-blocks.md): the cell blocks of a prison, rows of cells along a corridor, for a dungeon of your own.
- [`digSewers`](docs/steps/dig-sewers.md): sewers, a trunk canal with branches at right angles, chambers and cisterns where they meet, walkways along the water and bridges over it.
- [`digCatacombs`](docs/steps/dig-catacombs.md): catacombs, a lattice of straight galleries crossing at right angles, main and side, with loops, few dead ends, burial niches and burial chambers along the walls, and crypts from room templates.
- [`measureDistances`](docs/distances.md): the walk between rooms or any other places of a finished map, for putting the stairs far apart.
- [`measureRoomDistances`](docs/distances.md#measureroomdistances): the walk between every two rooms of a finished map, halls, caverns and sewers included.
- [`createRoomMap`](docs/rooms.md#createroommap): the room each tile of a finished map belongs to, halls, caverns and sewers included.

## Installation

```
npm install angstloch
```

Angstloch is an ES module with its own type declarations, so it works out of the box with TypeScript and with any bundler (Vite, webpack, esbuild) or plain `import` in Node.

## Quick start

Every generator takes an options object and returns a result with the map in `grid`:

```ts
import { Tile, generateRoomDungeon } from 'angstloch';

const { grid, rooms } = generateRoomDungeon({ width: 60, height: 30 });

console.log(grid.toString()); // the map as text, one line per row
console.log(`${rooms.length} rooms`);

// draw it your way, tile by tile
for (let y = 0; y < grid.height; ++y) {
  for (let x = 0; x < grid.width; ++x) {
    if (grid.get(x, y) === Tile.Door) {
      // put a door here
    }
  }
}
```

To get the same map every time, pass a seedable random function. Angstloch ships no PRNG of its own, so bring any you like. This small one, mulberry32, is what the examples in the documentation use:

```ts
import { generateMaze } from 'angstloch';

function mulberry32(seed: number): () => number {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const { grid } = generateMaze({
  width: 41,
  height: 21,
  random: mulberry32(42),
});
```

The generators are ready-made compositions of steps. To mix steps of different generators, build the map with [`pipeline`](docs/composing.md) instead, for example rooms round a cave joined by veins:

```ts
import {
  Tile,
  digCellularCave,
  digVeins,
  emptyMap,
  pipeline,
  placeScatteredRooms,
} from 'angstloch';

const { grid, rooms } = pipeline(
  emptyMap({ width: 70, height: 40, tile: Tile.Wall }),
  [
    digCellularCave({
      area: { width: { min: 24, max: 24 }, height: { min: 16, max: 16 } },
    }),
    placeScatteredRooms({ roomCount: { min: 4, max: 6 } }),
    digVeins(),
  ],
  { random: mulberry32(7) },
);
```

## Documentation

The [documentation](docs/README.md) describes every generator and step with its options, defaults and results, and how to compose maps of your own. The [playground](docs/playground.md) shows them all on screen.

## Why “Angstloch”?

_Angstloch_ is German for “fear hole”, and the name is not a random word. In medieval castles it was the hatch leading to a dark pit at the bottom of the keep (the _Bergfried_) or the main tower. The pit served as a secure store and, during a siege, as a last place of refuge - and in some cases, a dungeon. A fitting name for a library that digs dungeons.

## License

BSD-3-Clause
