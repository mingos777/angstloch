/**
 * Where the veins of the `pillars` layout start and end on a hall. Both pick
 * a floor tile on the boundary of the hall, next to rock. `facing` picks it
 * along the side that faces the hall at the other end of the vein, and `edge`
 * picks it on any side.
 */
export type MineHallEntrances = 'facing' | 'edge';
