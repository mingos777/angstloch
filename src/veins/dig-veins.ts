import { createSimplexNoise } from '../noise/create-simplex-noise';
import { assertWallBase } from '../pipeline/assert-wall-base';
import type { MapStep } from '../pipeline/map-step';
import { step } from '../pipeline/step';
import { assertVeinOptions } from './assert-vein-options';
import type { DigVeinsOptions } from './dig-veins-options';
import { LANE_SPACING } from './dig-vein';
import { growVeinNetwork } from './grow-vein-network';
import type { MinePassage } from './mine-passage';

/**
 * A step that digs a network of veins through the rock between the pieces of
 * floor on the map, and joins them all into one: rooms, halls, caverns and the
 * veins of earlier steps. The two pieces nearest each other are joined first,
 * then the piece nearest the network to the nearest part of it, so a vein may
 * end on another vein. A vein enters a room through its nearest potential exit
 * (an `Openable` tile), which becomes floor and is opened with `openReserved`,
 * so there is no gap. Veins are routed through free rock round the pieces and
 * never across one, so the pillars of a hall survive, and no vein digs a
 * reserved tile.
 *
 * Then `density` says how much more to dig: the web grows junctions of its own
 * in the free rock, each joined to the nearest part of the network, and extra
 * veins make loops. On a map with no floor it digs a web of its own, and with
 * a `density` of 0 it digs nothing but the veins that join the pieces.
 *
 * With a `symmetry`, every vein gets twins with the chance `symmetryChance`:
 * once it is dug, every tile it carved is dug at its mirror images too, and so
 * are the doors it opened where their images are `Openable`. A twin tile that
 * is not free rock a vein can reach is left out, so a twin may be partial and
 * a pillar or a room is never dug into. The twins join the pieces that mirror
 * the ones the vein joins, so a symmetric map gets a symmetric network.
 *
 * A piece that no vein can reach is left as it is. It adds `passages` to the
 * ones of the steps before it. The map has to start as wall, which `pipeline`
 * checks before the first attempt. Throws a `RangeError` at once for a bad
 * option.
 */
export function digVeins(
  options: DigVeinsOptions = {},
): MapStep<Partial<{ passages: MinePassage[] }>, { passages: MinePassage[] }> {
  const {
    density = 0.15,
    veinWidth = { min: 1, max: 2 },
    veinWindiness = 0.5,
    veinSpacing = 16,
    hallEntrances = 'facing',
    symmetry = 'none',
    symmetryChance = 1,
  } = options;
  assertVeinOptions(options);

  return step<
    Partial<{ passages: MinePassage[] }>,
    { passages: MinePassage[] }
  >(
    'digVeins',
    {
      adds: ['passages'],
      validate: (state) => {
        assertWallBase('digVeins', state);
      },
    },
    (state, { random }) => {
      const passages = state.passages ?? [];
      const dug = growVeinNetwork(state, random, createSimplexNoise(random), {
        density,
        veinWidth,
        veinWindiness,
        veinSpacing,
        hallEntrances,
        symmetry,
        symmetryChance,
        lane: 0.5 + passages.length * LANE_SPACING,
      });
      return { passages: [...passages, ...dug] };
    },
  );
}
