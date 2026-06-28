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
    return {
      stepText,
      label: stage.label,
      detail: stage.label === 'Final' ? 'Completed output' : 'Visible refinement pass',
      debugText: null
    };
  }

  const publicLabel = raw.kind === 'mask'
    ? 'Noise'
    : index <= 1
      ? 'Early draft'
      : 'Clearer draft';
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
  return kind === 'mask' ? 'Masked starting point' : 'Sampled from internal denoising';
}
