import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import type { RefineRequest, Trace } from '../../shared/types';
import { validateTrace } from './traceService';

type SpawnLike = typeof spawn;

interface PendingRequest {
  resolve: (trace: Trace | null) => void;
  timeout: NodeJS.Timeout;
}

export interface DiffusionGemmaWorkerClientOptions {
  pythonPath?: string;
  modelId?: string;
  engine?: string;
  spawnImpl?: SpawnLike;
}

export class DiffusionGemmaWorkerClient {
  private process: ChildProcessWithoutNullStreams | null = null;
  private stdoutBuffer = '';
  private readonly pending = new Map<string, PendingRequest>();
  private readonly pythonPath: string;
  private readonly modelId: string;
  private readonly engine: string;
  private readonly spawnImpl: SpawnLike;

  constructor(options: DiffusionGemmaWorkerClientOptions = {}) {
    this.pythonPath = options.pythonPath ?? process.env.DIFFUSIONGEMMA_PYTHON ?? defaultDiffusionGemmaPythonPath();
    this.modelId = options.modelId ?? process.env.DIFFUSIONGEMMA_MODEL ?? 'google/diffusiongemma-26B-A4B-it';
    this.engine = options.engine ?? process.env.DIFFUSIONGEMMA_ENGINE ?? defaultDiffusionGemmaEngine();
    this.spawnImpl = options.spawnImpl ?? spawn;
  }

  async requestTrace(request: RefineRequest, seedTrace: Trace, timeoutMs: number): Promise<Trace | null> {
    if (request.outputType !== 'story') {
      return null;
    }

    const worker = this.ensureProcess();
    const id = randomUUID();
    const payload = JSON.stringify({ id, request, seedTrace });

    return new Promise<Trace | null>((resolve) => {
      const timeout = setTimeout(() => {
        this.pending.delete(id);
        resolve(null);
      }, timeoutMs);

      this.pending.set(id, { resolve, timeout });
      worker.stdin.write(`${payload}\n`);
    });
  }

  stop() {
    this.process?.kill();
    this.process = null;
    this.rejectPending();
  }

  private ensureProcess(): ChildProcessWithoutNullStreams {
    if (this.process && !this.process.killed) {
      return this.process;
    }

    const env = {
      ...process.env,
      DIFFUSIONGEMMA_ENGINE: this.engine,
      DIFFUSIONGEMMA_MODEL: this.modelId,
      PYTHONPATH: [
        path.join(process.cwd(), 'adapters/diffusiongemma_adapter'),
        process.env.PYTHONPATH
      ].filter(Boolean).join(path.delimiter)
    };

    const child = this.spawnImpl(this.pythonPath, ['-m', 'diffusiongemma_adapter.worker'], {
      cwd: process.cwd(),
      env,
      stdio: ['pipe', 'pipe', 'pipe']
    }) as ChildProcessWithoutNullStreams;

    child.stdout.on('data', (chunk: Buffer | string) => {
      this.handleStdout(String(chunk));
    });
    child.stderr.on('data', () => {
      // Drain stderr so model loader progress or warnings cannot block the worker.
    });
    child.on('exit', () => {
      this.process = null;
      this.rejectPending();
    });
    child.on('error', () => {
      this.process = null;
      this.rejectPending();
    });

    this.process = child;
    return child;
  }

  private handleStdout(chunk: string) {
    this.stdoutBuffer += chunk;
    const lines = this.stdoutBuffer.split(/\r?\n/);
    this.stdoutBuffer = lines.pop() ?? '';
    for (const line of lines) {
      if (line.trim()) {
        this.handleLine(line);
      }
    }
  }

  private handleLine(line: string) {
    let message: unknown;
    try {
      message = JSON.parse(line);
    } catch {
      return;
    }
    if (!isRecord(message) || typeof message.id !== 'string') {
      return;
    }

    const pending = this.pending.get(message.id);
    if (!pending) {
      return;
    }
    clearTimeout(pending.timeout);
    this.pending.delete(message.id);

    if (message.ok !== true || !isRecord(message.trace)) {
      pending.resolve(null);
      return;
    }

    try {
      pending.resolve(validateTrace(message.trace as unknown as Trace));
    } catch {
      pending.resolve(null);
    }
  }

  private rejectPending() {
    for (const [id, pending] of this.pending) {
      clearTimeout(pending.timeout);
      pending.resolve(null);
      this.pending.delete(id);
    }
  }
}

const defaultClient = new DiffusionGemmaWorkerClient();
const hfClient = new DiffusionGemmaWorkerClient({ engine: 'transformers' });
const mlxClient = new DiffusionGemmaWorkerClient({ engine: 'mlx' });

export async function requestDiffusionGemmaTrace(
  request: RefineRequest,
  seedTrace: Trace,
  timeoutMs: number
): Promise<Trace | null> {
  return defaultClient.requestTrace(request, seedTrace, timeoutMs);
}

export async function requestHfDiffusionGemmaTrace(
  request: RefineRequest,
  seedTrace: Trace,
  timeoutMs: number
): Promise<Trace | null> {
  return hfClient.requestTrace(request, seedTrace, timeoutMs);
}

export async function requestMlxDiffusionGemmaTrace(
  request: RefineRequest,
  seedTrace: Trace,
  timeoutMs: number
): Promise<Trace | null> {
  return mlxClient.requestTrace(request, seedTrace, timeoutMs);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function defaultDiffusionGemmaPythonPath(platform = process.platform): string {
  return platform === 'win32'
    ? '.venv-diffusiongemma\\Scripts\\python.exe'
    : '.venv-diffusiongemma/bin/python';
}

export function defaultDiffusionGemmaEngine(platform = process.platform): string {
  return platform === 'darwin' ? 'mlx' : 'transformers';
}
