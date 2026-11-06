# API documentation

Base path `/api`. JSON in and out unless noted. Authentication uses an HttpOnly `bk_session` cookie. Every state-changing request (`POST/PUT/PATCH/DELETE`) must send the header `X-BillKit-CSRF: 1`, and its `Origin` (if present) must equal `PUBLIC_ORIGIN` or an `ADDITIONAL_ORIGINS` entry. Errors have the shape `{"error": {"code": "...", "message": "...", "details"?: ...}}`; schema errors are `400 invalid_input` with `fields: [{path, message}]`; pipeline errors are `422`; unexpected errors are `500 internal` with a `requestId`.

Rate limits (per IP, multiplied by `RATE_LIMIT_SCALE`): 300/min overall on `/api`, 10/min on auth endpoints, 30/min uploads, 20/min reprocess, 5/hour contact.

## Auth — `/api/auth`

| Method & path | Body | Response |
|---|---|---|
| `POST /register` | `{name, email, password}` (password 10–128 chars, at least one letter and one digit) | `201 {user}` and sets session |
| `POST /login` | `{email, password}` | `200 {user}`; generic `401 invalid_credentials` |
| `POST /logout` | — | `204` |
| `GET /me` | — | `{user}` or `401` |
| `POST /forgot-password` | `{email}` | always `200` (no account enumeration); emails a link only when SMTP is configured |
| `POST /reset-password` | `{token, password}` | `200`; token single-use, valid 30 minutes, stored hashed; all sessions revoked |
| `POST /change-password` | `{currentPassword, newPassword}` | `200`; other sessions revoked |
| `PUT /profile` | `{name}` | `{user}` |
| `DELETE /account` | `{password}` | `204`; deletes user, bills, images, corrections |

## Scans — `/api/scans`

| Method & path | Notes |
|---|---|
| `POST /` | `multipart/form-data`: one or more file parts (≤ 5 pages; JPEG, PNG, WebP, HEIC/HEIF, PDF; ≤ 15 MB each), optional options field. Options: `rotate` (0/90/180/270), `disableAutoCrop`, `userConfirmedBill`, `allowVlm`. The type comes from magic bytes; unknown → `415 unsupported_format`; too large → `413 file_too_large`; too many → `413 too_many_files`. Returns `202` with the scan id |
| `GET /` | The 10 most recent scans (id, status, stage, error code, bill id) |
| `GET /:id` | Status (`queued`, `processing`, `completed`, `failed`, `cancelled`, `saved`, `discarded`), stage, `ExtractionResult` when complete, error, image list, duplicate hints |
| `POST /:id/cancel` | Cancels a queued or processing job |
| `POST /:id/reprocess` | Body = scan options (for example `{"userConfirmedBill": true}` after a rejection, or `{"rotate": 90}`); allowed after completed/failed/cancelled; `409 original_deleted` if the original is no longer stored |
| `DELETE /:id` | Discards an unsaved scan and its images |
| `GET /:id/images/:kind/:page` | `kind` = `original` or `corrected`; owner only |

## Bills — `/api/bills`

| Method & path | Notes |
|---|---|
| `POST /` | `{scanId, fields: ReviewedFields, confirmedFields: string[], acknowledgeWarnings?, acknowledgeDuplicate?}`. `ReviewedFields` requires `merchantName`, `billDate` (ISO), `totalAmount`, `currency`, `category`; the rest are optional/nullable (subcategory, billTime, subtotal, tax, discount, serviceCharge, tip, invoiceNumber, paymentMethod, merchantAddress, notes). The server re-runs validation: `422 validation_failed` for errors, `409 validation_warnings` until acknowledged, `409 possible_duplicate` (with matches) until acknowledged, `409 not_a_bill` if the scan was rejected and not reprocessed with `userConfirmedBill`. Provenance per field (`ai`, `user_confirmed`, `user_corrected`, `user_entered`, `user_removed`) and correction rows are recorded. Returns `201 {bill}` |
| `GET /` | Query `q` (merchant/category/invoice/notes), `category`, `merchant`, `currency`, `from`, `to` (ISO), `sort` = date/amount/merchant/created, `order` = asc/desc, `page`, `pageSize` ≤ 100 |
| `GET /:id` | Bill with line items, provenance, validation and image links |
| `PUT /:id` | `{fields: ReviewedFields}`; changes are recorded as `post_save_edit` corrections |
| `DELETE /:id` | Deletes the bill and its images |
| `GET /export.csv`, `GET /export.json` | Same filters as the list. CSV cells starting with `= + - @`, tab or CR get a `'` prefix (formula-injection guard) |

The "every flagged field must be confirmed or corrected" rule is enforced by the review screen; the server records what was confirmed and enforces validation, required fields and duplicate acknowledgement.

## Other — `/api`

| Method & path | Notes |
|---|---|
| `GET /health` | `{status:"ok"|"degraded", version, pipeline, db: boolean, queueDepth, time}` – no secrets |
| `GET /config/public` | `{vlmAvailable, vlmProvider, maxUploadMb, maxPages, acceptedFormats, emailConfigured, registrationOpen, versions}` |
| `GET/PUT /settings` | `UserSettingsSchema` |
| `GET/POST /categories`, `DELETE /categories/:id` | Custom categories |
| `GET /analytics/summary` | Query `from, to, currency`; monthly series, category/merchant totals, comparisons, budgets, unusual bills |
| `GET /corrections/summary` | Per-field correction counts for the current user |
| `POST /contact` | `{name, email, subject, message, website (honeypot)}` → stored; forwarded only if SMTP and `CONTACT_TO_EMAIL` are configured |
| `GET /admin/metrics` | Admin only (`npm run admin:grant -- email`): aggregate job metrics, no bill content |

## ExtractionResult (abridged)

```json
{
  "schemaVersion": "billkit.extraction/1.0",
  "isBill": true,
  "classification": {"decision": "bill", "documentClass": "restaurant_bill", "billScore": 0.86, "confidenceKind": "heuristic",
                     "evidence": ["Bill vocabulary: “Grand Total”, “GSTIN”"], "counterEvidence": [], "method": "billkit-evidence-v1",
                     "explanation": "This looks like a restaurant bill: ..."},
  "quality": {"score": 81, "verdict": "good", "issues": []},
  "fields": {
    "totalAmount": {"value": 412.5, "status": "extracted", "confidence": 0.91, "confidenceKind": "heuristic",
                    "review": "high_confidence", "source": "ocr_rules",
                    "evidence": {"text": "GRAND TOTAL 412.50", "page": 0, "bbox": [0.08, 0.81, 0.84, 0.03]},
                    "signals": {"ocrConfidence": 0.93, "ruleScore": 0.95, "modelReported": null, "agreement": "single_source", "validation": "pass"},
                    "alternatives": [{"value": 380, "source": "ocr_rules", "evidence": "SUB TOTAL 380.00"}]}
  },
  "category": {"value": "Food", "confidence": 0.82, "reasons": ["merchant keyword: cafe"]},
  "validation": {"status": "passed", "issues": [], "checks": [{"name": "Total arithmetic", "result": "pass", "detail": "..."}]},
  "overallReview": "needs_review",
  "meta": {"pipelineVersion": "...", "timingsMs": {"ocr": 1830}, "vlm": {"used": false}}
}
```

Field `status`: `extracted`, `inferred`, `ambiguous`, `missing`, `user_corrected`, `user_confirmed`; `review`: `high_confidence`, `needs_review`, `missing`, `validation_warning`, `user_corrected`; `source`: `ocr_rules`, `vlm`, `ocr_rules+vlm`, `statistical`, `user`, `none`. The authoritative definition is `packages/shared/src/schemas.ts`.

© 2026 Shaik Gouse Kareem. All rights reserved.
