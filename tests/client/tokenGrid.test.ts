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

  it('marks masks and changed token positions', () => {
    expect(buildTokenCells('The robot found campus.', 'The robot ... campus.')).toEqual([
      { text: 'The', kind: 'stable' },
      { text: 'robot', kind: 'stable' },
      { text: 'found', kind: 'changed' },
      { text: 'campus', kind: 'stable' },
      { text: '.', kind: 'stable' }
    ]);
    expect(buildTokenCells('The <mask> campus.')[1]).toEqual({ text: '<mask>', kind: 'mask' });
  });
});
