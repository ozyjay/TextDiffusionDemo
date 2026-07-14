export interface PlaybackSpeedSetting {
  label: string;
  delayMs: number;
}

const SPEED_SETTINGS: PlaybackSpeedSetting[] = [
  { label: 'Slow', delayMs: 3000 },
  { label: 'Relaxed', delayMs: 2400 },
  { label: 'Normal', delayMs: 1800 },
  { label: 'Fast', delayMs: 1200 },
  { label: 'Very fast', delayMs: 700 }
];

export function getPlaybackSpeedSetting(level: number): PlaybackSpeedSetting {
  const index = Math.max(0, Math.min(SPEED_SETTINGS.length - 1, Math.round(level) - 1));
  return SPEED_SETTINGS[index];
}
