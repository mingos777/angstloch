import type { Road } from '../roads/road';
import type { RoadMap } from '../roads/road-map';
import { stampRoad } from '../roads/stamp-road';
import type { StreamLayout } from './stream-layout';

/**
 * Works out the streams as `layStreams` laid them from the `streams` extra
 * that `addStreams` reports: the tributaries run again from where they join,
 * the way they were grown, and every stream is stamped on a road map of its
 * own, brush and the stretch past the border included, so that `water` is
 * the same. The `deep` water is left out, since only `addStreams` needs it.
 * The map's noise is flat, since nothing that works with streams bends roads
 * by it.
 */
export function rebuildStreamMap(
  streams: readonly Road[],
  mapWidth: number,
  mapHeight: number,
): StreamLayout {
  const map: RoadMap = {
    mapWidth,
    mapHeight,
    windiness: 0,
    noise: () => 0,
    covered: new Uint8Array(mapWidth * mapHeight),
    owner: new Int32Array(mapWidth * mapHeight).fill(-1),
    roads: [],
    junctions: [],
  };
  for (const { kind, width, points } of streams) {
    stampRoad(
      map,
      kind,
      width,
      kind === 'branch' ? [...points].reverse() : points,
    );
  }
  return {
    map,
    streams: streams.map((stream) => ({ ...stream })),
    water: map.covered,
  };
}
