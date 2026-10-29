# Shore

Design in progress, not started. Delete this file once the feature is done and documented in the README.

## Scope

- **A step, `layShore`**: the sea along one side of the map, a band of shallow water, deep water beyond it, and a band of sand on the land side. `generateForest` gets a `shore` key for it, off by default.
- **The forest steps keep to the land** (approach B): the shore is laid right after `plantTrees`, and the later steps respect it. Laying it last and painting over everything (stale extras) and building the forest steps in areas were rejected.
- **Estuaries and deltas** where a stream meets the sea (see Stream mouths).
- **Terrain preference for templates** (see Templates).
- **Out of scope for now**: islands, sandbars, rocks in the sea, cliffs, the shore in other presets. Islands and sandbars are tempting follow-ups.
- Covers the first half of Shore and beach in `ROADMAP.md`; piers and ports stay there.

## The map

```
TTT.T..T.TT....:::≈≈≈≈≈~~~~~~~
.T..TT.T.....::::≈≈≈≈~~~~~~~~~
T.T...T...:::::≈≈≈≈≈≈≈~~~~~~~~
.TT.T..T..::≈≈≈≈≈≈≈~~~~~~~~~~~
T..T.T.....::::::≈≈≈≈≈~~~~~~~~
   land    sand  shallow  deep
```

- **New tile**: `Sand` 9, drawn as a BrightYellow `.`. Sand clears the trees; none grow on it.
- **The coast**: a 1D noise along the coast places the waterline; the bands are measured as a distance from the waterline, so they keep their width round bays.

## Options of `layShore`

- `angle`: the side of the sea, in degrees clockwise from east, or `'random'` (default). Same convention as a stream's angle, so a stream with the same angle flows into the sea. Angles in between make a diagonal coast with the sea in a corner.
- `reach`: how far the sea reaches into the map from its side, as a `Range` of fractions of the map.
- `windiness`: 0 to 1, how much the waterline wanders (bays and headlands). Default 0.5.
- `shoreWidth`: the shallow band, a `Range` varying along the coast with a slow noise, the same name as the shallow banks of a stream. Default `{ min: 2, max: 4 }`.
- `sandWidth`: the sand, a `Range` varying the same way; a `min` of 0 lets the land meet the water. Default `{ min: 1, max: 4 }`.
- `shallowTile`, `deepTile`, `sandTile`.
- `Verge` (`clearance`, `falloff`, `distance`): thins the trees behind the sand.

The defaults above are a starting point, to be tuned on the playground.

## The result

- `shore: { angle, coast: Point[] }`, with `coast` the waterline from border to border. The later steps rebuild the sea from it, since the grid cannot tell sea from stream.
- `layShore` throws a permanent error when `streams` or `roads` are already in the state.

## The other forest steps

- **Streams** flow into the sea and end at the waterline, their mouth cutting across the sand. Water over the sea is not painted again.
- **Roads** end where the sand starts; such an end is not an exit.
- **Clearings** do nothing to the beach; where they go is the caller's business.
- **Footbridges** only ever cross streams, never the sea. The sea is neither land to reach nor water to bridge. A stream running into the sea splits the land in two, as a border-to-border stream does today, and the footbridges join the halves as they do now.

## Stream mouths

Options of `layStreams`, used only where a stream reaches the sea. A separate step cannot change streams another step laid.

- **Estuary**, `estuary: { length: Range, width: Range }`: the stream widens over its last `length` tiles to `width` at the mouth.
- **Delta**, `delta: { branches: Range, length: Range }`: the stream splits near the mouth into distributaries, each narrower than the stream, that fan out to the sea, with land between them. The distributaries are streams, so the footbridges join the land between them.
- Both are optional. Given both, the river widens first, then splits.
- Only the main stream forms a mouth; tributaries never reach the sea on their own.
- **Angles are the caller's business**: a stream laid along the coast ends where it first touches the sea, however short that leaves it, and random angles may do that.
- **Springs** only ever rise on land.

## Templates

`placeTemplates` gets a terrain preference per template: a `terrain` and an `affinity` from 0 to 1 (named `gravity` in the talk).

- **Terrains**: `grassland` (grass and trees outside clearings), `beach` (sand), `clearing` and `road`. Templates already keep off water, so sea and stream are not terrains to ask for.
- **Read from the grid and the extras** (`shore`, `streams`, `roads`, `clearings`), never from a new mask, through a helper other steps may use later.
- **Affinity**: 1 puts every tile of the template on the terrain (best effort), 0 places it at random as today, and values in between are degrees of preference: the chance of a spot falls with how far the template lies from the terrain (by its tiles off the terrain and their distance to it), faster as the affinity rises. So 0.5 may place it fully or partly on the terrain, 0.25 also just outside it. The exact curve is tuned on the playground.
- A template that finds no spot fails as it does today.

## Open questions

None left before task 1.

## Tasks

1. `Tile.Sand` and the `layShore` step (bands, noisy coast, verge, `shore` extra), on the steps page of the playground; README and CHANGELOG.
2. The `shore` key of `generateForest`; `layStreams` ends at the sea.
3. `layRoads` ends where the sand starts.
4. `layFootbridges` ignores the sea; clearings are left as they are.
5. Estuaries.
6. Deltas.
7. Terrain preference for templates.
