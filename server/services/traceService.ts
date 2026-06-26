import { promptCards, scriptedTraces } from '../../shared/traces';
import type { PromptCard, RefineRequest, Trace } from '../../shared/types';

const stageOrder = ['Noise', 'Rough', 'Clear', 'Styled', 'Final'];

export function validateTrace(trace: Trace): Trace {
  if (!trace.id.trim()) {
    throw new Error('Trace id is required.');
  }

  if (!trace.prompt.trim()) {
    throw new Error('Trace prompt is required.');
  }

  if (!trace.promptId.trim()) {
    throw new Error('Trace promptId is required.');
  }

  if (trace.outputType !== 'story' && trace.outputType !== 'python') {
    throw new Error('Trace outputType must be story or python.');
  }

  if (!trace.style.trim()) {
    throw new Error('Trace style is required.');
  }

  const labels = trace.stages.map((stage) => stage.label);
  const canonical = labels.length === stageOrder.length &&
    labels.every((label, index) => label === stageOrder[index]);
  const modelAssisted = trace.id.endsWith('-diffusiongemma');
  if (!canonical && !modelAssisted) {
    throw new Error('Trace must contain Noise, Rough, Clear, Styled, and Final stages.');
  }

  trace.stages.forEach((stage) => {
    if (!stage.text.trim() || !stage.note.trim()) {
      throw new Error(`Trace stage ${stage.label} must include text and note.`);
    }
  });

  return trace;
}

export function getTraces(): Trace[] {
  return scriptedTraces.map(validateTrace);
}

export function getPrompts(): PromptCard[] {
  return [...promptCards];
}

export function refineTrace(request: RefineRequest): Trace {
  const traces = getTraces();
  const exact = traces.find(
    (trace) =>
      trace.outputType === request.outputType &&
      trace.promptId === request.promptId &&
      trace.style === request.style
  );
  if (exact) {
    return exact;
  }

  const promptFallback = traces.find(
    (trace) => trace.outputType === request.outputType && trace.promptId === request.promptId
  );
  if (promptFallback) {
    return applyTemplateRefinement(promptFallback, request);
  }

  const laneFallback = traces.find((trace) => trace.outputType === request.outputType) ?? traces[0];
  return applyTemplateRefinement(laneFallback, request);
}

function applyTemplateRefinement(trace: Trace, request: RefineRequest): Trace {
  const finalStage = trace.stages.at(-1);
  const requestedStyle = request.style.trim().toLowerCase();
  const suffix = requestedStyle && requestedStyle !== trace.style
    ? ` Style direction: ${titleCase(requestedStyle)}.`
    : '';

  return {
    ...trace,
    id: `${trace.promptId}-${requestedStyle || trace.style}-template`,
    outputType: request.outputType,
    style: requestedStyle || trace.style,
    controls: {
      creativity: request.creativity,
      length: request.length,
      constraint: request.constraint,
      steps: request.steps
    },
    stages: trace.stages.map((stage) =>
      stage.label === 'Final' && finalStage
        ? { ...stage, text: `${finalStage.text}${suffix}`, note: 'Template refinement keeps the offline fallback reliable.' }
        : stage
    )
  };
}

function titleCase(value: string): string {
  return value
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}
