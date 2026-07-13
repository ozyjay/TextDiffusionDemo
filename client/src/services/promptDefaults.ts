export function defaultConstraintForPrompt(source: 'custom' | 'fallback', promptId: string): string {
  if (source === 'custom') {
    return 'none';
  }

  const defaults: Record<string, string> = {
    'robot-orientation-story': 'include-robot',
    'reef-signal-story': 'include-reef',
    'reef-temperature-python': 'include-reef'
  };
  return defaults[promptId] ?? 'none';
}
