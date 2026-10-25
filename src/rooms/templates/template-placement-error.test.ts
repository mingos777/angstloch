import { describe, expect, it } from 'vitest';
import { TemplatePlacementError } from './template-placement-error';

describe('TemplatePlacementError', () => {
  it('names the template and the cause in the message', () => {
    // given
    const error = new TemplatePlacementError(2, 'boss arena', 'it is too big');

    // when
    const message = error.message;

    // then
    expect(message).toBe('Template "boss arena" (#2): it is too big');
  });

  it('falls back to the index of an unnamed template', () => {
    // given
    const error = new TemplatePlacementError(0, undefined, 'no free spot');

    // when
    const message = error.message;

    // then
    expect(message).toBe('Template #0: no free spot');
  });

  it('carries the index and the name as fields', () => {
    // given
    const error = new TemplatePlacementError(1, 'vault', 'cause');

    // when
    const fields = [error.templateIndex, error.templateName];

    // then
    expect(fields).toEqual([1, 'vault']);
  });

  it('keeps the reason apart from the template', () => {
    // given
    const error = new TemplatePlacementError(1, 'vault', 'no free spot');

    // when
    const reason = error.reason;

    // then
    expect(reason).toBe('no free spot');
  });
});
