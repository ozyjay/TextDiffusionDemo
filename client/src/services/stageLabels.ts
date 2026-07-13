import type { RefinementStage } from '../../../shared/types';

export interface StageDisplay {
  stepText: string;
  label: string;
  detail: string;
  debugText: string | null;
}

export function formatStageLabel(
  stage: RefinementStage,
  index: number,
  showDebugLabel: boolean
): string {
  return buildStageDisplay(stage, index, index + 1, showDebugLabel).label;
}

export function buildStageDisplay(
  stage: RefinementStage,
  index: number,
  totalStages: number,
  showDebugLabel: boolean
): StageDisplay {
  const raw = parseModelStageLabel(stage.label);
  const stepText = `Pass ${index + 1} of ${Math.max(totalStages, index + 1)}`;
  if (!raw) {
    const publicStage = publicStageDisplay(stage.label);
    return {
      stepText,
      label: publicStage.label,
      detail: publicStage.detail,
      debugText: null
    };
  }

  const publicLabel = raw.kind === 'mask'
    ? 'Canvas'
    : 'Iterative refinement';
  const debugText = `Internal pass ${raw.current} of ${raw.total}`;

  return {
    stepText,
    label: showDebugLabel ? stage.label : publicLabel,
    detail: showDebugLabel ? debugText : modelPublicDetail(raw.kind),
    debugText
  };
}

export function formatStageText(text: string, showDebugLabel: boolean): string {
  const withoutReasoning = removeReasoningSections(text);
  if (showDebugLabel) {
    return withoutReasoning;
  }

  const formatted = withoutReasoning
    .replace(/\\n/g, '\n')
    .replace(/\[(?:MASK|Mask|mask)\]|<mask>/g, '...')
    .replace(/^\s*```[^\n]*\n?/gm, '')
    .replace(/^\s*```\s*$/gm, '')
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')
    .replace(/^\s*[-*+]\s+/gm, '• ')
    .replace(/^\s*\d+[.)]\s+/gm, '• ')
    .replace(/!\[([^\]]*)]\([^)]+\)/g, '$1')
    .replace(/\[([^\]]+)]\([^)]+\)/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g, '$1')
    .replace(/(?<!_)_([^_\n]+)_(?!_)/g, '$1')
    .replace(/\\text\{([^{}]*)}/g, '$1')
    .replace(/\\frac\{([^{}]*)}\{([^{}]*)}/g, '$1 ÷ $2')
    .replace(/\\pi\b/g, 'π')
    .replace(/\$\$([\s\S]*?)\$\$/g, '$1')
    .replace(/\$([^$\n]+)\$/g, '$1')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return formatted || 'Refining...';
}

function removeReasoningSections(text: string): string {
  return text
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/<thinking>[\s\S]*?<\/thinking>/gi, '')
    .replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, '')
    .replace(/<analysis>[\s\S]*?<\/analysis>/gi, '')
    .replace(/<\|channel\|>analysis[\s\S]*?(?=<\|channel\|>final|$)/gi, '')
    .replace(/<\|channel\|>final/gi, '')
    .replace(
      /(?:^|\n)\s*(?:#{1,6}\s*)?(?:thought|thinking|reasoning|analysis)\s*:?\s*[\s\S]*?(?=\n\s*(?:#{1,6}\s*)?(?:answer|final answer|response)\s*:?|$)/gi,
      '\n'
    )
    .replace(/(?:^|\n)\s*(?:#{1,6}\s*)?(?:answer|final answer|response)\s*:?\s*/gi, '\n')
    .trim();
}

function parseModelStageLabel(label: string): { kind: 'mask' | 'denoise'; current: number; total: number } | null {
  const match = /^(mask|denoise)\s+(\d+)\/(\d+)$/i.exec(label.trim());
  if (!match) {
    return null;
  }

  return {
    kind: match[1].toLowerCase() === 'mask' ? 'mask' : 'denoise',
    current: Number(match[2]),
    total: Number(match[3])
  };
}

function modelPublicDetail(kind: 'mask' | 'denoise'): string {
  return kind === 'mask'
    ? 'Placeholder tokens start the text canvas'
    : 'Stable tokens guide the next refinement pass';
}

function publicStageDisplay(label: string): Pick<StageDisplay, 'label' | 'detail'> {
  switch (label) {
    case 'Noise':
      return {
        label: 'Canvas',
        detail: 'Placeholder tokens start the text canvas'
      };
    case 'Rough':
      return {
        label: 'Iterative refinement',
        detail: 'A first pass fills in rough meaning'
      };
    case 'Clear':
      return {
        label: 'Iterative refinement',
        detail: 'The whole block becomes clearer'
      };
    case 'Styled':
      return {
        label: 'Iterative refinement',
        detail: 'Stable words act as context for the rest'
      };
    case 'Final':
      return {
        label: 'Final polish',
        detail: 'The text converges into the final output'
      };
    default:
      return {
        label,
        detail: 'Visible refinement pass'
      };
  }
}
