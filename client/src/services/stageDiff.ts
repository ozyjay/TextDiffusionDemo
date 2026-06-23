export interface HighlightSegment {
  text: string;
  changed: boolean;
}

export function buildHighlightedSegments(previousText: string, currentText: string): HighlightSegment[] {
  const previousWords = new Set(tokeniseWords(previousText));
  const pieces = currentText.match(/\w+|\W+/g) ?? [];

  return pieces.map((piece) => {
    const word = normaliseWord(piece);
    return {
      text: piece,
      changed: word.length > 0 && !previousWords.has(word)
    };
  });
}

function tokeniseWords(text: string): string[] {
  return (text.match(/\w+/g) ?? []).map(normaliseWord).filter(Boolean);
}

function normaliseWord(text: string): string {
  return text.toLowerCase().replace(/^\W+|\W+$/g, '');
}
