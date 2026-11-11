# Changelog

All notable changes to Angstloch are listed here, newest first. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the version numbers follow [Semantic Versioning](https://semver.org/).

## Unreleased

### Added

Initial release; see the [documentation](docs/README.md).

- Generators: mazes, room-first and grown dungeons, cellular and noise caves, mines (fishbone, veins, pillar halls, rings) and forests.
- Composable steps (`pipeline`), including prison cell blocks, sewers and catacombs.
- Room templates, exits, symmetry and areas.
- Walking distances.
- Seedable: an injected `Random` gives the same map for the same seed.
- No runtime dependencies, ESM only.
