# 22. Known limitations

See [`docs/limitations.md`](../limitations.md) for the full list. The most important ones for an interview discussion:

1. **There are no real-world accuracy numbers yet.** The HR evaluation is pending, and synthetic results do not count.
2. **Rules, not learned models**, for classification and extraction. They are explainable, but they do not adapt to unusual layouts without code changes.
3. **Heuristic confidence**, uncalibrated, so the scores rank fields but are not probabilities.
4. **English OCR only** by default; handwriting and faded thermal paper are weak.
5. **Single-server design**: SQLite and an in-process queue.
6. **Security gaps**: no MFA, no e-mail verification, no encryption at rest by the app, no malware scanning, no penetration test.
7. **Only Chrome tested** (desktop and a mobile emulation profile); not deployed.

© 2026 Shaik Gouse Kareem. All rights reserved.
