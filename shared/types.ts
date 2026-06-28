export type Creativity = 'safer' | 'balanced' | 'surprising';
export type Length = 'short' | 'medium' | 'detailed';
export type DemoMode = 'scripted' | 'replay' | 'template' | 'model-assisted' | 'model-fallback';
export type OutputType = 'story' | 'python';

export interface TraceControls {
  creativity: Creativity;
  length: Length;
  constraint: string;
  steps: number;
}

export interface PromptCard {
  id: string;
  outputType: OutputType;
  prompt: string;
  notes: string;
}

export interface RefinementStage {
  label: string;
  text: string;
  note: string;
}

export interface Trace {
  id: string;
  promptId: string;
  outputType: OutputType;
  prompt: string;
  style: string;
  controls: TraceControls;
  stages: RefinementStage[];
}

export interface RefineRequest {
  outputType: OutputType;
  promptId: string;
  style: string;
  creativity: Creativity;
  length: Length;
  constraint: string;
  steps: number;
  streamDelayMs?: number;
  includeEveryFrame?: boolean;
  mode?: 'scripted' | 'model-assisted';
  customPrompt?: string;
}
