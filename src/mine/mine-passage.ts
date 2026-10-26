import type { Passage } from './passage';

/** A tunnel of a mine. */
export interface MinePassage extends Passage {
  /** `shaft` for the main shaft and `adit` for a tunnel that branches off it or off another adit, in a fishbone. `vein` for a tunnel between two junctions, in a web of veins, and between halls, in room and pillar. `ring` for one of the concentric loops of a ring mine, and `spoke` for a tunnel that joins one ring to the next. `tunnel` for a tunnel that joins a cavern to the mine. */
  kind: 'shaft' | 'adit' | 'vein' | 'ring' | 'spoke' | 'tunnel';
}
