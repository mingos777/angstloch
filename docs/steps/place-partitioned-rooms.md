# `placePartitionedRooms`

`placePartitionedRooms(options?)` is a step that places the rooms of a dungeon by binary space partitioning, the first step of [`generateRoomDungeon`](../generators/dungeon.md) with `partition` (see [placement of rooms](../generators/dungeon.md#placement-of-rooms)): the map, or each area, is cut in two again and again, and every part that results holds one room. The number of parts is estimated from `fill` and the typical room size and kept within `roomCount`, and grown a few times over if the rooms fall short. It takes the options of [`placeScatteredRooms`](place-scattered-rooms.md), and works the same way in everything else: templates, what is in the way, what it reserves, and the extras.

```ts
import { emptyMap, placePartitionedRooms, pipeline, Tile } from 'angstloch';

const { grid, rooms, roomShapes } = pipeline(
  emptyMap({ width: 61, height: 41, tile: Tile.Wall }),
  [placePartitionedRooms({ roomCount: { min: 12, max: 12 }, roomSpacing: 3 })],
  { random: mulberry32(42) },
);
```

- **`spacingUniformity`** sets how regular the partition is, from 0 to 1. At 0 the cuts, the part to cut next and the rooms inside their parts are random; at 1 the biggest part is cut next, through the middle, and rooms sit in the middle of their parts, which gives an almost regular grid.
- **What is in the way.** An ordinary room that would come within `roomSpacing` of a template, of a tile in front of a fixed exit or of an unopened cell block entrance, or of a tile that is not free is left out, and its part of the map stays empty.
- **Symmetry.** With a `symmetry`, a room is put in the middle of the area, one half or quarter of the area is partitioned, and the rest gets the mirror images of its rooms, or with a `symmetryChance` below 1, rooms of their own in the mirrored parts.
