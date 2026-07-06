import { describe, expect, it } from 'vitest';
import { getNextAutoplaySelection } from '../../client/src/services/autoplay';
import { getLocalPrompts } from '../../client/src/services/localTraceStore';

describe('autoplay sequence', () => {
  it('cycles through story and coding fallback prompts', () => {
    const prompts = getLocalPrompts();
    const first = getNextAutoplaySelection(prompts, null);
    const second = getNextAutoplaySelection(prompts, first);
    const third = getNextAutoplaySelection(prompts, second);

    expect(first?.outputType).toBe('story');
    expect(second?.outputType).toBe('python');
    expect(third?.outputType).toBe('story');
  });

  it('cycles through prompt cards without requiring visitor input', () => {
    const prompts = getLocalPrompts();
    const selections = [];
    let current = null;

    for (let index = 0; index < 5; index += 1) {
      current = getNextAutoplaySelection(prompts, current);
      selections.push(current?.promptId);
    }

    expect(selections).toEqual([
      'robot-orientation-story',
      'number-guess-python',
      'reef-signal-story',
      'reef-temperature-python',
      'robot-orientation-story'
    ]);
  });
});
