/**
 * Which part of the noise becomes floor: `blobs` takes the high part, which
 * makes rounded caverns, and `veins` takes the part nearest the midpoint of
 * the noise, which makes winding corridors.
 */
export type NoiseCaveShape = 'blobs' | 'veins';
