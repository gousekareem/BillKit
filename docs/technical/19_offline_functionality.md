# 19. Offline functionality

| Capability | Offline? | How |
|---|---|---|
| Open the installed app | Yes | Service worker caches the app shell and built assets (`website/public/sw.js`, cache `billkit-shell-v1`) |
| View bills, lists, dashboard and analytics you opened before | Yes | `api.get(..., { offlineKey })` stores successful responses in IndexedDB (`services/offline.ts`) and serves them when the network fails, with an "Offline — showing the copy saved on this device" notice |
| Search or filter | Only for queries already run online | Each list query is cached under its own URL key |
| Scan a new bill | **No** | OCR runs on the server. The app shell shows an offline banner saying scanning needs a connection |
| Edit, save or delete | No | Requires the server, so data cannot silently diverge |

**Privacy.** The service worker never caches `/api/` responses, so bill data is not in the HTTP cache. IndexedDB copies are cleared on sign-out (account deletion signs you out).

**Why scanning is not offline yet.** tesseract.js can run in the browser, but the English model (~10 MB), the preprocessing in sharp (native code) and the extraction rules would all need browser equivalents, and slow phones would take a long time. A future version could run OCR in a Web Worker and queue uploads until the device is back online (Background Sync).

**On-device AI options (G18), evaluated, not built.** Running OCR in the browser with tesseract.js (feasible, slower); the ONNX classifier converted to LiteRT or Core ML in a native app; ML Kit text recognition in a native wrapper. Each would keep images on the phone, but there would be two pipelines to keep in step.

© 2026 Shaik Gouse Kareem. All rights reserved.
