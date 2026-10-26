import { describe, expect, it } from 'vitest';
import { assertStreamOptions } from './assert-stream-options';
import type { StreamOptions } from './stream-options';

describe('assertStreamOptions', () => {
  it('accepts the empty options', () => {
    // given
    const options = {};

    // when / then
    expect(() => {
      assertStreamOptions(options);
    }).not.toThrow();
  });

  it.each<[string, StreamOptions]>([
    ['angle', { angle: Number.NaN }],
    ['windiness', { windiness: 1.5 }],
    ['width', { width: { min: 0, max: 2 } }],
    ['width', { width: { min: 3, max: 2 } }],
    ['bridges', { bridges: -1 }],
    ['bridges', { bridges: 1.5 }],
    ['shoreWidth', { shoreWidth: -1 }],
    ['shoreWidth', { shoreWidth: 1.5 }],
    ['tributaries', { tributaries: { min: -1, max: 2 } }],
    ['tributaryWidth', { tributaryWidth: { min: 0, max: 2 } }],
    ['tributaryLength', { tributaryLength: { min: 0, max: 5 } }],
    ['tributaryAngle', { tributaryAngle: { min: 0, max: 60 } }],
    ['tributaryAngle', { tributaryAngle: { min: 30, max: 180 } }],
    ['bridgeAngle', { bridgeAngle: { min: 0, max: 90 } }],
    ['bridgeAngle', { bridgeAngle: { min: 75, max: 180 } }],
  ])('rejects an invalid %s', (name, options) => {
    // given
    const assert = () => {
      assertStreamOptions(options);
    };

    // when / then
    expect(assert).toThrow(RangeError);
    expect(assert).toThrow(`streams.${name}`);
  });
});
