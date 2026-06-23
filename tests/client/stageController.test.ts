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

  it('clears visitor-visible state on reset', () => {
    const controller = createStageController();

    controller.load(getLocalTraces()[0]);
    controller.advance();
    controller.reset();

    expect(controller.currentTrace()).toBeNull();
    expect(controller.currentStage()).toBeNull();
  });
});
