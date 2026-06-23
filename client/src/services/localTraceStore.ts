import { scriptedTraces } from '../../../shared/traces';
import type { PromptCard, Trace } from '../../../shared/types';
import { promptCards } from '../../../shared/traces';

export function getLocalTraces(): Trace[] {
  return scriptedTraces;
}

export function getLocalPrompts(): PromptCard[] {
  return promptCards;
}
