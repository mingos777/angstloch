/** What a room is: `'room'` for the rooms of every room placement step, templated rooms included, `'cell'` for a cell of a cell block, `'guardRoom'` for the guard room of one, `'pillarHall'` for a hall of `digPillarHalls` and `'cavern'` for a cavern of `digCellularCave` or `digNoiseCave`. */
export type RoomKind = 'room' | 'cell' | 'guardRoom' | 'pillarHall' | 'cavern';
