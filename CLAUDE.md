# Angstloch

Angstloch is a map generator library for roguelike games on a 2D square grid. It is written in modern TypeScript and will be published on NPM for browser-based roguelikes to consume.

**Read `ROADMAP.md` at the start of every session.** It says what is wanted next and what was rejected; finished features are documented in `README.md`, never in the roadmap. Designs in progress live in `designs/`, one Markdown file per feature with its decisions, open questions and task split; read the one for the feature at hand.

## Rules

### Workflow

- **Design first, build when told.** Talk a feature through with options, a recommendation and a list of open questions. Record the decisions and the task split in `designs/<feature>.md`, not in `ROADMAP.md`, which only lists what is wanted. Delete the design file once the feature is done and documented in the README. Do not start implementing until the user says so, even when their answers to the design questions seem to settle everything.
- **One task at a time.** Split a feature into small tasks. Stop after each one with a short report (what changed, what the tests cover, anything that surprised you) and let the user review it.
- **The playground follows every task.** Each task that adds or changes behavior also extends `demo/`, so the user can see it and react before the next task builds on it.
- **Defaults are the user's call.** They tune defaults by looking at the playground, and many defaults in the README came from that, so do not change them unasked.
- **Playground colors** come from the `Color` constant in `demo/draw-grid.ts`, the ANSI terminal palette of the user's game. Keep the glyph colors listed in the README in sync with `GLYPHS` there, and do not overwrite the user's choices.
- **American English** in code, identifiers, comments, error messages and docs (center, color, behavior), although the user writes British English.
- Before reporting a task as done, run `npm run typecheck`, `npm run lint`, `npm run format:check` and `npm test`; after the first release, also `npm run check:version`.

### Git

- **Never commit, push, or otherwise modify git history.** The user reviews every task and commits on their own. Moving files with plain `mv` is fine.
- **Never tag or publish.** The user tags a release (`v1.0.0`) and publishes it to npm.

### Code style

- 2 space indents.
- Terminate lines with semicolons.
- Single quotes. Prettier and ESLint enforce this; run `npm run format` and `npm run lint`.
- kebab-case filenames; the single export is named after the file (`resolve-random.ts` exports `resolveRandom`).
- 1 export per file, unless reasonable to ignore (e.g. a bunch of related constants). `src/index.ts` is the public API barrel and is exempt.
- TypeScript is strict, including `noUncheckedIndexedAccess` (matters for grid indexing).

### Step naming

A step is named `verb` + what it makes, and the verb tells the **job**, never the method. The method goes into the noun (`digCellularCave`, `digNoiseCave`, `placeScatteredRooms`), so the name says what algorithm runs and what comes out. One step per variant (see Steps), so a new variant is a new noun, not a mode. Pick the verb from this list for every new step, and add a row here only when none fits:

| Verb    | Job                                                  | Steps                                                                                                                                                            |
| ------- | ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `dig`   | turns rock into floor (caves, tunnels, mazes, halls) | `digCellularCave`, `digNoiseCave`, `digFishbone`, `digVeins`, `digPillarHalls`, `digRings`, `digMaze`, `digCorridors`                                            |
| `place` | puts a discrete, bounded thing at a position         | `placeScatteredRooms`, `placePartitionedRooms`, `placeClusteredRooms`, `placeCellBlocks`, `placeMazeRooms`, `placeMineRooms`, `placeClearings`, `placeTemplates` |
| `lay`   | lays a linear feature across the terrain             | `layStreams`, `layRoads`, `layClearingPaths`, `layFootbridges`                                                                                                   |
| `open`  | makes an entrance or an exit (always, and only this) | `openExits`, `openMazeRooms`                                                                                                                                     |
| `plant` | covers the ground (the one exception)                | `plantTrees`                                                                                                                                                     |

- The files, options and tests follow the step: `dig-noise-cave.ts`, `DigNoiseCaveOptions`, `assertDigNoiseCaveOptions`.
- Never use `add`, `carve`, `grow`, `scatter`, `partition` or `generate` as the verb of a step. `generateX` is for presets only.
- The code that does the work under a step is not a step, so it must not use a step verb for the same thing: `buildStreams`, `buildRoads`, `buildClearingPaths` and `buildFootbridges` sit under `layStreams` and the rest. Helpers keep their own verbs (`carvePassage`, `carveCaveExit`).

### Tooling

- npm is the package manager. Node 22 (`.nvmrc`).
- Vite is the bundler (library mode, ESM only).
- Vitest is the test runner.
- ESLint (flat config, `strictTypeChecked`) plus Prettier.

### Testing

- All logic is covered by unit tests, colocated as `*.test.ts` next to the source.
- Coverage threshold is 80% (lines, functions, branches, statements), enforced by `npm test`. Don't chase 100%.
- Test one behavior per test.
- Structure each test body with `// given`, `// when` and `// then` comments separating the setup, the action and the assertions.

### Versioning

Until the first release, `package.json` stays at `0.0.0` and only the changelog is kept. After the user tags `v1.0.0`, `package.json` holds the **next** version to publish and the latest git tag holds the last one released, so the version only ever moves up between releases.

- **Levels.** Patch: a fix, a changed default (the old behavior is one option away), a README-only correction. Minor: something added (a step, an export, an optional field, a `Tile` value). Major: anything that breaks code written against the previous version (an option or result field removed, renamed or changed in meaning, a `Tile` renumbered, an export removed). A major bump needs the user's go-ahead.
- **Only what ships counts:** `src/` (behavior, options, types, defaults) and the README. Demo, scripts, tests, designs and the other docs never bump the version or the changelog.
- **The ratchet.** A task that changes what ships raises the version only if its level beats the pending one (the difference between `package.json` and the tag; `1.0.0` is none, `1.0.1` patch, `1.1.0` minor, `2.0.0` major). A bump resets the lower numbers (a feature on `1.0.3` gives `1.1.0`).
- **`CHANGELOG.md`** is in the Keep a Changelog layout: `Unreleased` on top, then one section per released version (`## 1.0.0 - 2026-11-01`), with entries under Added, Changed, Fixed and Removed. Every task that changes what ships adds its entries in the same task, like the README. An entry of a major change starts with **Breaking:**, and a Removed entry counts as major.
- **Release.** When the user says so, rename `Unreleased` to the version and the date, and put a new empty `Unreleased` on top. The user tags and publishes.
- **Flag discrepancies.** Run `npm run check:version` at the start of a session and before reporting a task that touches what ships, and report what it lists. End such a task report with a line like `Version: 1.1.0 pending (minor: new step)`.

### Documentation

- `README.md` is the page npmjs shows to the world. Every time something is implemented or changed, document it there in the same task, and in `CHANGELOG.md` (see Versioning). The tool must be documented accurately and thoroughly: options, defaults, result shape and examples. Check the README still matches the code.

### Library design

- No runtime dependencies. Core code must not use DOM or Node APIs, so it runs in a browser, Node, or a web worker.
- Determinism: never call `Math.random` directly in generator code. Generators accept an injected `Random` (`() => number` returning a float in [0, 1), same contract as `Math.random`), resolved via `resolveRandom`, which defaults to `Math.random`. Users can plug in any PRNG (mulberry32, etc.).
- API contract: each generator is a function `generateX(options: XOptions)` taking a single options object. `width` and `height` are required; `random?: Random` and all algorithm-specific fields are optional with documented defaults. Each algorithm has its own typed options interface extending a shared base (`width`, `height`, `random`); never use `any`. Angstloch has never been released, so there is no external contract yet: options and results may change or go when the design calls for it. Once it is published, anything may change, and a breaking change is a major version (see Versioning). Generators are pure: no global state, no mutation of the caller's options. Invalid dimensions (non-positive or non-integer) throw a `RangeError`.
- Data model: maps are a `Grid` (flat `Uint8Array`, `get`/`set`/`inBounds`/`clone`/`toString`). `Tile` values are part of the contract: `Wall` 0, `Floor` 1, `Door` 2 (a potential door placement), `Grass` 3, `Tree` 4, `Road` 5, `ShallowWater` 6, `DeepWater` 7, `Bridge` 8. Add new values, never renumber. Positions are plain `{ x, y }` (`Point`), y grows downwards. `Grid#get` outside the grid returns `Wall`; `set` outside throws.
- Results: generators never mutate their inputs and return a result object (`{ grid, ...extras }`), never a bare grid. Extras describe the map, e.g. a dungeon reports its rooms (count, position, dimensions), a maze reports `start` and `exits`. Composing a map from several parts is done with steps and `pipeline`; combining separate maps is left to the caller.
- Only a single `Random` float is injected. Derive integers and picks with the shared helpers (`randomInt`, `pickRandom`).
- Steps: `pipeline(emptyMap(...), [steps], options)` builds a map from an empty base and named steps (`step`).
  - **A step** changes `grid`, `prunable` and `reserved` of the `MapState` in place and returns the extras it adds. The pipeline merges the extras, checks the order of the steps against what they need (`needs`, `adds`), calls each step's `validate` once on the base, and retries from a fresh base when a step throws (3 attempts; a `TemplatePlacementError` marked `permanent` is thrown at once). Results report `attempts` and `failures`.
  - **Every generator is a preset**: a composition of public steps, listed by an internal `createXSteps(options)` (for the playground and the scripts), with nested options, one key per step. `generateForest` (`plantTrees`, `layStreams`, `layRoads`, `placeClearings`, `placeTemplates`, `layClearingPaths` under `paths`, `layFootbridges`); `generateCave` and `generateNoiseCave` (`digCellularCave` or `digNoiseCave` under `cave`, then `digVeins` under `tunnels` (with a width of 1 and a `density` of 0 as the preset's own defaults) and `openExits` under `exits`); `generateMine` (one layout of `digFishbone`, `digVeins`, `digPillarHalls` with `digVeins` under `hallVeins`, or `digRings`, then `digNoiseCave` with `placement: 'beside'` and `digVeins` for `caverns`, `placeMineRooms` and `openExits`); `generateMaze` (`placeMazeRooms`, which places and reserves the rooms unopened, `digMaze`, `openMazeRooms` under `openings`, and `openExits`); `generateRoomDungeon` (`placeScatteredRooms`, or `placePartitionedRooms` when `partition` is given, then `digCorridors`) and `generateDigDungeon` (`placeClusteredRooms` then `digCorridors`), both through `runDungeonSteps`. The three room placement steps share the core `roomPlacementStep`, and `digCorridors` wraps the dungeon builder through `joinRooms`.
  - **No config inheritance:** settings that enter a step never leave it. A preset passes each key straight to its step, with that step's own defaults, and never fills one step's options from another key (no `placement` or `symmetry` from the rooms to the corridors, no `keepClear` from `maze.start`, no road tiles for the paths); the caller gives each step what it needs.
  - **Hidden state** is rebuilt from the extras, or from the grid and the `reserved` mask, never passed privately between steps.
  - **The `reserved` mask** (`Reserve`: `None`, `Solid`, `Openable`): room steps reserve their shapes, `Openable` on their potential exits; no step digs a reserved tile, and every step that opens an exit calls `openReserved`. Rooms of every kind carry a shape in the `roomShapes` extra; whether a room is templated is told by `Room.template`, never by having a shape.
  - **Features and rooms:** halls, caverns and mines are features, never in `rooms`. Feature and room steps take an `area` (and most a `count`), built on a scratch map through `placeAreas` and `buildInArea`; the cave steps also take a `placement` (`free`, `beside` or `overlap`). `digCorridors` joins every piece of floor outside the rooms' shapes as a stand-in room (`findStandIns`), never dropped and never in `rooms`, `digVeins` is the mine's and the cave's `digCorridors`: it joins every piece of open ground, rooms through an `Openable` tile it opens, halls and caverns on their boundary, with veins routed through free rock around them (`findPieces`, `findPiecePorts`, `growVeinNetwork`).
  - **Verges:** every outdoor feature step prunes its own verge, through the shared `Verge` and `pruneVerge`.
- Scope: mazes, dungeons (room-first and grown), caves (cellular automaton and noise), forests with roads, streams and rivers, and mines (four layouts) exist, all on steps. Towns, water and the rest of the plans are in `ROADMAP.md`.
- Reference material: the previous attempt lives in `../angstloch-old` (only the maze generator was finished) and rot.js 2.2.1 in `../ur/node_modules/rot-js`. Reimplement algorithms our way instead of copying code.

## Layout

- `src/`: library source; `src/index.ts` is the public entry point. Tests sit next to their sources. Directories, with imports only pointing down the list (`dungeon` may also use `maze`, `forest/` uses `noise/`, `roads/` and `streams/`, `cave/` uses `veins/`, and `mine/` uses `noise/`, `roads/`, `veins/` and the cave steps of `cave/`; `pipeline/` sits right under `core/`, so any directory below it may use it):
  - `core/`: grid, tiles, points, ranges, randomness helpers, option assertions.
  - `pipeline/`: `MapState`, `step`, `emptyMap`, `stampTile` and `pipeline`, the machinery of composable steps, plus the helpers any step may use: the `reserved` mask (`reserveTile`, `openReserved`, `isFree`, `findNearestOpenable`, `joinTouchingPieces`) and areas (`placeAreas`, `placeBeside`, `buildInArea`). It only uses `core/`, so it spots a permanent `TemplatePlacementError` by its `permanent` field and does not import it.
  - `rooms/`: code shared by mazes, mines and dungeons: room plans and their placers (scatter, partition, grow), room shapes and their reserving, corridor symmetry and the shared dungeon options. `rooms/templates/` holds the room templates.
  - `exits/`: `openExits`, the step that carves exits into the border, and the carving code under it (`carveCaveExit`). It sits right under `rooms/`, since it mirrors exits with the transforms of `rooms/templates/`, and uses `core/`, `pipeline/` and `rooms/`. Maze, cave and mine use it.
  - `noise/`: noise functions (simplex, fractal) for outdoor generators. It only uses `core/`.
  - `roads/`: roads and paths laid over outdoor maps. It uses `core/` and `noise/`.
  - `streams/`: streams and rivers laid over outdoor maps, and the bending of roads to cross them. It uses `core/`, `noise/` and `roads/`.
  - `veins/`: `digVeins`, the step that joins every piece of open ground with veins routed through free rock, and the code under it (`growVeinNetwork`, `findPieces`, `findPiecePorts`, `digRoutedVein`, the passage types and `dig-vein`). It uses `core/`, `pipeline/`, `noise/` and `roads/`. Mine and cave use it. Its tests may build maps with steps from the layers above.
  - `maze/`, `dungeon/` (room-first and grown), `cave/`, `forest/` and `mine/`: the steps of one family each, and its presets, with `generate-*.ts` as the entry point and `create-*-steps.ts` listing the steps.
  - `test-helpers/`: seedable PRNG and dungeon checks for tests.
- `demo/`: visual playground, run with `npm run dev`. Not published. The steps page (`steps.html`, with `step-defs.ts` and `step-fields.ts`) is the pipeline-based page: a list of steps to add and configure. Every generator is made there, and the template editor (`template-editor.ts`) sits at the bottom of it; the noise page stays as the only other page. `index.html` only links to the pages.
- `scripts/`: development scripts, run through Vite's `runnerImport`. Not published. `check-forest.ts` scores forests with roads and streams for artifacts over many seeds, using `createForestSteps` and `pipeline` with `trace`. `check-dungeon.ts` measures the failures, time and look of the room-first and grown dungeons over many seeds, and the failures and time of rooms scattered round a pillar hall and a noise cavern. `check-version.ts` compares `package.json`, the latest git tag and `CHANGELOG.md` (the rules sit in `find-version-problems.ts`, which has the only tests in `scripts/`; `node-modules.d.ts` declares the Node modules the scripts import, since the project has no `@types/node`).
- `designs/`: designs in progress, one Markdown file per feature. Not published.
- `dist/`: build output (gitignored).

## Commands

- `npm run dev`: start the playground.
- `npm run build`: build the library to `dist/`.
- `npm test`: run unit tests with coverage (`npm run test:watch` for watch mode).
- `npm run typecheck`, `npm run lint`, `npm run format` / `format:check`.
- `npm run check:forest`: count the road and stream artifacts over seeds 1 to 200 (`-- --seeds 6,9 --show` prints the maps).
- `npm run check:version`: list what disagrees between `package.json`, the latest git tag and `CHANGELOG.md`; exits with 1 when something does.
- `npm run check:dungeon`: measure the dungeons over seeds 1 to 200 (`-- --templates 15,20 --placement lattice` for other loads).
