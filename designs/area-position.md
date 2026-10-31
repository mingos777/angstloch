# Area position

Design in progress, not started. Delete this file once the feature is done and documented in the README.

## Scope

- **Where an area goes.** Today `area` only says how big the part of the map a feature step builds in is (`width`, `height`); `placeAreas` picks a random free spot. This adds two ways to steer the spot: a **window** (per axis, where an anchor point of the box must fall) and **gravity** (a pull toward a side, a corner or the middle, which stops on whatever is in the way).
- **One place changes.** Every step with an `area` goes through `placeAreas`, so all of them get the new fields at once: the `dig*` feature steps, `placeScatteredRooms`, `placePartitionedRooms`, `placeClusteredRooms`, `placeCellBlocks`, `placeMazeRooms`, `digMaze`, `digCatacombs`, `digSewers` and the rest listed under Area in the README.
- **Out of scope**: the `areas` of room templates (different thing, rectangles to place copies in), forest steps (they have no `area` yet, see `ROADMAP.md`), keeping off roads and other placement rules.

## Decisions

- **`AreaSize` becomes `AreaSpec`**, since it now says more than a size. The rename covers the type, `assertAreaSize` (to `assertAreaSpec`), `pickAreaSize`, the files, tests, README, demo and the `index.ts` barrel. Nothing is released, so no compatibility alias.
- **Shape**:

  ```ts
  interface AreaSpec {
    width?: Range;
    height?: Range;
    x?: AreaWindow<'left' | 'center' | 'right'>;
    y?: AreaWindow<'top' | 'center' | 'bottom'>;
    gravity?: AreaGravity;
  }
  interface AreaWindow<Anchor> {
    min: number; // tiles, map coordinates
    max: number;
    anchor?: Anchor; // default 'center'
  }
  interface AreaGravity {
    toward: 'left' | 'top left' | 'top' | 'top right' | 'right' | 'bottom right' | 'bottom' | 'bottom left' | 'center';
    strength: number; // 0 to 1
  }
  ```

- **Window** (`x`, `y`). `min` and `max` are tiles in map coordinates, both inclusive. The `anchor` is the point of the box that must fall in the window: its left or top edge tile, its last tile on the right or bottom, or its center tile (`x + floor(width / 2)`). A missing axis is free, as today. The two axes are independent, so one axis may have a window and the other none.
- **Gravity** is either/or with a window: giving `gravity` with `x` or `y` throws a `RangeError`. The pull is on both axes: `'left'` drags x toward 0 and tries to put the box's vertical midpoint at the map's vertical midpoint; a corner pulls both axes to the corner; `'center'` pulls both to the middle. `strength` applies to both axes alike, so every `'left'` box at strength 1 ends on the same row unless something stops it. It is all best effort.
- **Invalid input throws.** A `RangeError` at `validate` (the pipeline's start), not a silent clamp, for: a window with `min` above `max` or not whole numbers; a window that cannot hold the biggest box the size range can draw (checked for the largest width and height, which is the hardest case); on a lattice, a window with no even coordinate; a `strength` outside 0 to 1; an unknown `toward` or `anchor`; `gravity` together with `x` or `y`. A window that is valid but too crowded is the existing 100-try `Error`, and `pipeline` retries.
- **Several copies.** Each copy is placed on its own with the same rules. Earlier copies are obstacles, so with gravity the copies pile up against the side and then against each other.
- **Cave `placement`.** `'beside'` picks its own spot (`placeBeside`), so a window or gravity with `'beside'` is a `RangeError`. `'free'` and `'overlap'` honor them.
- **Lattice** (mazes and lattice rooms). Positions snap to even coordinates, so a window may end one tile off its edge, and a slide moves by 2.
- **A box as big as the map** takes the whole map, as it does now; position is ignored (a window it cannot satisfy is still an error at `validate`).
- **Version**: nothing is released, so `package.json` stays at `0.0.0`, and the changelog entries go under `Unreleased`: Added for the fields, Changed for the rename. After the first release this would be major because of the rename.

## The algorithm

**Window.** `placeAreas` draws `x` and `y` of the box only from the spots whose anchor point lies in the window (intersected with the map, and with the lattice's even coordinates). Everything else stays: the box and a one-tile margin must be free and clear of earlier copies, 100 tries.

**Gravity.** Draw a valid spot exactly as today (anywhere on the map), then slide:

1. The target is the spot where the box is flush to the chosen side and centered on the other axis: for `'left'`, `x = 0` and `y = round((height - boxHeight) / 2)`; for `'top right'`, `x = width - boxWidth` and `y = 0`; for `'center'`, centered both ways.
2. The distance to slide on each axis is `round(strength * distance to the target)`; at strength 0 the box stays where it was drawn, which is today's behavior.
3. Move one tile at a time (two on a lattice), each axis separately; a step is taken only if the box and its margin are still clear (the `isClear` rule). An axis that is blocked stops, the other carries on. So the box stops against a room instead of passing it.

Passing over an obstacle is never done, so a box drawn on the far side of a room slides toward the room and stays there. That is accepted as best effort.

## Open questions

- None blocking. To settle while building: whether the cross-axis centering should wait until the main axis has stopped (so a box blocked early does not drift sideways), to be judged on the playground.

## Tasks

Each task ends with a short report and waits for review.

1. **Rename `AreaSize` to `AreaSpec`.** Types, files, `assertAreaSpec` (`pickAreaSize` keeps its name: it still picks a size), tests, README, demo, changelog. No behavior change.
2. **Window.** `x` and `y` on `AreaSpec`, validation in `assertAreaSpec` (including the `'beside'` check in the cave steps and the lattice check), the drawing change in `placeAreas`, tests (anchors, bounds, lattice, several copies, errors), README section under Areas, changelog, and the playground: fields for `x` and `y` on every step that has an `area`, in `demo/step-fields.ts`.
3. **Gravity.** `gravity` on `AreaSpec`, validation (either/or with the window, `strength`, `toward`), the slide in `placeAreas`, tests (each of the 9 directions on an empty map, stopping against a room, strength 0 and 0.5, several copies, lattice, errors), README, changelog, and the playground fields. Possibly a check script to see how the boxes land over many seeds, if it proves useful.
