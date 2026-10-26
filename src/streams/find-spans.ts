/**
 * Finds the tiles of a crossing that span the water. A bridge is a group of
 * tiles of `crossing` over water that touch along edges, and it spans the
 * water when it joins two different pieces of land, those that the water
 * cuts the map into: land on both banks of a stream, say. A road that only
 * clips the bank, or runs along it, or ends in the water, touches one piece
 * of land at most, and spans nothing. A bridge that spans is kept whole, so
 * that it is as wide as the road, even where a lane of it ends in the water.
 * Both arrays hold one byte per tile, row by row. Returns one byte per tile,
 * 1 where a tile of the crossing belongs to a bridge that spans the water.
 */
export function findSpans(
  water: Uint8Array,
  crossing: Uint8Array,
  mapWidth: number,
  mapHeight: number,
): Uint8Array {
  const neighbors = (at: number) => {
    const x = at % mapWidth;
    const y = Math.floor(at / mapWidth);
    return [
      [x - 1, y],
      [x + 1, y],
      [x, y - 1],
      [x, y + 1],
    ].flatMap(([nx, ny]) =>
      nx !== undefined &&
      ny !== undefined &&
      nx >= 0 &&
      ny >= 0 &&
      nx < mapWidth &&
      ny < mapHeight
        ? [ny * mapWidth + nx]
        : [],
    );
  };

  // number the pieces of land
  const pieces = new Int32Array(water.length).fill(-1);
  let count = 0;
  for (let start = 0; start < water.length; ++start) {
    if (pieces[start] !== -1 || water[start] === 1) {
      continue;
    }
    pieces[start] = count;
    const pending = [start];
    for (let at = pending.pop(); at !== undefined; at = pending.pop()) {
      for (const next of neighbors(at)) {
        if (pieces[next] === -1 && water[next] !== 1) {
          pieces[next] = count;
          pending.push(next);
        }
      }
    }
    ++count;
  }

  const over = (at: number) => water[at] === 1 && crossing[at] === 1;
  const spans = new Uint8Array(water.length);
  const seen = new Uint8Array(water.length);
  for (let start = 0; start < water.length; ++start) {
    if (seen[start] || !over(start)) {
      continue;
    }
    const group = [start];
    const banks = new Set<number>();
    seen[start] = 1;
    for (let index = 0; index < group.length; ++index) {
      for (const next of neighbors(group[index] as number)) {
        if (over(next) && !seen[next]) {
          seen[next] = 1;
          group.push(next);
        } else if (water[next] !== 1) {
          banks.add(pieces[next] ?? -1);
        }
      }
    }
    if (banks.size >= 2) {
      for (const at of group) {
        spans[at] = 1;
      }
    }
  }
  return spans;
}
