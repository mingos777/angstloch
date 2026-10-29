import type { MapState } from './map-state';

/** Makes a new, untouched map state. A pipeline calls it once per attempt. */
export type MapBase = () => MapState;
