# Human Review

**Diagrams:** D10, D18, W08 (`diagrams/source/*.mmd`, rendered in `diagrams/rendered/`)

The review screen (`website/src/pages/app/ScanDetail.tsx`) shows the corrected image beside editable fields. Each field has an icon-and-text badge, its evidence text, its score type, alternatives as one-click chips, and — for flagged fields — an "I checked this value" checkbox. Selecting a field draws its evidence box on the image. With the default approval policy, **Approve & save** stays disabled until every flagged key field is corrected or confirmed and an ambiguous document is confirmed as a bill. Live validation updates as the user types. Reprocessing never overwrites fields the user edited; it shows "AI now suggests …" instead.

On save the server stores per-field **provenance** (ai, user_confirmed, user_corrected, user_entered, user_removed) and one **correction** row per change (AI value, user value, AI confidence/source, pipeline/model/prompt versions, consent flag, `review_status = unreviewed`). Corrections never retrain anything automatically.

---
© 2026 Shaik Gouse Kareem. All rights reserved.
