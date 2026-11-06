/*
 * BillKit — Every bill, in your pocket.
 * © 2026 Shaik Gouse Kareem. All rights reserved.
 */

export type PipelineErrorCode =
  | 'no_file'
  | 'file_too_large'
  | 'unsupported_format'
  | 'mixed_upload'
  | 'too_many_pages'
  | 'corrupted_image'
  | 'image_too_small'
  | 'image_too_large'
  | 'ocr_failed'
  | 'classification_failed'
  | 'extraction_failed'
  | 'cancelled'
  | 'timeout'
  | 'llm_auth'
  | 'llm_rate_limited'
  | 'llm_unavailable'
  | 'llm_invalid_response'
  | 'internal';

/** Errors with a stable code and a message that is safe to show to users. */
export class PipelineError extends Error {
  readonly code: PipelineErrorCode;
  readonly retryable: boolean;
  constructor(code: PipelineErrorCode, userMessage: string, options?: { retryable?: boolean; cause?: unknown }) {
    super(userMessage, { cause: options?.cause });
    this.name = 'PipelineError';
    this.code = code;
    this.retryable = options?.retryable ?? false;
  }
}

export function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw new PipelineError('cancelled', 'Processing was cancelled.');
}
