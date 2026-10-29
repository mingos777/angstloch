import type { DigVeinsOptions } from '../veins/dig-veins-options';

/** What the tunnels of the cave and mine presets start from: single-width veins that join the caverns and dig nothing more. The `tunnels` key overrides it. */
export const CAVE_TUNNEL_DEFAULTS: DigVeinsOptions = {
  veinWidth: { min: 1, max: 1 },
  density: 0,
};
