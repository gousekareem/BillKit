# Website ↔ API integration

- **One client** (`website/src/services/api.ts`). Every request is same-origin `/api/...` with `credentials: 'include'` and `X-BillKit-CSRF: 1` on mutations. Errors become a typed `ApiError` (`status`, `code`, `message`, field errors), which forms map onto their fields.
- **Auth state** (`services/auth.tsx`): `GET /api/auth/me` on load; login/register update the context; logout clears the offline cache.
- **Scanning**: rotation and cropping chosen in the page tray are applied in the browser (canvas), then pages are uploaded as multipart with real upload progress and cancellation (XHR); the server enforces size and pixel limits; then it polls `GET /api/scans/:id` every 700 ms and maps `stage` to the progress steps. Cancel calls `POST /api/scans/:id/cancel`.
- **Review**: fields are initialised from `ExtractionResult`. Validation runs live with `validateBill` from `@billkit/shared`, the same code the server runs. Save → `POST /api/bills`, handling 409 `validation_warnings` / `possible_duplicate` with confirmation dialogs.
- **Offline**: GET calls that pass `offlineKey` are cached in IndexedDB and served when the network fails (`technical/19_offline_functionality.md`).
- **Feature flags**: `GET /api/config/public` decides whether the cloud-AI toggle, e-mail-dependent features (password-reset e-mail) and limits are shown, so the UI never offers a feature the server cannot perform.

API reference: `api_documentation.md`. Diagram: W09 (API communication).

© 2026 Shaik Gouse Kareem. All rights reserved.
