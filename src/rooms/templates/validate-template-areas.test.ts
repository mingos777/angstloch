import { describe, expect, it } from 'vitest';
import type { RoomTemplate } from './room-template';
import { TemplateCell } from './template-cell';
import { validateTemplateAreas } from './validate-template-areas';

const { Floor: F, Wall: W, Exit: E } = TemplateCell;

const closet: RoomTemplate = {
  name: 'closet',
  cells: [
    [W, E, W],
    [W, F, W],
    [W, W, W],
  ],
};

function check(template: RoomTemplate, lattice = false) {
  return () => {
    validateTemplateAreas(template, 1, 40, 20, lattice);
  };
}

describe('validateTemplateAreas', () => {
  it('accepts a template without areas', () => {
    // given
    const template = closet;

    // when / then
    expect(check(template)).not.toThrow();
  });

  it('accepts areas on the map that the template fits in', () => {
    // given
    const areas = [{ x: 0, y: 0, width: 10, height: 20 }];

    // when / then
    expect(check({ ...closet, areas })).not.toThrow();
  });

  it('rejects an area that sticks out of the map', () => {
    // given
    const areas = [{ x: 35, y: 0, width: 10, height: 5 }];

    // when / then
    expect(check({ ...closet, areas })).toThrow(
      /"closet".*areas\[0\].*outside/,
    );
  });

  it('rejects areas that the template does not fit in', () => {
    // given
    const areas = [
      { x: 0, y: 0, width: 2, height: 20 },
      { x: 10, y: 0, width: 20, height: 2 },
    ];

    // when / then
    expect(check({ ...closet, areas })).toThrow(/no variant fits in any/);
  });

  it('accepts an area that only a rotated variant fits in', () => {
    // given
    const tall: RoomTemplate = {
      cells: [
        [W, W, W, W, W],
        [W, F, F, F, W],
        [W, W, E, W, W],
      ],
      rotate: [0, 90],
    };
    const areas = [{ x: 0, y: 0, width: 3, height: 5 }];

    // when / then
    expect(check({ ...tall, areas })).not.toThrow();
  });
});
