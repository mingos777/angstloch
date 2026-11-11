import { Tile } from '../src';
import { FOREST_TEMPLATES } from '../demo/forest-templates';
import type { DocExample } from './doc-example';

const ruin = FOREST_TEMPLATES.ruin;
if (!ruin) {
  throw new Error('The playground has no ruin template.');
}

/** The size of a map in the README. */
const README = { width: 60, height: 20 };

/** The size of a map on a step or generator page. */
const PAGE = { width: 80, height: 25 };
/** The size of a maze on a step page, odd for the lattice. */
const MAZE = { width: 79, height: 25 };
/** The size of each of the maps before and after, side by side. */
const HALF = { width: 38, height: 22 };
/** The size of each of the mazes before and after, side by side. */
const HALF_MAZE = { width: 37, height: 21 };

const ROCK = { ...PAGE, tile: Tile.Wall };
const GRASS = { ...PAGE, tile: Tile.Grass };
const HALF_ROCK = { ...HALF, tile: Tile.Wall, beforeAfter: true };
const HALF_GRASS = { ...HALF, tile: Tile.Grass, beforeAfter: true };

/**
 * The maps of the docs, keyed by the name in their marker
 * (`<!-- map: dig-corridors -->`). Run `npm run docs:maps` after a change.
 */
export const DOC_EXAMPLES: Record<string, DocExample> = {
  'dig-catacombs': { ...ROCK, steps: [{ name: 'digCatacombs' }] },
  'dig-cellular-cave': { ...ROCK, steps: [{ name: 'digCellularCave' }] },
  'dig-corridors': {
    ...HALF_ROCK,
    steps: [{ name: 'placeScatteredRooms' }, { name: 'digCorridors' }],
  },
  'dig-fishbone': { ...ROCK, steps: [{ name: 'digFishbone' }] },
  'dig-maze': { ...MAZE, tile: Tile.Wall, steps: [{ name: 'digMaze' }] },
  'dig-noise-cave': { ...ROCK, steps: [{ name: 'digNoiseCave' }] },
  'dig-pillar-halls': { ...ROCK, steps: [{ name: 'digPillarHalls' }] },
  'dig-rings': { ...ROCK, steps: [{ name: 'digRings' }] },
  'dig-sewers': { ...ROCK, steps: [{ name: 'digSewers' }] },
  'dig-veins': {
    ...HALF_ROCK,
    steps: [{ name: 'placeScatteredRooms' }, { name: 'digVeins' }],
  },
  'lay-clearing-paths': {
    ...HALF_GRASS,
    steps: [
      { name: 'plantTrees' },
      { name: 'layRoads' },
      {
        name: 'placeClearings',
        options: {
          clearings: [{ radiusX: { min: 4, max: 4 }, path: { width: 1 } }],
        },
      },
      { name: 'layClearingPaths' },
    ],
  },
  'lay-footbridges': {
    ...HALF_GRASS,
    steps: [
      { name: 'plantTrees' },
      { name: 'layStreams', options: { width: { min: 2, max: 3 } } },
      { name: 'layFootbridges', options: { minimum: 2 } },
    ],
  },
  'lay-roads': {
    ...GRASS,
    steps: [{ name: 'plantTrees' }, { name: 'layRoads' }],
  },
  'lay-streams': {
    ...GRASS,
    steps: [{ name: 'plantTrees' }, { name: 'layStreams' }],
  },
  'open-exits': {
    ...HALF_ROCK,
    steps: [
      { name: 'digCellularCave' },
      { name: 'openExits', options: { count: { min: 2, max: 3 } } },
    ],
  },
  'open-maze-rooms': {
    ...HALF_MAZE,
    tile: Tile.Wall,
    beforeAfter: true,
    steps: [
      { name: 'placeMazeRooms', options: { roomCount: { min: 2, max: 3 } } },
      { name: 'digMaze' },
      { name: 'openMazeRooms' },
    ],
  },
  'place-cell-blocks': { ...ROCK, steps: [{ name: 'placeCellBlocks' }] },
  'place-clearings': {
    ...GRASS,
    steps: [
      // thick woods, for the clearings to show
      { name: 'plantTrees', options: { density: { min: 0.3, max: 0.6 } } },
      { name: 'layRoads' },
      {
        name: 'placeClearings',
        options: {
          clearings: [
            { radiusX: { min: 4, max: 7 } },
            { radiusX: { min: 4, max: 7 } },
          ],
        },
      },
    ],
  },
  'place-clustered-rooms': {
    ...ROCK,
    steps: [{ name: 'placeClusteredRooms' }],
  },
  'place-maze-rooms': {
    ...MAZE,
    tile: Tile.Wall,
    steps: [
      { name: 'placeMazeRooms', options: { roomCount: { min: 3, max: 5 } } },
    ],
  },
  'place-mine-rooms': {
    ...ROCK,
    steps: [{ name: 'digFishbone' }, { name: 'placeMineRooms' }],
  },
  'place-partitioned-rooms': {
    ...ROCK,
    steps: [{ name: 'placePartitionedRooms' }],
  },
  'place-scattered-rooms': {
    ...ROCK,
    steps: [{ name: 'placeScatteredRooms' }],
  },
  'place-templates': {
    ...GRASS,
    steps: [
      { name: 'plantTrees' },
      { name: 'placeTemplates', options: { templates: [ruin] } },
    ],
  },
  'plant-trees': { ...GRASS, steps: [{ name: 'plantTrees' }] },
  'generate-cave': { generator: 'generateCave', options: { ...PAGE } },
  'generate-dig-dungeon': {
    generator: 'generateDigDungeon',
    options: { ...PAGE },
  },
  'generate-forest': {
    generator: 'generateForest',
    options: { ...PAGE, streams: {}, roads: {} },
  },
  'generate-maze': { generator: 'generateMaze', options: { ...MAZE } },
  'generate-mine': { generator: 'generateMine', options: { ...PAGE } },
  'generate-noise-cave': {
    generator: 'generateNoiseCave',
    options: { ...PAGE },
  },
  'generate-room-dungeon': {
    generator: 'generateRoomDungeon',
    options: { ...PAGE },
  },
  'readme-cave': {
    generator: 'generateCave',
    options: { ...README },
    mapOnly: true,
  },
  'readme-dungeon': {
    generator: 'generateRoomDungeon',
    options: { ...README },
    mapOnly: true,
  },
  'readme-forest': {
    generator: 'generateForest',
    options: { ...README, streams: { width: { min: 2, max: 3 } }, roads: {} },
    mapOnly: true,
  },
  'readme-mine': {
    generator: 'generateMine',
    options: { ...README, pillars: {} },
    mapOnly: true,
  },
};
