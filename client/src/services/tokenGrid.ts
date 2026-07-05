export interface TokenCell {
  text: string;
  kind: 'mask' | 'changed' | 'punctuation' | 'stable';
}

export function buildTokenCells(currentText: string, previousText = ''): TokenCell[] {
  const currentTokens = tokenizeForGrid(currentText);
  const previousTokens = tokenizeForGrid(previousText);

  return currentTokens.map((text, index) => {
    if (isMaskToken(text)) {
      return { text, kind: 'mask' };
    }
    if (isPunctuationToken(text)) {
      return { text, kind: 'punctuation' };
    }
    if (previousTokens[index] !== undefined && previousTokens[index] !== text) {
      return { text, kind: 'changed' };
    }
    return { text, kind: 'stable' };
  });
}

function tokenizeForGrid(text: string): string[] {
  return text
    .replace(/\\n/g, '\n')
    .match(/\[\s*mask\s*\]|<mask>|\.{3}|[\w'-]+|[^\s]/gi)
    ?? [];
}

function isMaskToken(text: string): boolean {
  return /^(?:\[\s*mask\s*\]|<mask>|\.{3})$/i.test(text);
}

function isPunctuationToken(text: string): boolean {
  return /^[^\w\s]+$/u.test(text);
}
