# BillKit app

The BillKit "mobile app" is the **installable Progressive Web App** built from `website/`. Its routes are under `/app`: dashboard, scan, review, history, analytics, categories, settings and admin. No separate native codebase exists.

- Install it from Chrome/Edge on Android or desktop ("Install app" / "Add to Home screen"), or from Safari on iOS (Share → Add to Home Screen; not tested).
- Camera capture uses `getUserMedia` with the rear camera, falling back to the file picker with `capture="environment"`.
- Source: `website/src/pages/app/`, `website/src/layouts/AppLayout.tsx`, `website/public/manifest.webmanifest`, `website/public/sw.js`.

Why a PWA rather than React Native: see `docs/architecture.md`.

© 2026 Shaik Gouse Kareem. All rights reserved.
