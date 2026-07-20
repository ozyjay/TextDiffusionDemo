import type { RefineRequest, RefinementStage, Trace } from '../../../shared/types';
import { assessModelOutput } from '../modelOutputQuality';
import { BaseModelProvider } from './base';
import type { ModelTraceProviderStrategy, ProviderAvailability } from './types';

type FetchLike = typeof fetch;
type JobState = 'queued' | 'running' | 'complete' | 'failed' | 'cancelled';

interface ModelDeckFrame {
  step: number;
  total_steps?: number;
  text: string;
  stable_tokens?: number;
  masked_tokens?: number | null;
  complete?: boolean;
}

interface ModelDeckJob {
  job_id: string;
  state: JobState;
  model?: string;
  text?: string;
  frames?: ModelDeckFrame[];
  seed?: number;
  frame_count?: number;
  metrics?: { total_seconds?: number };
  error?: unknown;
  detail?: unknown;
}

export interface ModelDeckProviderOptions {
  baseUrl?: string;
  model?: string;
  denoisingSteps?: number;
  pollIntervalMs?: number;
  fetchImpl?: FetchLike;
}

export class ModelDeckProvider extends BaseModelProvider implements ModelTraceProviderStrategy {
  readonly id = 'modeldeck' as const;
  readonly label = 'ModelDeck text diffusion';
  readonly kind = 'external' as const;

  private readonly baseUrl: string;
  private readonly model: string;
  private readonly denoisingSteps: number;
  private readonly pollIntervalMs: number;
  private readonly fetchImpl: FetchLike;

  constructor(options: ModelDeckProviderOptions = {}) {
    super();
    this.baseUrl = normaliseBaseUrl(options.baseUrl ?? process.env.MODELDECK_BASE_URL ?? 'http://127.0.0.1:8600');
    this.model = options.model ?? process.env.MODELDECK_MODEL ?? 'text-diffusion-lab-q4';
    this.denoisingSteps = normaliseInteger(
      options.denoisingSteps ?? Number(process.env.MODELDECK_DENOISING_STEPS),
      48,
      1,
      48
    );
    this.pollIntervalMs = normalisePositiveNumber(
      options.pollIntervalMs ?? Number(process.env.MODELDECK_POLL_INTERVAL_MS),
      250
    );
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  supports(request: RefineRequest): boolean {
    return request.outputType === 'story';
  }

  async isAvailable(): Promise<ProviderAvailability> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1000);

    try {
      const health = await this.fetchImpl(`${this.baseUrl}/v1/health`, {
        method: 'GET',
        signal: controller.signal
      });
      if (!health.ok) {
        return this.updateAvailability({
          configured: true,
          available: false,
          reason: await httpError('ModelDeck health check', health)
        });
      }

      const modelsResponse = await this.fetchImpl(`${this.baseUrl}/v1/models`, {
        method: 'GET',
        signal: controller.signal
      });
      if (!modelsResponse.ok) {
        return this.updateAvailability({
          configured: true,
          available: false,
          reason: await httpError('ModelDeck models check', modelsResponse)
        });
      }

      const configuredModel = findModel(await readJson(modelsResponse), this.model);
      if (!configuredModel) {
        return this.updateAvailability({
          configured: true,
          available: false,
          reason: `ModelDeck model "${this.model}" is unavailable. Start or install that model in ModelDeck.`
        });
      }
      if (configuredModel.ready !== true) {
        const routeState = configuredModel.state?.toLowerCase();
        if (routeState === 'stopped') {
          return this.updateAvailability({
            configured: true,
            available: false,
            reason: `ModelDeck route "${this.model}" is stopped. Start it from ModelDeck.`
          });
        }
        if (routeState === 'loading' || routeState === 'starting' || routeState === 'queued') {
          return this.updateAvailability({
            configured: true,
            available: false,
            reason: `ModelDeck route "${this.model}" is ${routeState}.`
          });
        }
        return this.updateAvailability({
          configured: true,
          available: false,
          reason: `ModelDeck route "${this.model}" is not ready. Start it from ModelDeck.`
        });
      }

      return this.updateAvailability({
        configured: true,
        available: true,
        reason: `ModelDeck gateway and route "${this.model}" are ready.`
      });
    } catch (error) {
      return this.updateAvailability({
        configured: true,
        available: false,
        reason: describeError(error, 'ModelDeck gateway unavailable.')
      });
    } finally {
      clearTimeout(timeout);
    }
  }

  async refine(
    request: RefineRequest,
    seedTrace: Trace,
    timeoutMs: number,
    signal?: AbortSignal
  ): Promise<Trace | null> {
    const controller = new AbortController();
    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs);
    const abort = () => controller.abort();
    if (signal?.aborted) {
      controller.abort();
    } else {
      signal?.addEventListener('abort', abort, { once: true });
    }
    let jobId: string | undefined;

    try {
      for (let attempt = 0; attempt < 2; attempt += 1) {
        const generationRequest = attempt === 0
          ? request
          : buildSaferRetryRequest(request, this.denoisingSteps);
        const response = await this.fetchImpl(`${this.baseUrl}/v1/diffuse`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(buildGenerationRequest(generationRequest, seedTrace, this.model, this.denoisingSteps)),
          signal: controller.signal
        });
        if (!response.ok) {
          this.setStatus('error', await httpError('ModelDeck generation submission', response));
          return null;
        }

        const submitted = parseJob(await readJson(response));
        jobId = submitted?.job_id;
        if (!submitted || !jobId) {
          this.setStatus('invalid', 'ModelDeck returned a malformed job response without job_id or state.');
          return null;
        }

        let job = submitted;
        const frames: ModelDeckFrame[] = [];
        const seenFrames = new Set<string>();
        appendFrames(frames, seenFrames, job.frames);

        while (job.state === 'queued' || job.state === 'running') {
          await abortableDelay(this.pollIntervalMs, controller.signal);
          const pollResponse = await this.fetchImpl(
            `${this.baseUrl}/v1/jobs/${encodeURIComponent(jobId)}`,
            { method: 'GET', signal: controller.signal }
          );
          if (!pollResponse.ok) {
            this.setStatus('error', await httpError('ModelDeck job poll', pollResponse));
            return null;
          }
          const nextJob = parseJob(await readJson(pollResponse));
          if (!nextJob || nextJob.job_id !== jobId) {
            this.setStatus('invalid', 'ModelDeck returned a malformed or mismatched job response.');
            return null;
          }
          job = nextJob;
          appendFrames(frames, seenFrames, job.frames);
        }

        if (job.state === 'failed') {
          this.setStatus('error', `ModelDeck job failed${safeDetail(job.error ?? job.detail)}.`);
          return null;
        }
        if (job.state === 'cancelled') {
          this.setStatus('error', 'ModelDeck job was cancelled.');
          return null;
        }
        if (job.state !== 'complete' || typeof job.text !== 'string') {
          this.setStatus('invalid', 'ModelDeck completed with a malformed response or unknown job state.');
          return null;
        }

        const quality = assessModelOutput(job.text, request);
        if (quality.valid) {
          const effectiveDenoisingSteps = generationRequest.denoisingSteps ?? this.denoisingSteps;
          return buildModelDeckTrace(
            seedTrace,
            request,
            job,
            frames,
            this.model,
            effectiveDenoisingSteps,
            attempt === 1
          );
        }
        if (attempt === 1) {
          this.setStatus('invalid', `ModelDeck output failed quality checks: ${quality.reasons.join(' ')}`);
          return null;
        }
        jobId = undefined;
      }

      return null;
    } catch (error) {
      if (jobId && controller.signal.aborted) {
        await this.cancelJob(jobId);
      }
      const reason = timedOut
        ? `ModelDeck request timed out after ${timeoutMs}ms.`
        : signal?.aborted
          ? 'ModelDeck request was cancelled.'
          : describeError(error, 'ModelDeck request failed.');
      this.setStatus('error', reason);
      return null;
    } finally {
      clearTimeout(timeout);
      signal?.removeEventListener('abort', abort);
    }
  }

  private async cancelJob(jobId: string): Promise<void> {
    try {
      await this.fetchImpl(`${this.baseUrl}/v1/jobs/${encodeURIComponent(jobId)}/cancel`, {
        method: 'POST'
      });
    } catch {
      // Cancellation is best-effort; preserve the original timeout or abort reason.
    }
  }
}

function buildGenerationRequest(
  request: RefineRequest,
  seedTrace: Trace,
  model: string,
  defaultDenoisingSteps: number
) {
  const maxLength = request.maxLength ?? lengthToMaxLength(request.length);
  return {
    model,
    prompt: buildControlledPrompt(request, seedTrace.prompt),
    max_length: maxLength,
    denoising_steps: request.denoisingSteps ?? defaultDenoisingSteps,
    block_length: request.blockLength ?? maxLength,
    temperature: request.temperature ?? creativityToTemperature(request.creativity),
    seed: request.seed ?? 11,
    stream_intermediate_frames: true
  };
}

function buildControlledPrompt(request: RefineRequest, prompt: string): string {
  return [
    prompt.trim(),
    '',
    'Output requirements:',
    '- Return only the final answer in plain text.',
    '- Do not include thoughts, reasoning, analysis, headings, Markdown, or LaTeX.',
    `- Use a ${request.style.trim() || 'clear'} style.`,
    `- ${lengthInstruction(request.length)}`,
    `- ${constraintInstruction(request.constraint)}`,
    '- Finish the answer cleanly before the generation limit.'
  ].join('\n');
}

function buildModelDeckTrace(
  seedTrace: Trace,
  request: RefineRequest,
  job: ModelDeckJob,
  frames: ModelDeckFrame[],
  configuredModel: string,
  denoisingSteps: number,
  retried: boolean
): Trace {
  const intermediateFrames = frames.filter((frame) => !frame.complete);
  const displayedFrames = request.includeEveryFrame
    ? intermediateFrames
    : sampleFrames(intermediateFrames, Math.max(0, request.steps - 1));
  const stages: RefinementStage[] = displayedFrames
    .map((frame) => ({
      label: `Frame ${frame.step}/${frame.total_steps ?? '?'}`,
      text: frame.text,
      note: 'Intermediate whole-text frame returned by ModelDeck.'
    }));
  stages.push({
    label: 'Final',
    text: job.text as string,
    rawText: job.text,
    note: 'Exact final text returned by ModelDeck.'
  });

  return {
    ...seedTrace,
    id: `${seedTrace.promptId}-modeldeck`,
    stages,
    metadata: {
      provider: 'modeldeck',
      model: job.model ?? configuredModel,
      seed: job.seed ?? null,
      frameCount: job.frame_count ?? frames.length,
      returnedFrameCount: intermediateFrames.length,
      displayedFrameCount: displayedFrames.length,
      denoisingSteps,
      retried,
      totalSeconds: job.metrics?.total_seconds ?? null
    }
  };
}

function sampleFrames(frames: ModelDeckFrame[], count: number): ModelDeckFrame[] {
  if (count <= 0) {
    return [];
  }
  if (frames.length <= count) {
    return frames;
  }
  if (count === 1) {
    return [frames[0]];
  }
  return Array.from({ length: count }, (_value, index) =>
    frames[Math.round((index * (frames.length - 1)) / (count - 1))]
  );
}

function buildSaferRetryRequest(request: RefineRequest, denoisingSteps: number): RefineRequest {
  return {
    ...request,
    maxLength: Math.min(request.maxLength ?? lengthToMaxLength(request.length), 96),
    denoisingSteps,
    temperature: 0.4,
    seed: (request.seed ?? 11) + 1
  };
}

function appendFrames(target: ModelDeckFrame[], seen: Set<string>, frames: ModelDeckFrame[] | undefined): void {
  for (const frame of frames ?? []) {
    if (!isFrame(frame)) {
      continue;
    }
    const key = `${frame.step}\u0000${frame.text}`;
    if (!seen.has(key)) {
      seen.add(key);
      target.push(frame);
    }
  }
}

function parseJob(value: unknown): ModelDeckJob | null {
  if (!isRecord(value) || typeof value.job_id !== 'string' || !isJobState(value.state)) {
    return null;
  }
  return value as unknown as ModelDeckJob;
}

function findModel(value: unknown, alias: string): { ready?: boolean; state?: string } | null {
  if (!isRecord(value) && !Array.isArray(value)) {
    return null;
  }
  const candidates = Array.isArray(value)
    ? value
    : Array.isArray(value.models)
      ? value.models
      : Array.isArray(value.data)
        ? value.data
        : [];
  for (const candidate of candidates) {
    if (!isRecord(candidate)) {
      continue;
    }
    const id = candidate.id ?? candidate.model ?? candidate.alias ?? candidate.name;
    if (id === alias) {
      const state = candidate.state ?? candidate.status;
      return {
        ready: candidate.ready === true,
        state: typeof state === 'string' ? state : undefined
      };
    }
  }
  return null;
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    throw new Error(`ModelDeck returned malformed JSON from ${new URL(response.url || 'http://modeldeck.local').pathname}.`);
  }
}

async function httpError(context: string, response: Response): Promise<string> {
  let detail = '';
  try {
    const body = await response.json();
    if (isRecord(body)) {
      detail = safeDetail(body.detail ?? body.error ?? body.message);
    }
  } catch {
    // HTTP status remains actionable when the response has no JSON detail.
  }
  return `${context} returned HTTP ${response.status}${detail}.`;
}

function safeDetail(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) {
    return '';
  }
  return `: ${value.trim().slice(0, 300)}`;
}

function describeError(error: unknown, fallback: string): string {
  if (error instanceof Error && error.name === 'AbortError') {
    return 'ModelDeck request was aborted.';
  }
  if (error instanceof Error && error.message) {
    return `${fallback.replace(/\.$/, '')}: ${error.message}`;
  }
  return fallback;
}

function lengthToMaxLength(length: RefineRequest['length']): number {
  return length === 'short' ? 96 : length === 'detailed' ? 256 : 160;
}

function lengthInstruction(length: RefineRequest['length']): string {
  if (length === 'short') {
    return 'Answer in one or two complete sentences, using at most 50 words and no list.';
  }
  if (length === 'detailed') {
    return 'Answer in at most 170 words, using short paragraphs.';
  }
  return 'Answer in two to four complete sentences, using at most 90 words.';
}

function constraintInstruction(constraint: string): string {
  const instructions: Record<string, string> = {
    none: 'No additional content constraint.',
    'include-reef': 'Include the word "reef" naturally.',
    'include-robot': 'Include the word "robot" naturally.',
    university: 'Include the word "university" naturally.',
    'under-12-words': 'Keep the entire answer under 12 words.',
    rhyme: 'Make the answer rhyme.'
  };
  return instructions[constraint.trim().toLowerCase()] ?? `Follow this constraint: ${constraint.trim() || 'none'}.`;
}

function creativityToTemperature(creativity: RefineRequest['creativity']): number {
  return creativity === 'safer' ? 0 : creativity === 'surprising' ? 1.1 : 0.8;
}

function normaliseBaseUrl(value: string): string {
  return value.trim().replace(/\/+$/, '');
}

function normalisePositiveNumber(value: number, fallback: number): number {
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function normaliseInteger(value: number, fallback: number, minimum: number, maximum: number): number {
  if (!Number.isFinite(value)) {
    return fallback;
  }
  return Math.max(minimum, Math.min(maximum, Math.round(value)));
}

function isJobState(value: unknown): value is JobState {
  return value === 'queued' || value === 'running' || value === 'complete' || value === 'failed' || value === 'cancelled';
}

function isFrame(value: unknown): value is ModelDeckFrame {
  return isRecord(value) && Number.isFinite(value.step) && typeof value.text === 'string' && value.text.length > 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function abortableDelay(milliseconds: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException('Aborted', 'AbortError'));
      return;
    }
    const abort = () => {
      clearTimeout(timeout);
      reject(new DOMException('Aborted', 'AbortError'));
    };
    const timeout = setTimeout(() => {
      signal.removeEventListener('abort', abort);
      resolve();
    }, milliseconds);
    signal.addEventListener('abort', abort, { once: true });
  });
}
