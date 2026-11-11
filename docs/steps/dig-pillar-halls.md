# `digPillarHalls`

`digPillarHalls(options?)` is a step that digs a room-and-pillar mine (see [the pillars layout](../generators/mine.md#the-pillars-layout)): a few large halls placed apart from one another, with pillars of wall left standing in them. It digs no veins: [`digVeins`](dig-veins.md) joins the halls. Like `digFishbone` it needs a map that starts as wall, takes `area` and `count`, and checks every option when it is made.

```ts
const { grid, rooms } = pipeline(
  emptyMap({ width: 80, height: 50, tile: Tile.Wall }),
  [
    digFishbone(),
    // one pillar hall on a piece of the map of its own
    digPillarHalls({
      halls: { min: 1, max: 1 },
      area: { width: { min: 20, max: 20 }, height: { min: 16, max: 16 } },
    }),
  ],
  { random: mulberry32(42) },
);
```

A pillar hall on its own is this step with `halls: 1` in a small area. It is not joined to the rest of the map, which is left to a later step: [`digVeins`](dig-veins.md) or [`digCorridors`](dig-corridors.md) joins the halls to each other and to anything else.

| Option          | Default       | Meaning                                                                                                                                                                                                           |
| --------------- | ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `density`       | 0.35          | The share of the area that is floor, from 0 to 1. It sets the size of the halls that have no `hallSize`.                                                                                                          |
| `halls`         | `{ 2, 4 }`    | How many halls to dig in each area, a `Range` of whole numbers, 1 or more. A hall that finds no room, at least 4 tiles of wall from the others and off reserved tiles, is left out.                               |
| `hallSize`      | from density  | The width and the height of a hall in whole tiles, 1 or more. Each side of each hall gets its own size, cut down to what the area has room for.                                                                   |
| `hallRagged`    | 0.5           | How ragged the edges of the halls are, from 0 (clean rectangles) to 1.                                                                                                                                            |
| `pillarSize`    | `{ 2, 5 }`    | The width and the height of a pillar in whole tiles, 1 or more.                                                                                                                                                   |
| `pillarSpacing` | `{ 2, 4 }`    | The gap between neighboring pillars in whole tiles, 1 or more, picked once for each hall.                                                                                                                         |
| `pillarRagged`  | 0.5           | How ragged the edges of the pillars are, from 0 (clean rectangles) to 1.                                                                                                                                          |
| `pillarJitter`  | 0.5           | How far the pillars stray from a regular pattern, from 0 (a perfect grid) to 1.                                                                                                                                   |
| `area`          | the whole map | The size of the part of the map to dig in, see [areas](../composing.md#areas). The halls are closed in by a ring of wall inside it.                                                                               |
| `count`         | `{ 1, 1 }`    | How many groups of halls to dig, each in an area of its own. The groups are apart, so a map with two is in two pieces, unless a later step joins them. [`digVeins`](dig-veins.md) joins the halls of every group. |

- **Density is a share of the area**, as for `digFishbone`.
- **Reserved ground.** No hall covers a [reserved](../composing.md#mapstate) tile.
- **Halls are rooms.** Every hall is a [`Room`](../rooms.md#room) of kind `'pillarHall'`, its box the rectangle it was dug in, in the coordinates of the map, and its shape in `roomShapes` its floor, which blocks nothing and reserves nothing (see [halls and caverns](../rooms.md#room)). The halls of one area are a `'pillarHalls'` [group](../rooms.md#roomgroup) with the box of the area.
- **Uses** `rooms`, `roomShapes` and `roomGroups`, from the steps before it, and **adds** all three again with its own appended, the ids following on.
