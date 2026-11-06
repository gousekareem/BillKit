# Testing

All results below come from **actual runs on 6 November 2026** in the build environment (Linux x86_64, Node 22.23.4, Chrome for Testing 153, Python 3.13). They are copied from the tool output, not estimated.

## Summary

| Suite | Command | Result |
|---|---|---|
| Shared (normalisation, validation) | `npm test -w @billkit/shared` | **28 / 28 passed** |
| AI pipeline (real Tesseract OCR on synthetic images, mocked VLM API) | `npm test -w @billkit/ai` | **66 / 66 passed** |
| Backend API (real Fastify + temporary SQLite + real pipeline) | `npm test -w backend` | **22 / 22 passed** |
| Website components and review flow | `npm test -w website` | **20 / 20 passed** |
| End-to-end (Playwright, Chrome desktop + Pixel 7 profile, axe-core) | `npm run test:e2e` | **11 / 11 passed** |
| Python dataset/training tooling | `pytest training/tests` | **10 / 10 passed** |
| Lint | `npm run lint` | 0 errors, 1 warning (`no-explicit-any` in the evaluation script) |
| Type check (all workspaces) | `npm run typecheck` | passed |
| Production build | `npm run build` | passed: backend bundle, website + 14 prerendered pages |
| Dependency audit | `npm audit` | 0 known vulnerabilities |
| Synthetic smoke evaluation | `npm run eval:smoke` | ran (15 images); a pipeline check only |

Unit/integration total: **136 tests**.

## Raw output (abridged)

```
> @billkit/shared   Test Files  2 passed (2)   Tests  28 passed (28)   Duration 334ms
> @billkit/ai       Test Files  7 passed (7)   Tests  66 passed (66)   Duration 25.71s
> backend           Test Files  2 passed (2)   Tests  22 passed (22)   Duration 12.92s
> website           Test Files  3 passed (3)   Tests  20 passed (20)   Duration 3.59s

Running 11 tests using 1 worker
  ✓ [desktop-chrome] a11y.spec.ts › public pages have no serious/critical axe violations
  ✓ [desktop-chrome] a11y.spec.ts › app pages have no serious/critical axe violations
  ✓ [desktop-chrome] journeys.spec.ts › Journey A: Home → Get Started → Register → Dashboard
  ✓ [desktop-chrome] journeys.spec.ts › Journey B: Upload bill → Process → Review → Correct → Save → History
  ✓ [desktop-chrome] journeys.spec.ts › Journey C: Upload selfie → Classification → Polite rejection
  ✓ [desktop-chrome] journeys.spec.ts › Journey D: History → Search → Open bill → Edit → Save
  ✓ [desktop-chrome] journeys.spec.ts › Journey E: Dashboard → Analytics → Category filter
  ✓ [desktop-chrome] journeys.spec.ts › Journey F: Settings → Export → Delete account
  ✓ [desktop-chrome] journeys.spec.ts › Public pages render, contact form submits honestly, unknown routes 404
  ✓ [mobile-chrome]  responsive.spec.ts › mobile: marketing menu and pages fit the screen
  ✓ [mobile-chrome]  responsive.spec.ts › mobile: app uses bottom navigation without overflow
  11 passed (1.0m)

training/tests: 10 passed in 2.75s
npm audit: found 0 vulnerabilities
```

Tesseract prints harmless Leptonica messages (`boxClipToRectangle: box outside rectangle`) on some synthetic images; they do not affect results.

## What is covered (mapping to the brief)

| Area | Where |
|---|---|
| Image validation, decoding, EXIF, HEIC/PDF, size limits | `ai/tests/image.test.ts`, `backend/tests/flow.test.ts` |
| Classification and response parsing (VLM tool output, zod) | `ai/tests/pipeline.test.ts`, `ai/tests/llm.test.ts` |
| OCR result parsing and layout | `ai/tests/extract.test.ts` (layout helpers), pipeline tests (real OCR) |
| Extraction schema | pipeline tests validate every result against `ExtractionResultSchema` |
| Date, amount, merchant and currency normalisation | `packages/shared/tests/normalise.test.ts` |
| Category selection | `ai/tests/categorise.test.ts` (rules, abstention, model parity) |
| Confidence thresholds and calibration | `ai/tests/confidence.test.ts` |
| Arithmetic validation | `packages/shared/tests/validation.test.ts` |
| Duplicate detection | `ai/tests/duplicates.test.ts`, backend flow |
| Database operations | backend auth and flow tests (real SQLite) |
| Upload → processing → extraction → validation → review → save → history | backend `flow.test.ts` and e2e Journey B |
| Error and retry handling | `llm.test.ts` (timeouts, 429/5xx retries, permanent 401), pipeline fallback, backend rejection tests |
| Security checks | `auth.test.ts` (CSRF, origins, hashing, enumeration, reset tokens), cross-user isolation, admin-only metrics |
| UI journeys A–F, responsive and accessibility | `website/e2e/` |

## Not tested
- Real bill photographs (the HR images were not available). See `evaluation_methodology.md`.
- The real Anthropic API (no key in this environment; the integration is tested against a mocked HTTP API).
- Real SMTP delivery (the mailer is tested in "not configured" mode).
- Safari, Firefox and real mobile devices. Only Chrome (desktop and the Pixel 7 emulation) was automated.
- Load and performance testing beyond the per-image timings of the smoke evaluation.

© 2026 Shaik Gouse Kareem. All rights reserved.
