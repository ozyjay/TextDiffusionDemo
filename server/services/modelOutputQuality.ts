import type { RefineRequest } from '../../shared/types';

export interface ModelOutputQuality {
  valid: boolean;
  reasons: string[];
}

export function assessModelOutput(
  text: string,
  request: Pick<RefineRequest, 'constraint'>
): ModelOutputQuality {
  const words = normalisedWords(text);
  const reasons: string[] = [];

  if (words.length === 0) {
    reasons.push('The response did not contain any words.');
  }
  if (/\[(?:mask)\]|<mask>|\?\?\?/i.test(text)) {
    reasons.push('The response still contains unresolved placeholders.');
  }
  if (hasConsecutiveRepeatedWord(words, 3)) {
    reasons.push('The response repeats the same word three or more times in a row.');
  }
  if (hasRepeatedPhrase(words)) {
    reasons.push('The response repeats the same phrase too many times.');
  }
  if (/[,;:!?]{3,}|\.{4,}/.test(text)) {
    reasons.push('The response contains an abnormal punctuation run.');
  }
  if (words.length >= 20 && new Set(words).size / words.length < 0.4) {
    reasons.push('The response has very low word diversity.');
  }

  const constraintReason = checkConstraint(words, request.constraint);
  if (constraintReason) {
    reasons.push(constraintReason);
  }

  return { valid: reasons.length === 0, reasons };
}

function normalisedWords(text: string): string[] {
  return (text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []).filter(Boolean);
}

function hasConsecutiveRepeatedWord(words: string[], count: number): boolean {
  for (let index = count - 1; index < words.length; index += 1) {
    const candidate = words[index];
    if (words.slice(index - count + 1, index + 1).every((word) => word === candidate)) {
      return true;
    }
  }
  return false;
}

function hasRepeatedPhrase(words: string[]): boolean {
  for (let size = 2; size <= 5; size += 1) {
    const counts = new Map<string, number>();
    for (let index = 0; index <= words.length - size; index += 1) {
      const phrase = words.slice(index, index + size).join('\u0000');
      const count = (counts.get(phrase) ?? 0) + 1;
      if (count >= 3) {
        return true;
      }
      counts.set(phrase, count);
    }
  }
  return false;
}

function checkConstraint(words: string[], constraint: string): string | null {
  const normalised = constraint.trim().toLowerCase();
  const requiredWords: Record<string, string> = {
    'include-reef': 'reef',
    'include-robot': 'robot',
    university: 'university'
  };
  const requiredWord = requiredWords[normalised];
  if (requiredWord && !words.includes(requiredWord)) {
    return `The response does not satisfy the required word constraint: ${requiredWord}.`;
  }
  if (normalised === 'under-12-words' && words.length >= 12) {
    return 'The response is not under 12 words.';
  }
  return null;
}
