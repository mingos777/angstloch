import type { DigNoiseCaveOptions } from '../cave/dig-noise-cave-options';
import type { DigCaveTunnelsOptions } from '../cave/dig-cave-tunnels-options';
import type { BaseOptions } from '../core/base-options';
import type { OpenExitsOptions } from '../exits/open-exits-options';
import type { DigHallVeinsOptions } from './dig-hall-veins-options';
import type { DigFishboneOptions } from './dig-fishbone-options';
import type { DigPillarHallsOptions } from './dig-pillar-halls-options';
import type { DigRingsOptions } from './dig-rings-options';
import type { DigVeinsOptions } from './dig-veins-options';
import type { PlaceMineRoomsOptions } from './place-mine-rooms-options';

/**
 * The options of a mine that are not its size or its randomness: one key per
 * step of the mine, each holding the options of that step. Of the four
 * layouts, `fishbone`, `veins`, `pillars` and `rings`, at most one may be
 * given (`hallVeins` goes with `pillars`); none means `fishbone` with its defaults.
 */
export interface MineStepOptions {
  /** A fishbone layout: a main shaft with side tunnels branching off it and off each other. See `digFishbone`. The layout when no other is given. */
  fishbone?: DigFishboneOptions;
  /** A veins layout: an irregular web of winding tunnels that join junctions spread over the map. See `digVeins`. */
  veins?: DigVeinsOptions;
  /** A pillars layout: a few large halls with islands of wall left standing in them. See `digPillarHalls`. Its veins are `hallVeins`. */
  pillars?: DigPillarHallsOptions;
  /** The veins that join the halls of the pillars layout. See `digHallVeins`. Only used with `pillars`, which it is an error to leave out, and then on by default, with the defaults of that step. */
  hallVeins?: DigHallVeinsOptions;
  /** A rings layout: concentric loops of tunnel joined by spokes. See `digRings`. */
  rings?: DigRingsOptions;
  /** Caverns dug into the rock beside the mine: blobs of floor made like a noise cave, each placed where its floor keeps a wall between it and the mine, as near the mine as it finds. See `digNoiseCave`. Here its `placement` defaults to `beside`, its `area` to sides of 12 to 24 tiles (cut down to the map less its border ring), `scaleX` and `scaleY` to 7 and `largestOnly` to true, so that each cavern is one blob; the rest are the defaults of that step, `count` of 1 among them. Defaults to no caverns. */
  caverns?: DigNoiseCaveOptions;
  /** The tunnels that join the caverns to the mine. See `digCaveTunnels`. Only used when there are `caverns`, and then on by default, with the defaults of that step. `false` leaves the caverns apart. */
  tunnels?: DigCaveTunnelsOptions | false;
  /** Rooms dug into the rock beside the tunnels, templates first, each joined to the mine by a tunnel from every exit it opens. See `placeMineRooms`. Defaults to no rooms. */
  rooms?: PlaceMineRoomsOptions;
  /** Exits on the map border. See `openExits`. Defaults to no exits. */
  exits?: OpenExitsOptions;
}

/** The options of `generateMine`. */
export interface MineOptions extends BaseOptions, MineStepOptions {}
