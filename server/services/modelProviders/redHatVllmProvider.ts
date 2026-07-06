import type { RefineRequest, Trace } from '../../../shared/types';
import { BaseModelProvider } from './base';
import type { ModelTraceProviderStrategy, ProviderAvailability } from './types';

type FetchLike = typeof fetch;

interface ChatCompletionResponse {
  choices?: Array<{
    message?: {
      content?: string | Array<{ type?: string; text?: string }>;
    };
    text?: string;
  }>;
}

export class RedHatVllmProvider extends BaseModelProvider implements ModelTraceProviderStrategy {
  readonly id = 'redhat-vllm' as const;
  readonly label = 'Red Hat Gemma vLLM';
  readonly kind = 'external' as const;

  constructor(
    private readonly baseUrl: string | undefined = process.env.REDHAT_VLLM_BASE_URL,
    private readonly modelId: string = process.env.REDHAT_VLLM_MODEL ??
      'RedHatAI/gemma-4-26B-A4B-it-FP8-Dynamic',
    private readonly apiKey: string = process.env.REDHAT_VLLM_API_KEY ?? 'EMPTY',
    private readonly fetchImpl: FetchLike = fetch
  ) {
    super();
  }

  supports(request: RefineRequest): boolean {
    return request.outputType === 'story';
  }

  async isAvailable(): Promise<ProviderAvailability> {
    const baseUrl = this.normalisedBaseUrl();
    if (!baseUrl) {
      return this.updateAvailability({
        configured: false,
        available: false,
        reason: 'REDHAT_VLLM_BASE_URL is not set.'
      });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1000);

    try {
      const response = await this.fetchImpl(`${baseUrl}/models`, {
        method: 'GET',
        headers: this.headers(),
        signal: controller.signal
      });
      return this.updateAvailability({
        configured: true,
        available: response.ok,
        reason: response.ok ? 'vLLM models endpoint is reachable.' : `vLLM models returned HTTP ${response.status}.`
      });
    } catch (error) {
      return this.updateAvailability({
        configured: true,
        available: false,
        reason: error instanceof Error ? error.message : 'vLLM health check failed.'
      });
    } finally {
      clearTimeout(timeout);
    }
  }

  async refine(request: RefineRequest, seedTrace: Trace, timeoutMs: number): Promise<Trace | null> {
    const baseUrl = this.normalisedBaseUrl();
    if (!baseUrl) {
      return null;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await this.fetchImpl(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify({
          model: this.modelId,
          messages: [
            {
              role: 'user',
              content: buildPrompt(request, seedTrace)
            }
          ],
          max_tokens: request.length === 'detailed' ? 160 : 96,
          temperature: request.creativity === 'surprising' ? 0.7 : 0
        }),
        signal: controller.signal
      });

      if (!response.ok) {
        this.setStatus('error', `vLLM returned HTTP ${response.status}.`);
        return null;
      }

      const rawText = extractText(await response.json());
      if (!rawText.trim()) {
        this.setStatus('no-trace', 'vLLM response did not include message content.');
        return null;
      }

      return buildTraceFromFinal(seedTrace, rawText);
    } catch (error) {
      this.setStatus('error', error instanceof Error ? error.message : 'vLLM request failed.');
      return null;
    } finally {
      clearTimeout(timeout);
    }
  }

  private normalisedBaseUrl(): string {
    const trimmed = this.baseUrl?.trim().replace(/\/$/, '') ?? '';
    if (!trimmed) {
      return '';
    }
    return trimmed.endsWith('/v1') ? trimmed : `${trimmed}/v1`;
  }

  private headers(): HeadersInit {
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.apiKey}`
    };
  }
}

function buildPrompt(request: RefineRequest, seedTrace: Trace): string {
  const prompt = (seedTrace.prompt || request.promptId).trim();
  return [
    'Write the final answer for a simplified, diffusion-inspired public university Open Day demo.',
    `Prompt: ${prompt}`,
    `Style: ${request.style}.`,
    `Creativity: ${request.creativity}.`,
    `Length: ${request.length}.`,
    `Constraint: ${constraintText(request.constraint)}.`,
    '',
    'Keep it safe, concise, and suitable for visitors reading from 2-3 metres away.',
    'Return only the final answer, with no markdown fence and no explanation.'
  ].join('\n');
}

function buildTraceFromFinal(seedTrace: Trace, rawText: string): Trace {
  const finalText = cleanGeneratedText(rawText) || seedTrace.stages.at(-1)?.text.trim() || 'No model output was generated.';
  const prompt = seedTrace.prompt.trim();
  const rough = firstSentence(finalText);
  const clear = firstSentences(finalText, 2);

  return {
    ...seedTrace,
    id: `${seedTrace.promptId}-redhat-vllm`,
    stages: [
      {
        label: 'Noise',
        text: buildNoiseLine(prompt, finalText),
        note: 'The vLLM model output is converted into a noisy starting point for the public demo.'
      },
      {
        label: 'Rough',
        text: rough,
        note: 'A first readable idea appears from the model-assisted result.'
      },
      {
        label: 'Clear',
        text: clear,
        note: 'The draft becomes clearer before the final pass.'
      },
      {
        label: 'Styled',
        text: finalText,
        note: 'The live model result is shown as a styled whole-text revision.'
      },
      {
        label: 'Final',
        text: finalText,
        rawText,
        note: 'Red Hat Gemma via vLLM generated the final pass after the visible staged display.'
      }
    ]
  };
}

function extractText(data: unknown): string {
  if (!isRecord(data)) {
    return '';
  }
  const response = data as ChatCompletionResponse;
  const choice = response.choices?.[0];
  const content = choice?.message?.content;
  if (typeof content === 'string') {
    return content;
  }
  if (Array.isArray(content)) {
    return content
      .filter((part) => part.type === 'text' && typeof part.text === 'string')
      .map((part) => part.text)
      .join('\n');
  }
  return typeof choice?.text === 'string' ? choice.text : '';
}

function cleanGeneratedText(text: string): string {
  return text
    .trim()
    .replace(/^```(?:\w+)?\s*/, '')
    .replace(/\s*```$/, '')
    .replace(/<\|[^>]+?\|>/g, '')
    .replace(/<\/?s>|<bos>|<eos>|\[PAD\]|\[UNK\]/g, '')
    .trim();
}

function constraintText(value: string): string {
  const labels: Record<string, string> = {
    none: 'none',
    'include-reef': 'include reef',
    'include-robot': 'include robot',
    university: 'include university',
    'under-12-words': 'keep it under 12 words',
    rhyme: 'make it rhyme'
  };
  return labels[value.trim().toLowerCase()] ?? (value.trim() || 'none');
}

function buildNoiseLine(prompt: string, finalText: string): string {
  const seen = new Set<string>();
  const words: string[] = [];
  for (const source of [prompt, finalText]) {
    for (const match of source.matchAll(/[A-Za-z][A-Za-z'-]{2,}/g)) {
      const word = match[0].toLowerCase();
      if (['the', 'and', 'for', 'with', 'that', 'this', 'from', 'into', 'about', 'write', 'short'].includes(word)) {
        continue;
      }
      if (!seen.has(word)) {
        seen.add(word);
        words.push(word);
      }
      if (words.length >= 8) {
        return [...words.slice(0, 4), '???', ...words.slice(4)].join(' / ');
      }
    }
  }
  return words.length > 0 ? [...words, '???'].join(' / ') : 'idea / draft / ??? / final';
}

function firstSentence(text: string): string {
  return firstSentences(text, 1);
}

function firstSentences(text: string, count: number): string {
  const sentences = text.split(/(?<=[.!?])\s+/).map((part) => part.trim()).filter(Boolean);
  return sentences.length > 0 ? sentences.slice(0, count).join(' ') : text.trim();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
