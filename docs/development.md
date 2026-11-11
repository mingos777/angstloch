# Development

To work on Angstloch itself, clone the repository and install its development dependencies with `npm install`. It needs Node 22 (see `.nvmrc`).

```
npm run dev            # the playground, see playground.md
npm run build          # build the library to dist/
npm test               # unit tests with coverage
npm run typecheck
npm run lint
npm run format         # or format:check
npm run check:version  # what disagrees between package.json, the latest tag and CHANGELOG.md
npm run check:docs     # broken links in README.md and docs/
npm run check:package  # build, pack and install the package, typecheck and run a program against it
npm run docs:maps      # write the example maps of the docs (-- --check lists the stale ones)
npm run check:forest   # road and stream artifacts of forests over many seeds
npm run check:dungeon  # failures, time and look of dungeons over many seeds
```

The [playground](playground.md) shows every generator and step on screen.

`npm run check:package` tests the package as a consumer gets it: it installs the packed tarball into a scratch project in the system's temporary directory, typechecks a small program against it with `moduleResolution` set to `bundler` and to `nodenext`, and runs it. The build bundles the declarations into one `dist/index.d.ts` (`bundleTypes` in `vite.config.ts`), since declarations that import each other without file extensions do not resolve under `nodenext`. `prepublishOnly` runs every check above and ends with this one.

## Example maps

The maps in the README and in the pages of the generators and steps are generated. Each one is an example in `scripts/doc-examples.ts`, a list of steps with their options or a preset with its options, and a page marks where it goes with a pair of comments:

```
<!-- map: dig-corridors -->
<!-- /map -->
```

`npm run docs:maps` runs every example with seed 1 and writes its code and its map between the markers, leaving the rest of the page alone. A change that moves a map shows up as a diff of the page; `npm run docs:maps -- --check`, which `prepublishOnly` runs, fails while a map is stale. A map made in the playground becomes an example by copying its steps and their options.
