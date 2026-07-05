import type { ModelRuntimeStatus, PromptCard, RefineRequest, RefinementStage, Trace } from '../../../shared/types';
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

export async function fetchModelStatus(): Promise<ModelRuntimeStatus> {
  try {
    const response = await fetch('/api/model-status');
    if (!response.ok) {
      throw new Error('Model status API unavailable.');
    }
    const data = (await response.json()) as { status: ModelRuntimeStatus };
    return data.status;
  } catch {
    return {
      state: 'fallback',
      message: 'Model status unavailable; fallback traces remain available.',
      updatedAt: new Date().toISOString(),
      preloadEnabled: false
    };
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

    return { mode: request.mode === 'model-assisted' ? 'model-fallback' : 'replay', trace: fallback };
  }
}

export async function requestRefinementStream(
  request: RefineRequest,
  onFrame: (index: number, stage: RefinementStage) => void,
  signal?: AbortSignal
): Promise<{ mode: string; trace: Trace }> {
  try {
    const response = await fetch('/api/refine/stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
      signal
    });
    if (!response.ok || !response.body) {
      throw new Error('Refinement stream unavailable.');
    }

    return await readRefinementStream(response, onFrame);
  } catch {
    if (signal?.aborted) {
      throw new Error('Refinement stream aborted.');
    }
    const fallback = await requestRefinement(request);
    fallback.trace.stages.forEach((stage, index) => onFrame(index, stage));
    return fallback;
  }
}

async function readRefinementStream(
  response: Response,
  onFrame: (index: number, stage: RefinementStage) => void
): Promise<{ mode: string; trace: Trace }> {
  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('Refinement stream did not include a readable body.');
  }

  const decoder = new TextDecoder();
  let buffer = '';
  let result: { mode: string; trace: Trace } | null = null;

  while (true) {
    const { done, value } = await reader.read();
    if (value) {
      buffer += decoder.decode(value, { stream: !done });
      const parsed = parseSseBuffer(buffer);
      buffer = parsed.remainder;
      for (const message of parsed.messages) {
        if (message.event === 'frame') {
          const frame = JSON.parse(message.data) as { index: number; stage: RefinementStage };
          onFrame(frame.index, frame.stage);
        }
        if (message.event === 'done') {
          result = JSON.parse(message.data) as { mode: string; trace: Trace };
        }
        if (message.event === 'error') {
          throw new Error(message.data);
        }
      }
    }
    if (done) {
      break;
    }
  }

  if (!result) {
    throw new Error('Refinement stream ended before the final trace arrived.');
  }

  return result;
}

function parseSseBuffer(buffer: string): {
  messages: Array<{ event: string; data: string }>;
  remainder: string;
} {
  const chunks = buffer.split('\n\n');
  const remainder = chunks.pop() ?? '';
  const messages = chunks
    .map((chunk) => {
      const event = chunk.match(/^event: (.+)$/m)?.[1] ?? 'message';
      const data = chunk
        .split('\n')
        .filter((line) => line.startsWith('data: '))
        .map((line) => line.slice(6))
        .join('\n');
      return { event, data };
    })
    .filter((message) => message.data.length > 0);

  return { messages, remainder };
}
