import { describe, expect, it } from 'vitest';
import { buildTokenCells } from '../../client/src/services/tokenGrid';

describe('token grid', () => {
  it('splits words, punctuation, and mask markers into cells', () => {
    expect(buildTokenCells('The robot [MASK] campus.').map((cell) => cell.text)).toEqual([
      'The',
      'robot',
      '[MASK]',
      'campus',
      '.'
    ]);
  });

  it('marks masks, changed token positions, and punctuation', () => {
    expect(buildTokenCells('The robot found campus.', 'The robot ... campus.')).toEqual([
      { text: 'The', kind: 'stable' },
      { text: 'robot', kind: 'stable' },
      { text: 'found', kind: 'changed' },
      { text: 'campus', kind: 'stable' },
      { text: '.', kind: 'punctuation' }
    ]);
    expect(buildTokenCells('The <mask> campus.')[1]).toEqual({ text: '<mask>', kind: 'mask' });
  });

  it('does not highlight punctuation-only cells as semantic changes', () => {
    expect(buildTokenCells('Pi was , , .', 'Pi was a a .').slice(2)).toEqual([
      { text: ',', kind: 'punctuation' },
      { text: ',', kind: 'punctuation' },
      { text: '.', kind: 'punctuation' }
    ]);
  });
});
