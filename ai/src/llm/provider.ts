/*
 * BillKit — Every bill, in your pocket.
 * © 2026 Shaik Gouse Kareem. All rights reserved.
 *
 * G11/G20 — Vision-language-model provider with timeouts, bounded retries
 * (exponential backoff + jitter, Retry-After honoured), error classification,
 * strict output validation and token/cost accounting.
 *
 * Implemented provider: Anthropic Messages API (tool use for structured output).
 * The API key is read from the server environment only and is never sent to
 * the browser or written to logs.
 */
import sharp from 'sharp';
import { PipelineError } from '../errors.ts';
import { buildUserText, PROMPT_VERSION, SYSTEM_PROMPT } from './prompts.ts';
import { VlmOutputSchema, vlmJsonSchema, type VlmOutput } from './schema.ts';

export interface VlmConfig {
  provider: 'anthropic';
  apiKey: string;
  model: string;
  baseUrl: string;
  timeoutMs: number;
  maxRetries: number;
  priceInputPerMTok: number | null;
  priceOutputPerMTok: number | null;
  mode: 'ambiguous_only' | 'always';
}

export interface VlmResult {
  output: VlmOutput;
  model: string;
  promptVersion: string;
  inputTokens: number | null;
  outputTokens: number | null;
  estimatedCostUsd: number | null;
  latencyMs: number;
  attempts: number;
}

export interface VlmProvider {
  readonly name: string;
  readonly config: VlmConfig;
  extract(imagePng: Buffer, ocrText: string, opts: { dateOrderHint: 'DMY' | 'MDY'; signal?: AbortSignal }): Promise<VlmResult>;
}

const PLACEHOLDER_KEYS = new Set(['', 'YOUR_API_KEY', 'CHANGE_ME', 'changeme', 'sk-xxx']);

export function vlmConfigFromEnv(env: NodeJS.ProcessEnv = process.env): VlmConfig | null {
  const provider = (env.AI_PROVIDER ?? 'none').toLowerCase();
  const apiKey = env.AI_PROVIDER_API_KEY ?? '';
  if (provider !== 'anthropic' || PLACEHOLDER_KEYS.has(apiKey.trim())) return null;
  const num = (v: string | undefined) => (v && Number.isFinite(Number(v)) ? Number(v) : null);
  return {
    provider: 'anthropic',
    apiKey: apiKey.trim(),
    model: env.AI_MODEL?.trim() || 'claude-sonnet-5-5',
    baseUrl: (env.AI_BASE_URL?.trim() || 'https://api.anthropic.com').replace(/\/$/, ''),
    timeoutMs: num(env.AI_TIMEOUT_MS) ?? 45_000,
    maxRetries: Math.min(4, Math.max(0, num(env.AI_MAX_RETRIES) ?? 2)),
    priceInputPerMTok: num(env.AI_PRICE_INPUT_PER_MTOK),
    priceOutputPerMTok: num(env.AI_PRICE_OUTPUT_PER_MTOK),
    mode: env.AI_VLM_MODE === 'always' ? 'always' : 'ambiguous_only',
  };
}

export type FetchLike = (input: string, init: RequestInit) => Promise<Response>;

const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => {
      clearTimeout(t);
      reject(new PipelineError('cancelled', 'Processing was cancelled.'));
    }, { once: true });
  });

export function backoffMs(attempt: number, retryAfterHeader: string | null, random = Math.random): number {
  if (retryAfterHeader) {
    const s = Number(retryAfterHeader);
    if (Number.isFinite(s) && s >= 0) return Math.min(30_000, s * 1000);
  }
  const base = 800 * 2 ** attempt;
  return Math.min(15_000, base + Math.floor(random() * base * 0.3));
}

/** Classify an HTTP status into a permanent or retryable pipeline error. */
export function classifyHttpError(status: number): PipelineError {
  if (status === 401 || status === 403) return new PipelineError('llm_auth', 'The AI provider rejected the API key. Check AI_PROVIDER_API_KEY.', { retryable: false });
  if (status === 429) return new PipelineError('llm_rate_limited', 'The AI provider is rate-limiting requests.', { retryable: true });
  if (status === 408 || status === 409 || status >= 500) return new PipelineError('llm_unavailable', 'The AI provider is temporarily unavailable.', { retryable: true });
  return new PipelineError('llm_invalid_response', `The AI provider rejected the request (HTTP ${status}).`, { retryable: false });
}

export class AnthropicVlmProvider implements VlmProvider {
  readonly name = 'anthropic';
  constructor(
    readonly config: VlmConfig,
    private readonly fetchImpl: FetchLike = (u, i) => fetch(u, i),
  ) {}

  async extract(imagePng: Buffer, ocrText: string, opts: { dateOrderHint: 'DMY' | 'MDY'; signal?: AbortSignal }): Promise<VlmResult> {
    // Data minimisation: only a downscaled JPEG of the document and its OCR text are sent — no user identifiers.
    const jpeg = await sharp(imagePng).resize({ width: 1568, height: 1568, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 85 }).toBuffer();
    const body = JSON.stringify({
      model: this.config.model,
      max_tokens: 2500,
      system: SYSTEM_PROMPT,
      tools: [{ name: 'record_bill_extraction', description: 'Record what is printed on the document.', input_schema: vlmJsonSchema() }],
      tool_choice: { type: 'tool', name: 'record_bill_extraction' },
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: jpeg.toString('base64') } },
            { type: 'text', text: buildUserText(ocrText, { dateOrderHint: opts.dateOrderHint }) },
          ],
        },
      ],
    });
    const started = Date.now();
    let attempt = 0;
    let lastError: PipelineError | null = null;
    while (attempt <= this.config.maxRetries) {
      if (opts.signal?.aborted) throw new PipelineError('cancelled', 'Processing was cancelled.');
      const timeout = AbortSignal.timeout(this.config.timeoutMs);
      const signal = opts.signal ? AbortSignal.any([opts.signal, timeout]) : timeout;
      let res: Response;
      try {
        res = await this.fetchImpl(`${this.config.baseUrl}/v1/messages`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-api-key': this.config.apiKey, 'anthropic-version': '2023-06-01' },
          body,
          signal,
        });
      } catch (err) {
        if (opts.signal?.aborted) throw new PipelineError('cancelled', 'Processing was cancelled.');
        lastError = timeout.aborted
          ? new PipelineError('timeout', 'The AI provider did not respond in time.', { retryable: true, cause: err })
          : new PipelineError('llm_unavailable', 'Could not reach the AI provider (network error).', { retryable: true, cause: err });
        if (attempt === this.config.maxRetries) break;
        await sleep(backoffMs(attempt, null), opts.signal);
        attempt++;
        continue;
      }
      if (!res.ok) {
        lastError = classifyHttpError(res.status);
        await res.body?.cancel().catch(() => undefined);
        if (!lastError.retryable || attempt === this.config.maxRetries) break;
        await sleep(backoffMs(attempt, res.headers.get('retry-after')), opts.signal);
        attempt++;
        continue;
      }
      const json = (await res.json().catch(() => null)) as {
        content?: Array<{ type: string; name?: string; input?: unknown }>;
        usage?: { input_tokens?: number; output_tokens?: number };
        model?: string;
      } | null;
      const tool = json?.content?.find((c) => c.type === 'tool_use' && c.name === 'record_bill_extraction');
      const parsed = VlmOutputSchema.safeParse(tool?.input);
      if (!parsed.success) {
        throw new PipelineError('llm_invalid_response', 'The AI provider returned data that failed schema validation; OCR results were used instead.', { retryable: false });
      }
      const inputTokens = json?.usage?.input_tokens ?? null;
      const outputTokens = json?.usage?.output_tokens ?? null;
      const cost =
        inputTokens !== null && outputTokens !== null && this.config.priceInputPerMTok !== null && this.config.priceOutputPerMTok !== null
          ? (inputTokens * this.config.priceInputPerMTok + outputTokens * this.config.priceOutputPerMTok) / 1e6
          : null;
      return {
        output: parsed.data,
        model: json?.model ?? this.config.model,
        promptVersion: PROMPT_VERSION,
        inputTokens,
        outputTokens,
        estimatedCostUsd: cost === null ? null : Math.round(cost * 1e6) / 1e6,
        latencyMs: Date.now() - started,
        attempts: attempt + 1,
      };
    }
    throw lastError ?? new PipelineError('llm_unavailable', 'The AI provider request failed.');
  }
}

export function createVlmProvider(config: VlmConfig | null, fetchImpl?: FetchLike): VlmProvider | null {
  if (!config) return null;
  return new AnthropicVlmProvider(config, fetchImpl);
}
