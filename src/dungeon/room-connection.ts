/**
 * How rooms are joined by corridors: `nearest` links the closest rooms first,
 * and `bsp` joins them the way a BSP dungeon does, by cutting the rooms in two
 * again and again and linking the two sides of every cut by their closest
 * rooms. `bsp-random` does the same, with a random room on each side of a cut.
 */
export type RoomConnection = 'nearest' | 'bsp' | 'bsp-random';
