# Angstloch

Angstloch is a map generator library for roguelike games on a 2D square grid. It is written in modern TypeScript and will be published on NPM for browser-based roguelikes to consume.

**Read `ROADMAP.md` at the start of every session.** It says where the library stands, what is planned next, the design decisions behind the plans, and what was rejected.

## Rules

### Workflow

- **Design first, build when told.** Talk a feature through with options, a recommendation and a list of open questions. Record the decisions. Do not start implementing until the user says so, even when their answers to the design questions seem to settle everything.
- **One task at a time.** Split a feature into small tasks. Stop after each one with a short report (what changed, what the tests cover, anything that surprised you) and let the user review it.
- **The playground follows every task.** Each task that adds or changes behavior also extends `demo/`, so the user can see it and react before the next task builds on it.
- **Defaults are the user's call.** They tune defaults by looking at the playground, and many defaults in the README came from that, so do not change them unasked.
- **Playground colors** come from the `Color` constant in `demo/draw-grid.ts`, the ANSI terminal palette of the user's game. Keep the glyph colors listed in the README in sync with `GLYPHS` there, and do not overwrite the user's choices.
- **American English** in code, identifiers, comments, error messages and docs (center, color, behavior), although the user writes British English.
- Before reporting a task as done, run `npm run typecheck`, `npm run lint`, `npm run format:check` and `npm test`.

### Git

- **Never commit, push, or otherwise modify git history.** The user reviews every task and commits on their own. Moving files with plain `mv` is fine.

### Code style

- 2 space indents.
- Terminate lines with semicolons.
- Single quotes. Prettier and ESLint enforce this; run `npm run format` and `npm run lint`.
- kebab-case filenames; the single export is named after the file (`resolve-random.ts` exports `resolveRandom`).
- 1 export per file, unless reasonable to ignore (e.g. a bunch of related constants). `src/index.ts` is the public API barrel and is exempt.
- TypeScript is strict, including `noUncheckedIndexedAccess` (matters for grid indexing).

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

### Documentation

- `README.md` is the page npmjs shows to the world. Every time something is implemented or changed, document it there in the same task. The tool must be documented accurately and thoroughly: options, defaults, result shape and examples. Check the README still matches the code.

### Library design

- No runtime dependencies. Core code must not use DOM or Node APIs, so it runs in a browser, Node, or a web worker.
- Determinism: never call `Math.random` directly in generator code. Generators accept an injected `Random` (`() => number` returning a float in [0, 1), same contract as `Math.random`), resolved via `resolveRandom`, which defaults to `Math.random`. Users can plug in any PRNG (mulberry32, etc.).
- API contract: each generator is a function `generateX(options: XOptions)` taking a single options object. `width` and `height` are required; `random?: Random` and all algorithm-specific fields are optional with documented defaults. Each algorithm has its own typed options interface extending a shared base (`width`, `height`, `random`); never use `any`. Angstloch has never been released, so there is no external contract yet: options and results may change or go when the design calls for it (the move to composable steps, see `ROADMAP.md`). Once it is published, adding optional fields will be fine, but existing ones must not change or go. Generators are pure: no global state, no mutation of the caller's options. Invalid dimensions (non-positive or non-integer) throw a `RangeError`.
- Data model: maps are a `Grid` (flat `Uint8Array`, `get`/`set`/`inBounds`/`clone`/`toString`). `Tile` values are part of the contract: `Wall` 0, `Floor` 1, `Door` 2 (a potential door placement), `Grass` 3, `Tree` 4, `Road` 5, `ShallowWater` 6, `DeepWater` 7, `Bridge` 8. Add new values, never renumber. Positions are plain `{ x, y }` (`Point`), y grows downwards. `Grid#get` outside the grid returns `Wall`; `set` outside throws.
- Results: generators never mutate their inputs and return a result object (`{ grid, ...extras }`), never a bare grid. Extras describe the map, e.g. a dungeon reports its rooms (count, position, dimensions), a maze reports `start` and `exits`. Composing a map from several parts is done with steps and `pipeline` (planned, see `ROADMAP.md`); combining separate maps is left to the caller.
- Only a single `Random` float is injected. Derive integers and picks with the shared helpers (`randomInt`, `pickRandom`).
- Steps: `pipeline(emptyMap(...), [steps], options)` builds a map from an empty base and named steps (`step`), each of which changes `grid` and `prunable` of the `MapState` in place and returns the extras it adds. The pipeline merges the extras, checks the order of the steps against what they need, and retries from a fresh base when a step throws. The forest is the pilot and is being moved onto it, task by task (`plantTrees`, `addStreams`, `addRoads`, `placeClearings` and the shared `Verge` with `pruneVerge` exist so far; every feature step prunes its own verge) (see `generator-pipelines-plan.md` and `ROADMAP.md`); the other generators stay as they are.
- Scope: mazes, dungeons, caves, forests, roads, streams and rivers, and mines (the fishbone layout) exist. Towns, water and the rest of the plans are in `ROADMAP.md`.
- Reference material: the previous attempt lives in `../angstloch-old` (only the maze generator was finished) and rot.js 2.2.1 in `../ur/node_modules/rot-js`. Reimplement algorithms our way instead of copying code.

## Layout

- `src/`: library source; `src/index.ts` is the public entry point. Tests sit next to their sources. Directories, with imports only pointing down the list (`dungeon` may also use `maze`, `forest/` uses `noise/`, `roads/` and `streams/`, and `mine/` uses `noise/`, `roads/` and the exit code and noise cave generator of `cave/`; `pipeline/` sits right under `core/`, so any directory below it may use it):
  - `core/`: grid, tiles, points, ranges, randomness helpers, option assertions.
  - `pipeline/`: `MapState`, `step`, `emptyMap`, `stampTile` and `pipeline`, the machinery of composable steps. It only uses `core/`, so it spots a permanent `TemplatePlacementError` by its `permanent` field and does not import it.
  - `rooms/`: code shared by mazes and dungeons: room placement, room plans, symmetry options and the shared dungeon options. `rooms/templates/` holds the room templates.
  - `noise/`: noise functions (simplex, fractal) for outdoor generators. It only uses `core/`.
  - `roads/`: roads and paths laid over outdoor maps. It uses `core/` and `noise/`.
  - `streams/`: streams and rivers laid over outdoor maps, and the bending of roads to cross them. It uses `core/`, `noise/` and `roads/`.
  - `maze/`, `dungeon/` (room-first and digger), `cave/`, `forest/` and `mine/`: one generator each, with `generate-*.ts` as the entry point.
  - `test-helpers/`: seedable PRNG and dungeon checks for tests.
- `demo/`: visual playground, run with `npm run dev`. Not published.
- `scripts/`: development scripts, run through Vite's `runnerImport`. Not published. `check-forest.ts` scores forests with roads and streams for artifacts over many seeds.
- `dist/`: build output (gitignored).

## Commands

- `npm run dev`: start the playground.
- `npm run build`: build the library to `dist/`.
- `npm test`: run unit tests with coverage (`npm run test:watch` for watch mode).
- `npm run typecheck`, `npm run lint`, `npm run format` / `format:check`.
- `npm run check:forest`: count the road and stream artifacts over seeds 1 to 200 (`-- --seeds 6,9 --show` prints the maps).
