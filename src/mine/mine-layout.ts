/**
 * The overall shape of a mine. `fishbone` is a straight main shaft with side
 * tunnels branching off it and off each other, as dug when exploring for ore.
 * `veins` is an irregular web of winding tunnels that join junctions spread
 * over the map, as dug when following the veins of an ore. `pillars` is a few
 * large halls with islands of wall left standing in them, joined by tunnels,
 * as dug in a coal seam. `rings` is concentric loops of tunnel joined by spokes.
 */
export type MineLayout = 'fishbone' | 'veins' | 'pillars' | 'rings';
