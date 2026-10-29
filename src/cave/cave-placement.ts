/**
 * Where a cave step puts the area of each cave. `free` puts it on a random spot
 * where the box and a margin of one tile round it are all free. `beside` builds
 * the cave first and puts it where its floor, with a margin of one tile, is
 * free, as near the dug ground as it finds, so that the box may overlap
 * tunnels while the floor never touches them. `overlap` puts it on any spot
 * and lays floor on the free tiles only, so the cave runs into what is there,
 * like a cave-in.
 */
export type CavePlacement = 'free' | 'beside' | 'overlap';
