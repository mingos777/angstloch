# Parallel adits in the fishbone

The adits of `digFishbone` (and of the fishbone layout of `generateMine`) leave their tunnels at independent random angles and branch off one another, so the mine reads as random veins. A fishbone should have a straight spine with ribs that run roughly parallel, like a mine that cuts across the strike of an ore vein.

## Decisions

- **A set of directions per mine.** Each mine (each copy under `count`) picks one rib angle θ from `branchAngle`, once. The ribs on one side of the shaft run along h + θ and the ribs on the other side along h − θ, where h is the forward direction of the shaft. Each adit follows its line, so the ribs on one side stay parallel.
- **Herringbone, not slant.** The two sides mirror each other across the shaft and both lean forward, like a fish skeleton. The forward direction (which end of the shaft the ribs lean towards) is picked at random per mine.
- **No deeper branching.** Adits only leave the main shaft. Adits off adits are gone, which is what a mine looking for a vein mostly does.
- **`aditSpread`** (new option): the most, in whole degrees, that an adit's starting heading may turn away from its line, either way, picked per adit. It makes the ribs roughly parallel, not exactly parallel.
- **`aditWindiness` defaults to 0.1** (was 0.4), so the ribs do not wander enough to hide that they are parallel.
- **The same step.** This changes `digFishbone` itself. No new step, and the old behavior is not kept, since Angstloch is not released.
- **Spacing waits.** Anchors on the shaft are still random, and the clearance check keeps ribs apart. Even spacing (`aditSpacing`) is decided after the user has seen parallel ribs in the playground.
- **Crosscuts replace `loops`.** `loops` goes. A new option, `crosscuts`, is the chance of a small tunnel that joins two neighboring adits on the same side of the shaft. Default 0.1.
- **The crosscut chance is per pair**: each pair of neighboring adits on the same side gets at most one crosscut, with the chance `crosscuts`. The value reads plainly ("a tenth of the pairs are joined") and does not depend on the length of the ribs. A chance per tile was rejected, since it would need a tiny value and would scale with the length of the ribs.
- **Crosscut shape**: a straight tunnel of width 1, roughly square to the ribs (the shortest way across), from a random point of the stretch where the two ribs run side by side. It is listed in `passages` as a new kind, `'crosscut'`.
- **Density** is looked at in the playground after task 1 before any change. With ribs off the shaft only, a high `density` will stop short more often.

## Open questions

- **Default of `aditSpread`.** About 10 degrees to start with. The user tunes it in the playground.

## Tasks

1. **Parallel ribs.** In `lay-fishbone.ts`: θ and the forward direction picked once per mine, anchors on the shaft only, the heading of each adit from its side's line plus a spread. `aditSpread` in `DigFishboneOptions`, its assertion, and `FishboneSettings`. `aditWindiness` default 0.1. Tests: each adit starts within `aditSpread` of its side's line; adits on opposite sides mirror across the shaft; every adit starts on the shaft. Playground: the new field in the fishbone step def. README (the fishbone layout section, the `digFishbone` table, the `generateMine` fishbone options) and CHANGELOG under Unreleased.
2. **Crosscuts.** Remove `loops` (and the break-through code in `planAdit`). Add `crosscuts`: after the ribs are dug, find the neighboring pairs on each side and join them by chance. Add the `'crosscut'` passage kind. Tests, the playground field, README and CHANGELOG.
3. **Maybe: even spacing** along the shaft, once the user has seen task 1.
