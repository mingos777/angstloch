/** Tiles of rock behind the wall at a mouth, reserved `Solid` so that no corridor is dug right behind it. */
export const MOUTH_ROCK = 2;

/** Tiles of rock between the floor of two parts of a sewer that do not meet, so that a wall, a corridor and a wall fit between them. */
export const SEWER_GAP = 3;

/** The smallest size of an area along its trunk: the rock and the wall behind each mouth, and four tiles of canal, so that a bridge fits between its ends. */
export const MIN_SEWER_ALONG = 2 * (MOUTH_ROCK + 1) + 4;

/** The smallest size of an area across its trunk: a canal of one tile with a walkway and a wall on each side. */
export const MIN_SEWER_ACROSS = 5;
