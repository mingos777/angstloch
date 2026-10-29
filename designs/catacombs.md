# Catacombs

Design in progress, not started. Delete this file once the feature is done and documented in the README.

## Scope

- **A step, `digCatacombs`**: one catacomb section, in an `area`, with its galleries, niches, burial chambers and crypts planned and dug together. One step and not three (galleries, then `digNiches`, then `placeBurialChambers`), so the step can plan ahead: galleries lined with niches or fronted by chambers are spaced wider to leave the rock they need, and chambers can face each other or end a gallery. `placeCellBlocks` (corridor and cells) and `digSewers` (cisterns) are built the same way.
- **Areas, not sub-pipelines**: a catacomb in the middle of the map with other things round it is `digCatacombs` in an area, other steps in theirs, then `digVeins` or `digCorridors`. Running a pipeline inside a pipeline was rejected.
- **A step only**, no preset, like the sewers.
- **One section per call**, no `count`: two catacombs are two copies of the step in two areas.
- **No phases** (blocks of their own spacing joined by irregular links): too much detail for a roguelike map.
- **Out of scope for now**: decay (collapsed stretches, rubble), which waits for the mine's cave-ins; a standalone `digNiches` for other maps (the niche code stays in a module of its own, so it can become one later).

## The map

```
###########################
#.#.#.#.#.###.#.#.#.#.#.###
#.......................###
###.#.#.###.###.#.#.###.###
  #.#.#.# #.# #.#.#.#.#.#
  #.....# #.# #.......#.#
  ###.### #.# ###.#####.#
    #.#  ##.##  #.#   #.#
    #.....@.......#   #.#
    ###.##...##.###   #.#
```

## Galleries

- **A lattice** of straight galleries with right-angle turns, many junctions and loops.
- **Width** is a `Range`. Main galleries are the wide ones, side galleries the narrow ones (a hierarchy, like the sewer's trunk and branches).
- **Dead ends** by an option, none or few by default.
- **Symmetry**: `symmetry` and `symmetryChance`, as the other steps take them. The lattice is mirrored first; niches and chambers get twins with the chance.

## Segments

- A **segment** is a stretch of gallery between two junctions, or a junction and a dead end. Each gets one character, drawn by weights: `segments: { niches, chambers, bare }`. Weights need not add up to 1.
- **Best effort**: a chamber segment with no room for a chamber becomes a niche segment, then a bare one. The group reports what each segment became.

## Niches

- **Plain `Floor`**, 1 to 2 tiles deep (a `Range`), at a spacing along the gallery walls, on one or both sides.
- **Not rooms**: listed in the `'catacomb'` group, each with its tiles and facing, as a block lists its cells.
- A gap in the niche run where a chamber door is.

## Burial chambers

- **Rooms of kind `'burialChamber'`**, pointing to the group with `Room.group`, as cells point to their block.
- Off a chamber segment, one entrance from the gallery, always a `Door`, as the cells have; a size `Range` and a spacing.
- **Niches inside chambers**, by an option.
- Pairs facing each other across a gallery; a gallery may end in a chamber instead of a blank dead end.

## Crypts

- **Templates**: a `templates` option taking the same `RoomTemplate` objects as the room steps, with the same `count`, `rotate`, `mirror`, `positions`, `areas` and `positionAccuracy`. They are placed inside the area and joined to the galleries. A template that cannot be placed fails as it does in the other steps.
- **Rooms placed before**: the galleries route round reserved tiles and enter rooms already in the area through their `Openable` tiles, as `digMaze` does.

## The result

- **The section is not a room.** It is a feature for the joining steps: `digVeins` and `digCorridors` route round it and join it on its boundary. How it keeps them off its rock is internal.
- **A `'catacomb'` group** per copy of the step: its `area`, its galleries (segments with their floor, width, main or side, and character), its niches and its chambers.
- Burial chambers and crypts are listed in `rooms`, with shapes in `roomShapes`.

## Open questions

None left before task 1.

- Defaults (spacing, widths, weights) are tuned on the playground, for small maps first: the user's game uses 71 by 35.

## Tasks

Tentative. Each task extends the playground, the README and the CHANGELOG.

1. `digCatacombs`: the lattice of galleries, main and side widths, dead ends, the `'catacomb'` group, joined by `digVeins` and `digCorridors`; a playground step.
2. Segments and niches.
3. Burial chambers, and niches inside them.
4. Crypts: templates, and rooms placed before.
5. Symmetry.
6. README check, and this file deleted.
