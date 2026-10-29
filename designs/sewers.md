# Sewers

Design in progress, not started. Delete this file once the feature is done and documented in the README.

## Scope

- **A step, `digSewers`**, used through `pipeline` like any other step. No preset.
- **A tree layout**: a trunk with branches meeting it at right angles, straight canals, junction chambers where canals meet. Not tied to a street plan on another map.
- **No flow direction**: the game decides which way the water runs.
- **Cisterns are part of the step** (see Cisterns). Sluice gates and the like are separate steps, designed separately.
- Builds on `Room.kind`, `roomGroups` and features as rooms from `designs/cell-blocks.md`.

## The map

```
####################################
#..................................#
#~~~~~~~~~~~~~~~~~~~~~~~~~~~~=~~~~~#
#..............=...................#
##########.....~.....###############
         #.....~.....#
         #####.~.#####
             #.~.#
             #.~.#
```

- **Tiles**: canals are always `ShallowWater`, walkways `Floor`, crossings `Bridge`, including the small bridge where a walkway crosses a side channel flowing into a bigger canal. No new tiles.
- **Always walkable**: every walkway tile reaches every other without entering water deeper than shallow; bridges make sure of it.
- **Straight canals**: the stream code's noisy centerlines do not fit; its bridges and the rule that water never cuts the map in two carry over.

## The result

- **Rooms**: `'sewerChamber'` for the junction chambers and branch heads, `'sewerTunnel'` for each stretch of canal between them, walkways included, and `'cistern'` for the cisterns. Every sewer tile has a room id through `createRoomMap`.
- **A `'sewer'` group** per copy of the step, with its canals (centerline, width, level `'trunk'` or `'branch'`).
- **A feature for the joining steps**: `digCorridors` and `digVeins` join it on its boundary. The walls beside water are reserved `Solid`, so a corridor never ends in a canal, only on a walkway.

## Cisterns

- **Planned with the tree**, so they never fail for lack of room: a cistern is a node of the network, a large chamber at a junction or at a branch head, with a canal running into it. Placing them before the sewer (straight canals routed round reserved basins) and changing a finished sewer were rejected.
- **Options**, named like those of `digPillarHalls`: `cisterns`, a `Range` of how many (none by default), and `cisternSize`, a range of dimensions.
- **Rectangular** basins of `ShallowWater`; the game can turn the water deep if it wants.
- **Ledges**: a `Floor` ledge, one tile wide, along some sides of the basin, how many drawn at random per cistern (a `Range` of sides, 1 to 4). The canals and corridors enter on a ledge.
- **Columns**: optional, by a setting (a chance per cistern and a spacing), `Wall` tiles in the water like the pillars of a hall.
- **No causeways.**

```
###############
#.............#
#.~~~~~~~~~~~.#
#.~#~~~#~~~#~.#
#.~~~~~~~~~~~.#
#.~#~~~#~~~#~.#
#.~~~~~~~~~~~.#
#.............#
###############
```

## Canal ends

- **A canal never ends in open floor.** Every end touches a wall: the end wall of its tunnel, or a side wall. Branch heads may also start in a chamber (water falling from above).
- **The game themes the ends**: a culvert under bars, a crevasse, a sump grate, or simply standing water where the tunnel stops. The library does not tell them apart.
- **`mouths`** in the sewer group: every canal end, with its position, the wall tile it meets, if any, and its canal.
- A few tiles of rock behind each mouth are reserved `Solid`, so no corridor is dug right behind it.

## Outfalls

- **An outfall is a trunk end at the border.** `outfalls`, a `Range`, says how many the sewer makes; `{ min: 0, max: 0 }` keeps the sewer off the border. An outfall needs the sewer's area to touch the border; when fewer than `min` fit, the step fails and the map is retried. Every canal end that is not an outfall is a mouth inside the map, with no switch.
- **`pierceBorder`** (default `false`) says whether the water breaks through the outer wall:
  - `false`: the water stops one tile short, at a mouth in the outer wall, which stays intact.
  - `true`: the canal runs onto the border tile, and the water leaves the map. This is not an exit: an exit is what the `exits` extra reports, and forest streams already run off the map's edge. Whether a passable edge tile is a way out is the game's rule.
- **The walkway beside it** reaches the border wall either way, and that border tile is `Openable`. The group reports it as the outfall.
- **`openExits` gets an `at` option**, `'border'` (today's behavior, the default) or `'outfalls'`: it opens the outfalls of the sewer groups through `openReserved`, read from the extras. An outfall left unopened stays wall.
- The rejected alternative: the water's border tile `Openable` too, opened by `openExits` with `tile: Tile.ShallowWater`. It would give `openExits` two jobs, a way out and a way for water, and mix them in `exits`.

## Open questions

- None left.

## Later

- Round cisterns.
- A cistern step of its own, for maps without a sewer, built on the same basin code. Needs its own design.

## Tasks

Each task extends the playground and the README. They wait for `Room.kind`, `roomGroups` and features as rooms (cell blocks, tasks 1/7, 2/7 and 5/7).

- 1/4 `digSewers`: trunk, branches, chambers, walkways and bridges; the rooms and the `'sewer'` group with its canals and mouths; the walls beside water and the rock behind mouths reserved; checked with `digCorridors` and `digVeins`; a playground step.
- 2/4 Outfalls: the `outfalls` range, `pierceBorder`, the `Openable` walkway tile, and `openExits` with `at: 'outfalls'`.
- 3/4 Cisterns: the count and size, ledges, columns.
- 4/4 README check, and this file deleted.
