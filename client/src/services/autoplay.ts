import type { OutputType, PromptCard } from '../../../shared/types';

export interface AutoplaySelection {
  outputType: OutputType;
  promptId: string;
}

export function getNextAutoplaySelection(
  prompts: PromptCard[],
  current: AutoplaySelection | null
): AutoplaySelection | null {
  const playlist = buildInterleavedPlaylist(prompts);
  if (playlist.length === 0) {
    return null;
  }

  if (!current) {
    return playlist[0];
  }

  const currentIndex = playlist.findIndex(
    (selection) =>
      selection.outputType === current.outputType && selection.promptId === current.promptId
  );
  const nextIndex = currentIndex < 0 ? 0 : (currentIndex + 1) % playlist.length;

  return playlist[nextIndex];
}

function buildInterleavedPlaylist(prompts: PromptCard[]): AutoplaySelection[] {
  const stories = prompts.filter((prompt) => prompt.outputType === 'story');
  const scripts = prompts.filter((prompt) => prompt.outputType === 'python');
  const length = Math.max(stories.length, scripts.length);
  const playlist: AutoplaySelection[] = [];

  for (let index = 0; index < length; index += 1) {
    const story = stories[index];
    const script = scripts[index];
    if (story) {
      playlist.push({ outputType: story.outputType, promptId: story.id });
    }
    if (script) {
      playlist.push({ outputType: script.outputType, promptId: script.id });
    }
  }

  if (playlist.length > 0) {
    return playlist;
  }

  return prompts.map((prompt) => ({ outputType: prompt.outputType, promptId: prompt.id }));
}
