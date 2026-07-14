export type DisplayMode = 'steps' | 'frames' | 'grid';

export interface DisplayModeSettings {
  requestEveryFrame: boolean;
  displayedStagesEnabled: boolean;
  help: string;
}

export function getDisplayModeSettings(mode: DisplayMode): DisplayModeSettings {
  if (mode === 'steps') {
    return {
      requestEveryFrame: false,
      displayedStagesEnabled: true,
      help: 'Choose how many sampled stages appear. The model still runs every denoising pass.'
    };
  }

  if (mode === 'frames') {
    return {
      requestEveryFrame: true,
      displayedStagesEnabled: false,
      help: 'Every frame requests all frames returned by the model, so the stage count does not apply.'
    };
  }

  return {
    requestEveryFrame: true,
    displayedStagesEnabled: false,
    help: 'Token grid uses every returned frame and changes how each frame is displayed.'
  };
}
