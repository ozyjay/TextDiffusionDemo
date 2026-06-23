import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PUBLIC_EXPLANATION } from '../../client/src/content/publicCopy';

describe('public copy', () => {
  it('uses modest diffusion-inspired wording', () => {
    expect(PUBLIC_EXPLANATION.toLowerCase()).toContain('simplified');
    expect(PUBLIC_EXPLANATION.toLowerCase()).toContain('diffusion-inspired');
  });

  it('does not claim the AI is thinking', () => {
    expect(PUBLIC_EXPLANATION.toLowerCase()).not.toContain('ai is thinking');
    expect(PUBLIC_EXPLANATION.toLowerCase()).not.toContain('shows the ai thinking');
  });

  it('does not expose open free text in the default Open Day screen', () => {
    const appSource = readFileSync(resolve(process.cwd(), 'client/src/App.vue'), 'utf8');

    expect(appSource).not.toContain('<textarea');
    expect(appSource).not.toContain('contenteditable');
  });

  it('keeps advanced controls out of the first-view default', () => {
    const appSource = readFileSync(resolve(process.cwd(), 'client/src/App.vue'), 'utf8');

    expect(appSource).toContain('showAdvanced');
    expect(appSource).toContain('Staff controls');
  });
});
