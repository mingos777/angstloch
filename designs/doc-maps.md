# Maps in the docs

Design agreed, not started; waiting for the go-ahead. Delete this file once the feature is done and the rules in `CLAUDE.md` are updated.

## Why

A map shows at a glance what a step or a generator makes, which the option tables do not. Today only `dig-sewers.md`, `dig-catacombs.md` and `place-cell-blocks.md` have maps, and those are annotated diagrams (the sewer's `o` marks an outfall, which is no tile), not output.

## Decisions

- **Generated, code and map both.** An example is data: size, base tile, seed and a list of `{ name, options }` steps, the shape the playground uses. A script runs it through `pipeline`, prints its code with `mapCode` (`demo/map-code.ts`, the code behind **Copy code**) and the map under it, so the code shown is the code that ran. A map made in the playground becomes an example by copying its steps.
- **Markers in the Markdown** tell the script where an example goes; it rewrites what sits between them and leaves the rest of the file alone.
- **`npm run docs:maps`** writes the examples; `npm run docs:maps -- --check` lists the stale ones and exits with 1. `prepublishOnly` runs the check. `check:docs` stays a link check.
- **A change that moves a map** fails the check, and the task that made it runs `docs:maps`; the map diffs are part of the review.
- **Glyphs** are those of `grid.toString()` (`#` wall, `.` floor, `+` door, `"` grass, `T` tree, `=` road, `~` and `≈` water, `%` bridge), documented in `docs/concepts.md`, so a reader gets the same picture from their own map. No colors, so not the playground's roguelike glyphs.
- **Size:** at most 80 columns and about 25 rows on a step or generator page; smaller in the README.
- **Seed 1** for every example. No hunting for a better seed.
- **Before and after** for the steps that join or open what earlier steps made: `digCorridors`, `digVeins`, `openMazeRooms`, `openExits`, `layFootbridges` and `layClearingPaths`. The two maps sit side by side in one block (about 38 columns each), the first after the steps before the last, the second after all of them. Every other step shows the map after it.
- **Beside the hand-written examples.** The generated example is a section of its own; the existing `ts` examples stay, since they show what the generated code cannot (destructuring `roomGroups`, reading the result). Merging them is for later, page by page. The diagrams of sewers, catacombs and cell blocks stay too.
- **The README** gets four small maps (about 60 by 20), each with a one-line caption and a link to its page: a dungeon, a cave, a forest with a river and roads, and a mine with pillar halls or a catacomb. The generator pages in `docs/generators/` get a map each as well.
- **The code needs a seed.** `mapCode` leaves the seed out today (with a comment to add one); it gets an optional seed that writes `random: mulberry32(1)`, with `mulberry32` as defined in the README's quick start.

## Layout

- `scripts/docs-maps.ts`: the runner (`npm run docs:maps`), reading and writing the docs.
- `scripts/doc-examples.ts`: the examples, keyed by the name in their marker.
- The marker rewriting in a tested module of its own, as `find-docs-problems.ts` is.
- The step factories are looked up by name; `demo/step-defs.ts` already maps names to steps, which the script may reuse or mirror. Both `demo/` and `scripts/` are unpublished, so the script may import from `demo/`.

## Tasks

1. **The script.** `docs:maps` with its markers, `--check`, the seed in `mapCode`, the before-and-after layout, `prepublishOnly`, and two or three examples to try it on (one of them before and after).
2. **Every step page** gets its example.
3. **The generator pages and the README** get theirs.
4. **The rules.** `CLAUDE.md`: a new or changed step or generator gets its example in the same task, `docs:maps -- --check` joins the checks before a task report, and the layout and commands list the script. `docs/development.md` lists the command.

The playground does not change, but for the optional seed of `mapCode`.

## Open questions

None.
