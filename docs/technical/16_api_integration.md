# 16. API integration guide

The complete reference is [`docs/api_documentation.md`](../api_documentation.md).

**A minimal client flow**

```bash
B=http://localhost:8787; H='X-BillKit-CSRF: 1'
curl -c jar -H "" -H 'content-type: application/json' \
  -d '{"name":"Test","email":"t@example.com","password":"a-long-pass-123"}' /api/auth/register
curl -b jar -H "" -F files=@receipt.jpg /api/scans                 # → {"id": "..."}
curl -b jar /api/scans/<id>                                            # poll until status=completed
curl -b jar -H "" -H 'content-type: application/json' -d @reviewed.json /api/bills
```

**Rules for integrators**
- Send `X-BillKit-CSRF: 1` on every mutating call. Browsers must be on an allowed origin.
- Poll no faster than about every 500 ms; processing usually takes 1–5 seconds without the VLM.
- Treat `ExtractionResult` as **suggestions**. Do not save without showing the user the fields whose `review` is not `high_confidence`.
- Handle `409 validation_warnings` / `possible_duplicate` by showing them and resubmitting with `acknowledgeWarnings` / `acknowledgeDuplicate`.
- Errors always have `{error: {code, message}}`. Branch on `code`, not on the message.

**Using the pipeline directly (no HTTP):** `import { processDocument } from '@billkit/ai'` with `{ files: [buffer, …], options: { dateOrder, reviewThreshold, allowVlm }, vlm, onStage, signal }`. This is how the evaluation harness works.

© 2026 Shaik Gouse Kareem. All rights reserved.
