/** What a room is: `'room'` for the rooms of every room placement step, templated rooms included, `'cell'` for a cell of a cell block, `'guardRoom'` for the guard room of one, `'pillarHall'` for a hall of `digPillarHalls` and `'cavern'` for a cavern of `digCellularCave` or `digNoiseCave`, `'sewerChamber'` for a junction chamber or a branch head of `digSewers`, `'cistern'` for one of its chambers that holds a basin of water, and `'sewerTunnel'` for a stretch of its canals between them, walkways included. */
export type RoomKind =
  | 'room'
  | 'cell'
  | 'guardRoom'
  | 'pillarHall'
  | 'cavern'
  | 'sewerChamber'
  | 'sewerTunnel'
  | 'cistern';
