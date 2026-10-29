/**
 * Where a vein starts on a piece of floor, such as a hall. Both pick a tile
 * on its boundary, next to rock. `facing` picks it along the side that faces
 * the part of the network at the other end of the vein, and `edge` picks it on
 * any side.
 */
export type MineHallEntrances = 'facing' | 'edge';
