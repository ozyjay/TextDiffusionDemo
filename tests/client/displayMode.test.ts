import { describe, expect, it } from 'vitest';
import { getDisplayModeSettings } from '../../client/src/services/displayMode';

describe('display mode settings', () => {
  it('enables sampled stage count in steps mode', () => {
    expect(getDisplayModeSettings('steps')).toMatchObject({
      requestEveryFrame: false,
      displayedStagesEnabled: true
    });
  });

  it.each(['frames', 'grid'] as const)('requests every frame and disables stage count in %s mode', (mode) => {
    expect(getDisplayModeSettings(mode)).toMatchObject({
      requestEveryFrame: true,
      displayedStagesEnabled: false
    });
  });
});
