import { describe, expect, it } from 'vitest';
import type { RoomTemplate } from '../rooms/templates/room-template';
import { TemplateCell } from '../rooms/templates/template-cell';
import { assertForestTemplates } from './assert-forest-templates';

const FLOOR: RoomTemplate = { cells: [[TemplateCell.Floor]] };

describe('assertForestTemplates', () => {
  it('accepts templates without exits', () => {
    // given
    const templates = [FLOOR, { ...FLOOR, count: { min: 0, max: 2 } }];

    // when
    const assert = () => {
      assertForestTemplates(templates);
    };

    // then
    expect(assert).not.toThrow();
  });

  it.each([
    ['an exit', TemplateCell.Exit],
    ['a door', TemplateCell.Door],
    ['an optional exit', TemplateCell.OptionalExit],
  ])('rejects %s', (_, cell) => {
    // given
    const templates = [{ cells: [[TemplateCell.Floor, cell]] }];

    // when
    const assert = () => {
      assertForestTemplates(templates);
    };

    // then
    expect(assert).toThrow(RangeError);
  });

  it('rejects empty cells', () => {
    // given
    const templates = [{ cells: [] }];

    // when
    const assert = () => {
      assertForestTemplates(templates);
    };

    // then
    expect(assert).toThrow('cells must not be empty');
  });

  it('rejects uneven rows', () => {
    // given
    const templates = [{ cells: [[1, 1], [1]] }];

    // when
    const assert = () => {
      assertForestTemplates(templates as RoomTemplate[]);
    };

    // then
    expect(assert).toThrow('row 1 has 1 cells');
  });

  it('rejects an unknown cell', () => {
    // given
    const templates = [{ cells: [[9]] }];

    // when
    const assert = () => {
      assertForestTemplates(templates as RoomTemplate[]);
    };

    // then
    expect(assert).toThrow('unknown cell 9');
  });

  it('rejects a chance above 1', () => {
    // given
    const templates = [{ ...FLOOR, chance: 1.5 }];

    // when
    const assert = () => {
      assertForestTemplates(templates);
    };

    // then
    expect(assert).toThrow('chance');
  });

  it('rejects a count that is not a range of whole numbers', () => {
    // given
    const templates = [{ ...FLOOR, count: { min: 2, max: 1 } }];

    // when
    const assert = () => {
      assertForestTemplates(templates);
    };

    // then
    expect(assert).toThrow('count');
  });

  it('rejects a rotation that is not a right angle', () => {
    // given
    const templates = [{ ...FLOOR, rotate: [45 as 0] }];

    // when
    const assert = () => {
      assertForestTemplates(templates);
    };

    // then
    expect(assert).toThrow('rotate');
  });

  it('rejects positions and areas', () => {
    // given
    const templates = [
      { ...FLOOR, areas: [{ x: 0, y: 0, width: 5, height: 5 }] },
    ];

    // when
    const assert = () => {
      assertForestTemplates(templates);
    };

    // then
    expect(assert).toThrow('positions and areas');
  });

  it('names a template in its message', () => {
    // given
    const templates = [{ name: 'camp', cells: [] }];

    // when
    const assert = () => {
      assertForestTemplates(templates);
    };

    // then
    expect(assert).toThrow('Template "camp" (#0)');
  });
});
