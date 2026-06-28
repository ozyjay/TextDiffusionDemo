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

    expect(appSource).not.toContain('contenteditable');
  });

  it('keeps staff controls separate from first-class visitor controls', () => {
    const appSource = readFileSync(resolve(process.cwd(), 'client/src/App.vue'), 'utf8');

    expect(appSource).toContain('Staff controls');
    expect(appSource).toContain('aria-label="Demo controls"');
    expect(appSource).toContain('aria-label="Staff controls"');
  });

  it('includes autoplay and changed-text highlighting hooks', () => {
    const appSource = readFileSync(resolve(process.cwd(), 'client/src/App.vue'), 'utf8');

    expect(appSource).toContain('Autoplay');
    expect(appSource).toContain('highlightedSegments');
    expect(appSource).toContain('changed-word');
  });

  it('uses the streaming refinement API for demo runs', () => {
    const appSource = readFileSync(resolve(process.cwd(), 'client/src/App.vue'), 'utf8');
    const apiSource = readFileSync(resolve(process.cwd(), 'client/src/services/api.ts'), 'utf8');

    expect(appSource).toContain('requestRefinementStream');
    expect(apiSource).toContain('/api/refine/stream');
    expect(apiSource).toContain('event === \'frame\'');
  });

  it('keeps raw model frame labels behind a staff debug toggle', () => {
    const appSource = readFileSync(resolve(process.cwd(), 'client/src/App.vue'), 'utf8');

    expect(appSource).toContain('showDebugLabels');
    expect(appSource).toContain('Debug labels');
    expect(appSource).toContain('buildStageDisplay');
  });

  it('includes staff-only model-assisted mode copy', () => {
    const appSource = readFileSync(resolve(process.cwd(), 'client/src/App.vue'), 'utf8');

    expect(appSource).toContain('Model-assisted');
    expect(appSource).toContain('modelAssisted');
  });

  it('exposes draft step and every-frame inspection controls', () => {
    const appSource = readFileSync(resolve(process.cwd(), 'client/src/App.vue'), 'utf8');

    expect(appSource).toContain('Every frame');
    expect(appSource).toContain('viewMode');
    expect(appSource).toContain('Frame');
    expect(appSource).toContain("includeEveryFrame: viewMode.value === 'frames'");
    expect(appSource).toContain('v-model.number="steps"');
  });

  it('makes custom prompt entry a first-class prompt option', () => {
    const appSource = readFileSync(resolve(process.cwd(), 'client/src/App.vue'), 'utf8');

    expect(appSource).toContain('Prompt source');
    expect(appSource).toContain('Custom prompt');
    expect(appSource).toContain('prompt-panel');
    expect(appSource).toContain('customPrompt');
  });
});
