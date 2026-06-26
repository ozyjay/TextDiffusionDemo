import type { RefinementStage, Trace } from '../../../shared/types';

export interface StageController {
  load(trace: Trace): void;
  advance(): boolean;
  reset(): void;
  currentTrace(): Trace | null;
  currentStage(): RefinementStage | null;
  currentIndex(): number;
}

export function createStageController(): StageController {
  let trace: Trace | null = null;
  let index = -1;

  return {
    load(nextTrace: Trace) {
      trace = nextTrace;
      index = 0;
    },
    advance() {
      if (!trace || index >= trace.stages.length - 1) {
        return false;
      }
      index += 1;
      return true;
    },
    reset() {
      trace = null;
      index = -1;
    },
    currentTrace() {
      return trace;
    },
    currentStage() {
      return trace ? trace.stages[index] ?? null : null;
    },
    currentIndex() {
      return index;
    }
  };
}
