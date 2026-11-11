# Room templates

Pass templates to either generator in the `templates` option of its rooms (`scatter.templates` or `partition.templates` in `generateRoomDungeon`, `grow.templates` in `generateDigDungeon`). A `RoomTemplate` is a player-made room: a rectangular design that is placed in a dungeon as it is, with the corridors dug around it. The design is a grid of `TemplateCell` values, written as rows:

```ts
import { TemplateCell, type RoomTemplate } from 'angstloch';

const { Unused: _, Floor: F, Wall: W, Exit: E } = TemplateCell;

const cross: RoomTemplate = {
  name: 'cross',
  cells: [
    [_, W, E, W, _],
    [W, W, F, W, W],
    [E, F, F, F, E],
    [W, W, F, W, W],
    [_, W, E, W, _],
  ],
};
```

| `TemplateCell` | Value | Meaning                                                                                                                                                                                                                                                                                              |
| -------------- | ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Unused`       | 0     | Not part of the room. Corridors and other rooms may use the space, and the map is left untouched there.                                                                                                                                                                                              |
| `Floor`        | 1     | Becomes `Tile.Floor`.                                                                                                                                                                                                                                                                                |
| `Wall`         | 2     | Becomes `Tile.Wall` and is protected: nothing is dug through it and it never gets an exit.                                                                                                                                                                                                           |
| `Exit`         | 3     | A connection point. Becomes `Tile.Floor`, or `Tile.Door` according to the `doorChance` of the step that places the template.                                                                                                                                                                         |
| `Door`         | 4     | A connection point that always becomes `Tile.Door`.                                                                                                                                                                                                                                                  |
| `OptionalExit` | 5     | A wall that may be opened into an exit when the room needs one. Then it is a door as for `Exit`: by the `doorChance` of the step that places the template, decided at placement, which the step that opens it keeps (but `digVeins`, which opens it as plain floor). Elsewhere it stays `Tile.Wall`. |

The values are part of the public contract: kinds may be added, but existing values never change.

A template is valid if:

- it has at least one row, and all rows are equally long;
- at least one `Exit`, `Door` or `OptionalExit` cell has an orthogonal neighbor that is `Unused` or beyond the template's edge (an _exit candidate_, where a corridor can start; every `Exit` and `Door` candidate gets connected, while `OptionalExit` candidates are opened only as far as `exitsPerRoom` asks, and a cell of these kinds without an outside neighbor is just an internal door);
- open cells (`Floor`, `Exit`, `Door`, `OptionalExit`) are walled in: none of their eight neighbors, diagonals included, is `Unused` or beyond the template's edge, except on the outward side of an exit candidate. Diagonal moves are common in games, so this keeps a corridor from touching a floor diagonally, and keeps a door from being sidestepped;
- `count`, `rotate`, `positionAccuracy` and `positions` follow the table below.

A forest takes templates without exits instead, and has its own rules, see [Templates in forests](generators/forest.md#templates-in-forests).

An invalid template throws a `RangeError` that names the template.

| Field              | Default   | Description                                                                                                                                     |
| ------------------ | --------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `cells`            | required  | The design, as rows of `TemplateCell` values.                                                                                                   |
| `name`             | none      | Names the template in error messages.                                                                                                           |
| `count`            | exactly 1 | Number of copies to place, a `Range` of at least 0.                                                                                             |
| `rotate`           | `[0]`     | Clockwise rotations the template may be placed in, any of `0`, `90`, `180` and `270`. Each is controlled separately; the default never rotates. |
| `mirror`           | `false`   | Whether the template may also be placed mirrored left to right.                                                                                 |
| `positions`        | none      | Acceptable targets, see below. One is picked at random per copy; copies beyond the list are placed at random.                                   |
| `areas`            | none      | Rectangles of the map, `{ x, y, width, height }`, to place copies in, see below. Used for copies that have no position.                         |
| `positionAccuracy` | `1`       | How exactly positions are honored, from 0 to 1: 1 is exact if possible, in between allows some variance, 0 ignores positions.                   |
| `clearing`         | `false`   | Forests only: whether the template needs a clearing, see [Templates in forests](generators/forest.md#templates-in-forests).                     |
| `chance`           | 1         | Forests only: the chance that each copy is placed, from 0 to 1.                                                                                 |
| `margin`           | 0         | Forests only: how far the trees thin out beyond the box of a template with a clearing of its own, in tiles.                                     |

A `Position` is `{ coords, anchor, rotations? }`. `anchor` says which point of the placed room's bounding box lands on `coords`: `'center'`, `'top'`, `'bottom'`, `'left'`, `'right'`, `'top-left'`, `'top-right'`, `'bottom-left'` or `'bottom-right'`. The anchor describes the room as it ends up on the map, so it does not rotate with the template. `rotations` limits the rotations allowed at that position, for example a door in the template's bottom wall and a `'bottom'` anchor call for `[90, 180, 270]`. The rotations used at a position are those in both `rotations` and the template's `rotate`; having none in common is an error.

Mirroring and rotating produce the template's _variants_. Variants that look alike, such as a symmetric room turned by 180°, count once, so symmetric rooms are not favored when a variant is picked at random.

## Where templates go

Placement is best effort, but never silent. For each copy of a template:

1. One of the template's `positions` is picked at random; every position is used by one copy. Copies beyond the list go into the template's `areas`, see below, or are placed at random if it has none. A copy without a position, and every copy of a template with a `positionAccuracy` of 0, goes to a random free spot.
2. The target is the position's `coords`, with the anchor of the room's bounding box on it (an even box has its center rounded down). Below an accuracy of 1 the target is moved by up to `(1 - positionAccuracy)` times half the shorter map side in each direction.
3. If the target is not valid, the nearest valid spot is used instead. Every allowed variant is considered, so a variant that fits better than the first one can win.

`areas` say where copies without a position go, when you care about the region and not the exact spot, for example near the sides of the map: give a strip on each side. A copy picks one of the areas at random and is placed at a random valid spot inside it, in any allowed variant. The copy's whole bounding box must lie inside the area. If the picked area has no room for it, the other areas are tried, and if none has, placing throws a `TemplatePlacementError`: a template with areas is never placed outside them. An area must be a rectangle of whole numbers, at least 1 by 1, within the map, and at least one allowed variant must fit in at least one area, or the template is rejected with a `RangeError` before anything is generated. `positionAccuracy` only applies to positions. With `templateSymmetry`, a copy is only placed where its mirror images fit too, but they need not lie inside an area. [`placeClusteredRooms`](steps/place-clustered-rooms.md) puts the first template in the middle of the map unless it has `positions` or `areas`.

A spot is valid if the room's footprint, which is every cell but the `Unused` ones and so includes the template's walls, lies within the map and keeps its distance from other rooms' footprints, and if the exits have room. Distance works like this:

- With a `roomSpacing` of 1, as for ordinary rooms, templates may touch and **share walls**. Two cells may sit on the same tile only if both are walls (an `OptionalExit` counts as a wall where it is not opened), or if both are an `Exit` or a `Door` that line up as a doorway: they leave in opposite directions, with the floor of one room on each side. Anything else on the same tile, such as a floor on a wall or a doorway on a wall, is a collision. A doorway that two templates share is a single exit of both rooms, listed once in `exits` with both room ids, and it needs no corridor. Spots that touch no other room are preferred when a copy is placed at random; a copy with a position is placed exactly there if it is valid, shared walls or not.
- With a `roomSpacing` of 2 or more, footprints must be more than `roomSpacing` tiles apart, and nothing is shared.

Exits need room as well: every `Exit` and `Door` needs either a shared doorway or a free tile outside it to start a corridor from, one tile or more away from the map edge, and at least one exit candidate of any kind needs that free tile, so that every templated room can reach out on its own. Templates may sit in each other's bounding boxes as long as their footprints keep to these rules.

On the lattice (`placement: 'lattice'`) a template's bounding box sits on even coordinates, so that walls fall on even tiles and floors on odd ones, and only variants with an odd width and height are used. Variants that do not fit the lattice are not used.

## In a dungeon

`generateRoomDungeon` places the templates before anything else, in the order of the list, and carves them as they are. ([`generateDigDungeon`](generators/dungeon.md#grown-dungeons) does the same, and grows the ordinary rooms from the first one.) The ordinary rooms are placed afterwards around them, at least `roomSpacing` tiles from a template's footprint and leaving the tile in front of each of its exits free, and corridors never cut through a template's walls. The templated rooms come first in `rooms`, copies of a template together, and are described by `template`, `rotation` and `mirrored`.

```ts
import { generateRoomDungeon } from 'angstloch';

const { grid, rooms } = generateRoomDungeon({
  width: 61,
  height: 31,
  scatter: {
    templates: [
      { ...cross, positions: [{ coords: { x: 30, y: 15 }, anchor: 'center' }] },
    ],
  },
});
```

- A templated room counts towards `roomCount`, and its floor, doors included, towards `fill`. The `fill` of the result includes it.
- Every `Exit` and `Door` cell that leads outside is opened and joined to the rest of the dungeon by a corridor, whatever `exitsPerRoom` says. Those exits count towards the room's `exitsPerRoom`, so a room with more fixed exits than the range asks for simply has more.
- `OptionalExit` cells are opened only as far as `exitsPerRoom` asks for more exits, and only where a corridor can start. If a template has no more exits than its fixed ones, it gets no others.
- `Exit` cells become doors by `doorChance` (that of the rooms in `generateRoomDungeon`), and `Door` cells always do. The same `doorChance` decides for every `OptionalExit` cell when the template is placed, and `digCorridors` keeps that answer if it opens the cell, whatever its own `doorChance` says, so a template placed with `doorChance: 1` gets doors in every exit it has. They are listed in `exits`, and `Exit` and `Door` cells inside the template, which lead nowhere, are tiles only: they are not listed, and the same `doorChance` applies to the `Exit` ones.
- Every exit has a corridor tile in front of it and corridors keep the usual distance from one another, so a door cannot be sidestepped and corridors cannot be crossed diagonally.
- With `templateSymmetry` set and a `symmetry` of the rooms other than `none`, every copy of a template brings its mirror images along, always and whatever `symmetryChance` is. An image is the geometric image of the copy, whatever `rotate` and `mirror` allow, and `rotation` and `mirrored` describe it accordingly. A copy is only placed where its images fit too, and an image that equals the copy (a centered, symmetric template) is not added. Without `templateSymmetry`, a template is placed once per copy, even with a symmetric layout. `templateSymmetry` has no effect without a layout symmetry.
- The corridor rules can occasionally box in the fixed exit of a template. `digCorridors` then routes the corridors again, up to three times in all. If it still fails, the templates are placed again and the dungeon is built again, up to three times in all, before giving up with a `TemplatePlacementError`.

With `placement: 'lattice'`, a template that cannot sit on the lattice is rejected before anything is generated, with a `RangeError` that names it: at least one of its variants must have an odd width and height, every `Exit` and `Door` that leads outside must face a tile with odd coordinates, which is where corridors start, and so must at least one exit candidate of any kind. Design lattice templates with their walls on even and their floors on odd rows and columns of the template, and exits on the walls at odd positions along them. An example is a 3x3 template with a floor in the middle and one exit in the top wall.

A template is never skipped silently, since a map may need it (a boss arena, a scripted ruin). When a template finds no place in a dungeon, a mine, a maze or a forest, a new map is generated, up to three in all, and only then a `TemplatePlacementError` is thrown: at that point the input is at fault and not the map, as every attempt failed. Errors that no other map could fix, such as a template bigger than the map or one that fits no lattice, are thrown at once. Its message says which template (by `name` and index) and why, and its `templateIndex` and `templateName` fields carry the same. A template that cannot be joined to the rest of the dungeon throws the same error.
