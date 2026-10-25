import { describe, expect, it } from 'vitest';
import { createSteering } from './create-steering';
import type { SteeringOptions } from './create-steering';

const base: SteeringOptions = {
  width: 41,
  height: 41,
  lattice: false,
  random: () => 0.5,
  horizontalBias: 0,
  verticalBias: 0,
  corridorSymmetry: 'none',
  corridorSymmetryChance: 1,
};

describe('createSteering', () => {
  it('follows the biases without a symmetry', () => {
    // given
    const steering = createSteering({
      ...base,
      horizontalBias: 3,
      verticalBias: 1,
    });

    // when
    const share = steering({ x: 5, y: 5 });

    // then
    expect(share).toBe(0.75);
  });

  it('favors no axis without a symmetry and without biases', () => {
    // given
    const steering = createSteering(base);

    // when
    const share = steering({ x: 5, y: 5 });

    // then
    expect(share).toBe(0.5);
  });

  it('radiates horizontally where the center is horizontally further with snowflake', () => {
    // given
    const steering = createSteering({ ...base, corridorSymmetry: 'snowflake' });

    // when
    const shares = [steering({ x: 35, y: 22 }), steering({ x: 22, y: 5 })];

    // then
    expect(shares).toEqual([1, 0]);
  });

  it('twirls the other way round with whirlpool', () => {
    // given
    const steering = createSteering({ ...base, corridorSymmetry: 'whirlpool' });

    // when
    const shares = [steering({ x: 35, y: 22 }), steering({ x: 22, y: 5 })];

    // then
    expect(shares).toEqual([0, 1]);
  });

  it('favors no axis on the diagonals', () => {
    // given
    const steering = createSteering({ ...base, corridorSymmetry: 'snowflake' });

    // when
    const share = steering({ x: 30, y: 30 });

    // then
    expect(share).toBe(0.5);
  });

  it('follows the biases at a chance of 0', () => {
    // given
    const steering = createSteering({
      ...base,
      corridorSymmetry: 'snowflake',
      corridorSymmetryChance: 0,
      horizontalBias: 1,
      verticalBias: 0,
    });

    // when
    const share = steering({ x: 22, y: 5 });

    // then
    expect(share).toBe(1);
  });

  it('follows the biases when the dice say so', () => {
    // given
    const steering = createSteering({
      ...base,
      random: () => 0.9,
      corridorSymmetry: 'snowflake',
      corridorSymmetryChance: 0.5,
      verticalBias: 1,
    });

    // when
    const share = steering({ x: 35, y: 22 });

    // then
    expect(share).toBe(0);
  });
});
