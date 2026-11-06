# Where the tests are

Tests live next to the code they test (each workspace runs its own suite):

| Kind | Location | Runner | Count (last run) |
|---|---|---|---|
| Unit – shared normalisation and validation | `packages/shared/tests/` | Vitest | 28 |
| Unit/integration – AI pipeline (real OCR on synthetic images) | `ai/tests/` | Vitest | 66 |
| Integration – API (real Fastify app, temp SQLite, real pipeline) | `backend/tests/` | Vitest | 22 |
| UI component and review-flow tests | `website/tests/` | Vitest + Testing Library | 20 |
| End-to-end journeys, responsive and accessibility | `website/e2e/` | Playwright + axe-core (Chrome) | 11 |
| Python dataset/training tooling | `training/tests/` | pytest | 10 |

`npm test` runs the first four, `npm run test:e2e` the Playwright suite, and `pytest training/tests` the Python tests. Results are in `docs/testing.md`.

© 2026 Shaik Gouse Kareem. All rights reserved.
