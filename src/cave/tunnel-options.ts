import type { CaveTunnelStyle } from './cave-tunnel-style';

/** The settings that shape the tunnels between caverns. */
export interface TunnelOptions {
  style: CaveTunnelStyle;
  width: number;
  windiness: number;
  borderWalls: boolean;
  /** One byte per tile, 1 for a tile that a tunnel may not dig through or pass. Every tile may be dug when it is left out. */
  blocked?: Uint8Array;
}
