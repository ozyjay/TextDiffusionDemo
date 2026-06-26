import { describe, expect, it } from 'vitest';
import {
  getPrompts,
  getTraces,
  refineTrace,
  validateTrace
} from '../../server/services/traceService';

describe('trace service', () => {
  it('loads curated traces with ordered staged refinement', () => {
    const traces = getTraces();

    expect(traces.length).toBeGreaterThanOrEqual(4);
    expect(traces[0].stages.map((stage) => stage.label)).toEqual([
      'Noise',
      'Rough',
      'Clear',
      'Styled',
      'Final'
    ]);
  });

  it('rejects malformed traces', () => {
    expect(() =>
      validateTrace({
        id: 'broken',
        promptId: 'broken',
        outputType: 'story',
        prompt: '',
        style: 'funny',
        controls: { creativity: 'balanced', length: 'medium', constraint: 'none', steps: 5 },
        stages: []
      })
    ).toThrow(/prompt/i);
  });

  it('accepts model-assisted traces with variable draft stages', () => {
    const trace = validateTrace({
      id: 'robot-orientation-story-diffusiongemma',
      promptId: 'robot-orientation-story',
      outputType: 'story',
      prompt: 'A robot joins university orientation.',
      style: 'funny',
      controls: { creativity: 'balanced', length: 'short', constraint: 'include-robot', steps: 5 },
      stages: [
        { label: 'Mask 0/8', text: '[Mask] [Mask]', note: 'Model draft frame.' },
        { label: 'Denoise 2/8', text: 'The robot [Mask]', note: 'Model draft frame.' },
        { label: 'Final', text: 'The robot waved at orientation.', note: 'Model final.' }
      ]
    });

    expect(trace.stages.map((stage) => stage.label)).toEqual(['Mask 0/8', 'Denoise 2/8', 'Final']);
  });

  it('returns prompt cards for every curated prompt', () => {
    const prompts = getPrompts();

    expect(prompts.filter((prompt) => prompt.outputType === 'story')).toHaveLength(2);
    expect(prompts.filter((prompt) => prompt.outputType === 'python')).toHaveLength(2);
  });

  it('selects a supported trace from curated controls', () => {
    const trace = refineTrace({
      outputType: 'story',
      promptId: 'reef-signal-story',
      style: 'clear',
      creativity: 'balanced',
      length: 'medium',
      constraint: 'include-reef',
      steps: 5
    });

    expect(trace.prompt).toBe('A reef scientist discovers a strange signal.');
    expect(trace.outputType).toBe('story');
    expect(trace.stages.at(-1)?.text).toContain('reef scientist');
  });

  it('selects a one-page Python script trace from the Python lane', () => {
    const trace = refineTrace({
      outputType: 'python',
      promptId: 'number-guess-python',
      style: 'clear',
      creativity: 'balanced',
      length: 'medium',
      constraint: 'none',
      steps: 5
    });

    expect(trace.outputType).toBe('python');
    expect(trace.stages.at(-1)?.text).toContain('import random');
    expect(trace.stages.at(-1)?.text).toContain('while');
  });
});
