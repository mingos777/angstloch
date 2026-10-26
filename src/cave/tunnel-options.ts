import type { CaveTunnelStyle } from './cave-connection-options';

/** The settings that shape the tunnels between caverns. */
export interface TunnelOptions {
  style: CaveTunnelStyle;
  width: number;
  windiness: number;
  borderWalls: boolean;
}
