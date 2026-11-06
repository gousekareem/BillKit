# 20. Error handling

**Pipeline errors** (`PipelineError` with `code`, `retryable`): `no_file`, `file_too_large`, `unsupported_format`, `mixed_upload`, `too_many_pages`, `corrupted_image`, `image_too_small`, `image_too_large`, `ocr_failed`, `classification_failed`, `extraction_failed`, `cancelled`, `timeout`, `llm_auth`, `llm_rate_limited`, `llm_unavailable`, `llm_invalid_response`, `internal`. Each has a user-facing message and, where useful, a suggestion (for example "retake in better light").

**Graceful degradation**
- If the VLM fails (timeout, 5xx, 429, invalid output), the result comes from OCR rules alone, with an info note in the validation panel. The scan does not fail.
- VLM retries: at most `AI_MAX_RETRIES` (default 2), exponential backoff with jitter, `Retry-After` honoured; 401/403 and 4xx are permanent and are not retried. Each call has a timeout of `AI_TIMEOUT_MS` (45 s by default).
- Low quality → warnings and tips, never a hard stop. Missing fields → shown as Missing, never invented.
- Cancel works at any stage (AbortController checked between stages and inside OCR).
- After a server restart, jobs that were running become `failed: interrupted` (retry available) and queued jobs are re-queued.

**HTTP layer**: zod → `400 invalid_input` with per-field messages (shown next to the form fields); `HttpError` → its status and code; file limits → `413`; rate limit → `429`; unknown → `500` with a request id and no internals.

**Frontend**: every API call goes through one wrapper that turns errors into `ApiError`. Pages show inline errors with retry buttons, toasts announce outcomes in an `aria-live` region, a lost connection shows the offline banner, and the review form keeps the user's edits through reprocessing and errors.

**Known gap**: there is no overall time limit for a whole job (only the VLM call has one). A pathological image could keep a worker busy until it is cancelled.

© 2026 Shaik Gouse Kareem. All rights reserved.
