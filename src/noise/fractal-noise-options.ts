export interface FractalNoiseOptions {
  /** Number of layers of noise to add up. 1 is the plain noise. Defaults to 3. */
  octaves?: number;
  /** How much each layer counts against the one before it, from 0 (only the first layer) to 1 (all layers alike). Defaults to 0.5. */
  persistence?: number;
  /** How much finer each layer is than the one before it: its positions are multiplied by this. Defaults to 2. */
  lacunarity?: number;
}
