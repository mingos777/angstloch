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
npm run check:forest   # road and stream artifacts of forests over many seeds
npm run check:dungeon  # failures, time and look of dungeons over many seeds
```

The [playground](playground.md) shows every generator and step on screen.
