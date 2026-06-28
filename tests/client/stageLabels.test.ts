import { describe, expect, it } from 'vitest';
import { buildStageDisplay, formatStageLabel, formatStageText } from '../../client/src/services/stageLabels';

describe('stage labels', () => {
  it('hides model denoising counts for public display', () => {
    expect(formatStageLabel({ label: 'Mask 0/32', text: 'x', note: 'x' }, 0, false)).toBe('Noise');
    expect(formatStageLabel({ label: 'Denoise 1/32', text: 'x', note: 'x' }, 1, false)).toBe(
      'Early draft'
    );
    expect(formatStageLabel({ label: 'Denoise 4/32', text: 'x', note: 'x' }, 2, false)).toBe(
      'Clearer draft'
    );
  });

  it('preserves raw model labels for staff debugging', () => {
    expect(formatStageLabel({ label: 'Denoise 4/32', text: 'x', note: 'x' }, 2, true)).toBe(
      'Denoise 4/32'
    );
  });

  it('separates visible frame count from raw internal model pass count', () => {
    const display = buildStageDisplay({ label: 'Denoise 4/32', text: 'x', note: 'x' }, 2, 4, false);

    expect(display.stepText).toBe('Pass 3 of 4');
    expect(display.label).toBe('Clearer draft');
    expect(display.detail).toBe('Sampled from internal denoising');
    expect(display.debugText).toBe('Internal pass 4 of 32');
  });

  it('shows raw model labels when staff debugging is enabled', () => {
    const display = buildStageDisplay({ label: 'Denoise 4/32', text: 'x', note: 'x' }, 2, 4, true);

    expect(display.label).toBe('Denoise 4/32');
    expect(display.detail).toBe('Internal pass 4 of 32');
  });

  it('shows unresolved mask tokens as ellipses unless staff debugging is enabled', () => {
    const text = 'The robot [MASK] orientation <mask> map.';

    expect(formatStageText(text, false)).toBe('The robot ... orientation ... map.');
    expect(formatStageText(text, true)).toBe(text);
  });
});
