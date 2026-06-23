import type { PromptCard, RefineRequest, Trace } from '../../../shared/types';
import { getLocalPrompts, getLocalTraces } from './localTraceStore';

export async function fetchPrompts(): Promise<PromptCard[]> {
  try {
    const response = await fetch('/api/prompts');
    if (!response.ok) {
      throw new Error('Prompt API unavailable.');
    }
    const data = (await response.json()) as { prompts: PromptCard[] };
    return data.prompts;
  } catch {
    return getLocalPrompts();
  }
}

export async function requestRefinement(request: RefineRequest): Promise<{ mode: string; trace: Trace }> {
  try {
    const response = await fetch('/api/refine', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request)
    });
    if (!response.ok) {
      throw new Error('Refinement API unavailable.');
    }
    return (await response.json()) as { mode: string; trace: Trace };
  } catch {
    const fallback =
      getLocalTraces().find(
        (trace) =>
          trace.outputType === request.outputType &&
          trace.promptId === request.promptId &&
          trace.style === request.style
      ) ??
      getLocalTraces().find(
        (trace) => trace.outputType === request.outputType && trace.promptId === request.promptId
      ) ??
      getLocalTraces().find((trace) => trace.outputType === request.outputType) ??
      getLocalTraces()[0];

    return { mode: 'replay', trace: fallback };
  }
}
