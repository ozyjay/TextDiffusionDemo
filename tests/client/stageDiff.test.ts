import { describe, expect, it } from 'vitest';
import { buildHighlightedSegments } from '../../client/src/services/stageDiff';

describe('stage diff highlighting', () => {
  it('marks words that were introduced in the current stage', () => {
    const segments = buildHighlightedSegments(
      'robot / campus / lost',
      'A robot rolled across campus with a map.'
    );

    expect(segments.filter((segment) => segment.changed).map((segment) => segment.text)).toContain(
      'rolled'
    );
    expect(segments.find((segment) => segment.text === 'robot')?.changed).toBe(false);
  });

  it('keeps punctuation attached to readable segments', () => {
    const segments = buildHighlightedSegments('print too high', 'print(\"Too high. Try again.\")');

    expect(segments.map((segment) => segment.text).join('')).toBe('print("Too high. Try again.")');
    expect(segments.some((segment) => segment.changed)).toBe(true);
  });
});
