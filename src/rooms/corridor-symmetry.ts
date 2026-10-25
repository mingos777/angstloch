/**
 * The patterns that corridors can follow around the center of the map:
 * `whirlpool` twirls them around it, `snowflake` makes them radiate from it.
 * Mazes use the same patterns.
 */
export type CorridorSymmetry = 'none' | 'whirlpool' | 'snowflake';
