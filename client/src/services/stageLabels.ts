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
  if (showDebugLabel) {
    return text;
  }

  return text
    .replace(/\\n/g, '\n')
    .replace(/\[(?:MASK|Mask|mask)\]|<mask>/g, '...');
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
