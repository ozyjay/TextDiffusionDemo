import { describe, expect, it } from 'vitest';
import { defaultConstraintForPrompt } from '../../client/src/services/promptDefaults';

describe('prompt constraint defaults', () => {
  it('never injects a constraint into a custom prompt', () => {
    expect(defaultConstraintForPrompt('custom', 'reef-signal-story')).toBe('none');
  });

  it('uses matching constraints for curated prompts only', () => {
    expect(defaultConstraintForPrompt('fallback', 'robot-orientation-story')).toBe('include-robot');
    expect(defaultConstraintForPrompt('fallback', 'reef-signal-story')).toBe('include-reef');
    expect(defaultConstraintForPrompt('fallback', 'number-guess-python')).toBe('none');
  });
});
