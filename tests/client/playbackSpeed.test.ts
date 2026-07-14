import { describe, expect, it } from 'vitest';
import { getPlaybackSpeedSetting } from '../../client/src/services/playbackSpeed';

describe('playback speed', () => {
  it('gets faster as the slider moves from left to right', () => {
    const slow = getPlaybackSpeedSetting(1);
    const normal = getPlaybackSpeedSetting(3);
    const fast = getPlaybackSpeedSetting(5);

    expect(slow.label).toBe('Slow');
    expect(normal.label).toBe('Normal');
    expect(fast.label).toBe('Very fast');
    expect(slow.delayMs).toBeGreaterThan(normal.delayMs);
    expect(normal.delayMs).toBeGreaterThan(fast.delayMs);
  });

  it('clamps unexpected values to the supported range', () => {
    expect(getPlaybackSpeedSetting(-10).label).toBe('Slow');
    expect(getPlaybackSpeedSetting(99).label).toBe('Very fast');
  });
});
