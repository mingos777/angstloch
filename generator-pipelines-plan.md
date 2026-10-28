# Plan: composable generation (steps), with the forest as the pilot

## Context

`generateForest` is one 380-line function ([build-forest-once.ts](src/forest/build-forest-once.ts)) with a large flat options object. It lays streams, roads, clearings, templates, paths and footbridges, then decides every tree in one final pass that combines the road, bank, clearing and template ramps. The features share hidden state (`LaidStreams`, `RoadMap`, footprints, crossing plans) and a `ForestObserver`. Retry is a wrapper ([retry-placement.ts](src/rooms/templates/retry-placement.ts)).

The roadmap's signed-off design (ROADMAP.md › Composable generation) replaces this with an empty base map plus a list of steps run by `pipeline`. The forest is the pilot. This plan splits that work into small tasks, one at a time, with a review after each.

Decisions taken in this session, on top of the roadmap:
- **`generateForest` options are nested per step**: `{ width, height, random, trees, streams, roads, clearings, templates, footbridges }`. Each key holds that step's options, and the verges sit inside each feature.
- **No `density` anywhere in the API.** The chance of a tree is internal to `plantTrees`: it adds no extras, the verges never see it, and `density` goes from the forest result. No step needs it, and a game can count trees or sample the public noise. A reporting option on `plantTrees` can be added later without breaking anything.
- **Scope is the forest only.** Mines and dungeons keep `retryPlacement` until each one gets its own design talk.

## Architecture

### Machinery: new `src/pipeline/` (imports `core/` only; sits between `core` and `rooms`/`noise`)

- `map-state.ts`: `MapState { grid: Grid; base: Tile; prunable: Uint8Array }`.
- `step-context.ts`: `StepContext { random: Random; trace?: (name: string, data: unknown) => void }`.
- `map-step.ts`: `MapStep<Needs, Adds>`, a callable `(state: MapState & Needs, ctx?: Partial<StepContext>) => Adds` with a readonly `stepName` and a runtime `needs: readonly string[]`.
- `step.ts`: `step(name, needs, fn)` builds a `MapStep`. A missing `ctx.random` falls back to `resolveRandom()`. Before running, it checks `needs` and throws a `TypeError` that names the step and the missing extra, for plain-JS callers.
- `empty-map.ts`: `emptyMap({ width, height, tile })` validates at once (`assertDimensions`, `assertTile`) and returns a factory `() => MapState`, so every attempt starts fresh.
- `pipeline.ts`: `pipeline(base, steps, { random?, attempts = 3, onStep? })`.
  - Before attempt 1 it checks the `needs` of the chain against the extras of the steps before each one, using the runtime `needs` plus each step's declared `adds` names.
  - Each attempt runs `base()`, then runs every step in order and merges the extras it returns into the state with `Object.assign` (a later `roads` replaces an earlier one). It calls `onStep(name, state)` after each step.
  - When a step throws, it records `{ attempt, step, error }` and retries. A `TemplatePlacementError` with `permanent` set is thrown at once. After the last attempt, the last error is thrown.
  - It returns the final state plus `{ attempts, failures }`.
- `pipeline-failure.ts`, `pipeline-options.ts`, `pipeline-result.ts`: the types above.
- **Chain typing**: `pipeline<const S extends readonly AnyStep[]>(base, steps: S & ValidChain<MapState, S>)` with a recursive tuple type that accumulates `Adds` and checks each `Needs`. An optional need is `Partial<{ streams: Road[] }>`. Task 1 prototypes this. If the compile errors are unreadable, fall back to overloads for up to ~10 steps (or a `.then()` builder) and record the choice in ROADMAP.

### Verges and pruning: in `src/roads/` (it owns `roadDistance` and `DistanceMetric`; `roads` may import `pipeline`)

- `verge.ts`: `Verge { clearance?: number; falloff?: number; distance?: DistanceMetric }`, which defaults to 0, 0 and `'chebyshev'` as today. Also `assertVerge`.
- `prune-verge.ts`: `pruneVerge(state, mask, verge, random)`. It measures distance with `roadDistance(mask, …, clearance + falloff + 1)`. On every prunable tile the survival chance is `ramp(away − clearance, falloff)` (today's `away / (falloff + 1)`, clamped to 0..1). A tree that is not kept is set back to `state.base` and its prunable bit is cleared. It touches only the grid and `prunable`.
- `stamp-tile.ts` (core-level helper, in `pipeline/`): sets a tile and clears its prunable bit. Every feature step stamps through it.
- "Free to build on" is `grid === base || prunable`. This replaces the `covered`/`water` masks fed to templates and clearings.

### Steps of the pilot, each next to the code it wraps

| Step | Dir | Requires | Uses if present | Adds | Options |
|---|---|---|---|---|---|
| `plantTrees` | `forest/` | — | — | — | `scaleX/Y`, `rotation`, `octaves`, `persistence`, `lacunarity`, `noise`, `density: Range` of fractions (0–0.25), `tile` (Tree) |
| `addStreams` | `streams/` | — | — | `streams` | water part of `StreamOptions`, `shallowTile`, `deepTile`, Verge (replaces `bankClearance`/`bankFalloff`) |
| `addRoads` | `streams/` (it bends roads across streams) | — | `streams` (bends roads across them, lays bridges) | `roads`, `junctions`, `exits`, `bridges` | `RoadOptions`, `roadTile`, `bridgeTile`, `bridgeAngle`, Verge |
| `placeClearings` | `forest/` | — | `roads` (road distance, branch ends), `streams` (`at: 'stream'`) | `clearings` | `clearings: ClearingSpec[]`, `spacing`, Verge (falloff only matters) |
| `placeTemplates` | `forest/` | — | `clearings` (templates with `clearing: true`) | `templates` | `templates: RoomTemplate[]` |
| `addClearingPaths` | `forest/` | `clearings` | `roads` (start of a path), `templates` (stop at the edge) | `roads`, `junctions`, `exits`, `bridges` | `roadTile`, `bridgeTile`, Verge |
| `addFootbridges` | `streams/` | `streams` | `roads` (count as land) | `bridges` | `minimum`, `bridgeTile` |

**Hidden state is rebuilt from the public extras** (roadmap decision):
- `rebuild-stream-map.ts` (`streams/`) re-reverses tributaries to their grown order, re-stamps them with `stampRoad` (brush plus `extendPastBorder`, so `covered` is exact) and returns a `LaidStreams` without `deep`, which only `addStreams` needs and has itself. It feeds `createSteerAcrossStreams`, `layFootbridges` and `at: 'stream'` clearings.
- `rebuild-road-map.ts` (`roads/`) builds a fresh `createRoadMap` with the existing roads re-stamped, for `placeClearings` (distances, branch ends) and `addClearingPaths` (`findStart`, `addPath`).

**Per-step behavior notes:**
- `plantTrees` plants only where `grid === base`, sets the prunable bit, and draws one `random()` per base tile.
- `addStreams` and `addRoads` paint over whatever is there. `addStreams` throws when `roads` are already in the state, which is the run-time check of "streams before roads".
- `addRoads` keeps today's bridge rule. A road tile over water becomes `bridgeTile` where a crossing plan's approach-to-departure brush covers it or `findSpans` says it spans the water. Otherwise the water stays. Then it prunes its verge. `ctx.trace('addRoads', { grown, plans })` replaces `ForestObserver`.
- `placeClearings` stamps nothing (a clearing is ground). It prunes 100% inside the ragged shape (clearance ∞ inside the mask) and ramps beyond it. Each clearing in the extra carries its resolved `path` request (width, windiness) for `addClearingPaths`.
- `placeTemplates` uses the free mask as `blocked` for `placeForestTemplates`. `Floor` and `Wall` cells are stamped, and the margin of an own clearing prunes through a Verge. It throws `TemplatePlacementError`, which the pipeline retries.
- `addClearingPaths` makes a path stop at the first tile inside a placed template's box that is not free (`stopShort`). A path that still runs through a template throws, and the pipeline retries. Bridges come from the `findSpans` backstop.
- `addFootbridges` treats a water tile as land where `grid === bridgeTile`. The other land is the rebuilt road mask outside the water. It stamps the footbridges and returns `bridges` recomputed by `findBridges`.

**Expected change in the maps**: the order of `random()` calls changes, so a seed gives a different forest than today. The distribution of trees under a single verge is the same (`p·keep` = today's `p·thinning`). Overlapping verges prune slightly more, as the roadmap accepts.

## Tasks (stop and report after each)

1. **Machinery.** Add `src/pipeline/` (`MapState`, `MapStep`, `StepContext`, `step`, `emptyMap`, `stampTile`, `pipeline` with retry, failures, `onStep`, the up-front needs check and the chain types) and export it from `src/index.ts`.
   - Tests cover: a fresh base per attempt, the merge of extras, a failure record per failed attempt, a permanent error skipping the retries, the last error thrown, a missing need throwing before attempt 1, and a step called by hand without a context. A `*.test-d.ts` or `// @ts-expect-error` test checks that a wrong order fails to compile.
   - README gets a "Composing maps" section. CLAUDE.md gets `pipeline/` in the layout and a line on the steps API. ROADMAP records this session's three decisions and marks the work as started.
   - Playground: a new `demo/steps.html` page with size and base tile, an attempts and failures readout, and a "show after step" selector fed by `onStep`.
2. **Verges and `plantTrees`.** Add `verge.ts`, `assertVerge`, `prune-verge.ts` and the `plantTrees` step. Tests: planting only on base tiles, the prunable bit, the effect of the density range, and the pruning ramp. README and steps-page panel. The README describes `plantTrees` as general ground cover, not only trees: any `Tile` value on any base, with an example such as rocks on dirt for a steppe, and a reminder that a game maps tile values to whatever it draws. The steps page lets both the base tile and the planted tile be picked.
3. **`addStreams`** plus `rebuild-stream-map.ts`. Tests: water tiles, deep core, bank verge, the throw after roads, and a rebuild that equals the original mask. README and panel.
4. **`addRoads`** with crossing plans, bridges and `ctx.trace`. Tests port the stream-crossing assertions from `generate-forest-streams.test.ts`. README and panel, plus "show grown roads" and "show crossing plans" through `trace`.
5. **`placeClearings`** plus `rebuild-road-map.ts`. Tests port the clearing assertions from `generate-forest.test.ts` (road distance, branch ends, `at: 'stream'`, spacing, ragged pruning). README and panel.
6. **`placeTemplates`.** Tests port `generate-forest-templates.test.ts`: the free mask, own clearing and margin, the throw and the pipeline retry. README and panel (reuse `demo/forest-templates.ts`).
7. **`addClearingPaths`.** Tests: a path from the nearest road or border, stopping at a template, a throw through a template, verge pruning. README and panel.
8. **`addFootbridges`.** Tests port the footbridge assertions (it joins large pieces, the minimum, it never lies on the edge). README and panel.
9. **`generateForest` as a preset.** Nested `ForestOptions`; the result loses `density` and gains `attempts` and `failures`. Delete `build-forest-once.ts`, `build-forest.ts`, `forest-observer.ts` and the forest's use of `retryPlacement` (the file stays for mines and dungeons). Move `scripts/check-forest.ts` onto `pipeline` with `trace`, run it, and compare the counts with ROADMAP's table. Report regressions; do not tune defaults unasked. Rewrite the README forest section (options, defaults, result, examples).
10. **Playground rebuilt on steps.** Move the forest page onto the preset or fold it into the steps page (the user picks after task 9), retire the old controls and the density display mode, and keep `GLYPHS` and the README colors in sync. Update ROADMAP: where the library stands, next up, and the forest design decisions that changed.

## Critical files

- New: `src/pipeline/*`, `src/roads/verge.ts`, `src/roads/prune-verge.ts`, `src/roads/rebuild-road-map.ts`, `src/streams/rebuild-stream-map.ts`, one file per step, `demo/steps.html`, `demo/steps.ts`.
- Reused as they are: `layStreams`, `createSteerAcrossStreams`, `layRoadNetwork`, `collectLaidRoads`, `findSpans`, `findBridges`, `layFootbridges`, `layClearings`, `stampClearing`, `placeForestTemplates`, `layClearingPaths`, `roadDistance`, `stampRoad`, `createFractalNoise`, `transformNoise`, `TemplatePlacementError`.
- Changed: `src/forest/generate-forest.ts`, `forest-options.ts`, `forest-result.ts`, `layClearings` (it takes a free/road mask instead of `ClearingLayout.roads` where needed), `src/index.ts`, `demo/forest.ts`, `scripts/check-forest.ts`, `README.md`, `CLAUDE.md`, `ROADMAP.md`.

## Verification (every task)

- `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm test` (80% coverage).
- `npm run dev`: the steps page shows the map after each step, and attempts and failures are visible.
- From task 4 on: `npm run check:forest` against today's counts in ROADMAP (turns over 45° 11, doubles back 1, along the edge 2, along water 2, given back to water 2, the rest 0). Task 9 runs it on the preset.

## Open questions (for when a task reaches them)

- Whether the chain types give readable errors, or overloads are needed (task 1).
- Whether `pipeline`'s result should hide `base` and `prunable`. The recommendation is to keep them, since a caller may chain a second pipeline by hand.
- Whether the old forest page goes or becomes the preset page (task 10).
