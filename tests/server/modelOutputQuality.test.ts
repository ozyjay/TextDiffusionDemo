import { describe, expect, it } from 'vitest';
import { assessModelOutput } from '../../server/services/modelOutputQuality';

describe('model output quality guard', () => {
  it.each([
    ['unresolved mask', 'A useful [MASK] answer.'],
    ['consecutive repetition', 'This is is is broken.'],
    ['phrase repetition', 'blue reef blue reef blue reef today'],
    ['punctuation run', 'This answer broke,,, near the end.'],
    ['low diversity', 'one two one two one two one two one two one two one two one two one two one two']
  ])('rejects %s', (_case, text) => {
    expect(assessModelOutput(text, { constraint: 'none' }).valid).toBe(false);
  });

  it('checks deterministic content constraints', () => {
    expect(assessModelOutput('A short campus answer.', { constraint: 'include-reef' }).valid).toBe(false);
    expect(assessModelOutput('One two three four five six seven eight nine ten eleven twelve.', {
      constraint: 'under-12-words'
    }).valid).toBe(false);
  });

  it('accepts a varied final response that satisfies its constraint', () => {
    const result = assessModelOutput(
      'A reef scientist found a repeating signal and carefully checked the sensor data.',
      { constraint: 'include-reef' }
    );

    expect(result).toEqual({ valid: true, reasons: [] });
  });
});
