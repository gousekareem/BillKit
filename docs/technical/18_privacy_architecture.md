# 18. Privacy architecture

**Data minimisation by design**
- Only what is needed is collected. There are no analytics or third-party scripts, and fonts are self-hosted.
- The cloud model (if enabled) receives a downscaled page image and OCR text, never the user's name or e-mail. It is called only when needed (`ambiguous_only`), and the user can switch it off.
- Monitoring (`job_metrics`) and logs contain no bill content.

**User control**: keep or discard original photos; discard unsaved scans (and automatic deletion after 24 h); delete any bill; export everything; delete the account with a full cascade; opt in or out of using corrections for improvement (off by default).

**Transparency**: the Privacy & security page and `/legal/*` pages state the real data flows, including that images are processed on the server and, optionally, by Anthropic. The AI-limitations notice explains what confidence means.

**Datasets**: consent, redaction, access, retention and deletion rules for real images are in `docs/dataset/privacy_*.md`, `redaction_guide.md` and `pii_handling.md`.

**Not claimed**: compliance with GDPR, the DPDP Act 2023 or any other regime. The templates in `docs/legal/` list what an operator must complete with counsel (legal bases, grievance officer, provider retention terms, and so on).

© 2026 Shaik Gouse Kareem. All rights reserved.
