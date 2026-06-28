import { describe, expect, it } from 'vitest';
import { createStageController } from '../../client/src/services/stageController';
import { getLocalTraces } from '../../client/src/services/localTraceStore';

describe('stage controller', () => {
  it('advances through all stages during replay', () => {
    const controller = createStageController();
    const trace = getLocalTraces()[0];

    controller.load(trace);
    const visited = [controller.currentStage()?.label];
    while (controller.advance()) {
      visited.push(controller.currentStage()?.label);
    }

    expect(visited).toEqual(['Noise', 'Rough', 'Clear', 'Styled', 'Final']);
  });

  it('advances through variable model draft stages', () => {
    const controller = createStageController();
    const trace = {
      ...getLocalTraces()[0],
      id: 'robot-orientation-story-diffusiongemma',
      stages: [
        { label: 'Mask 0/8', text: '[Mask]', note: 'Model draft frame.' },
        { label: 'Denoise 2/8', text: 'The robot [Mask]', note: 'Model draft frame.' },
        { label: 'Denoise 4/8', text: 'The robot waved.', note: 'Model draft frame.' },
        { label: 'Final', text: 'The robot waved at orientation.', note: 'Model final.' }
      ]
    };

    controller.load(trace);
    const visited = [controller.currentStage()?.label];
    while (controller.advance()) {
      visited.push(controller.currentStage()?.label);
    }

    expect(visited).toEqual(['Mask 0/8', 'Denoise 2/8', 'Denoise 4/8', 'Final']);
  });

  it('selects a visible stage by index', () => {
    const controller = createStageController();

    controller.load(getLocalTraces()[0]);

    expect(controller.select(3)).toBe(true);
    expect(controller.currentIndex()).toBe(3);
    expect(controller.currentStage()?.label).toBe('Styled');
    expect(controller.select(99)).toBe(false);
    expect(controller.currentIndex()).toBe(3);
  });

  it('clears visitor-visible state on reset', () => {
    const controller = createStageController();

    controller.load(getLocalTraces()[0]);
    controller.advance();
    controller.reset();

    expect(controller.currentTrace()).toBeNull();
    expect(controller.currentStage()).toBeNull();
  });
});
