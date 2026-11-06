# Demo recording script (under 2 minutes)

**Status: no recording exists.** This environment cannot make a genuine screen recording with narration, so this script, the storyboard and the checklist are provided instead. The still screenshots in `assets/screenshots/` are real captures from the running app with synthetic sample images.

## Before recording
1. `npm ci && npm run build`, then either `STATIC_DIR=$PWD/website/dist npm start` (open http://localhost:8787) or `npm run dev` (open http://localhost:5173). Use Chrome at 1440×900, zoom 100 %, bookmarks bar hidden.
2. Register a fresh demo account (no real personal data).
3. Have ready: **one of your own real bills** (a messy one makes a better demo) or `evaluation/synthetic_smoke/images/` (say on screen that it is a generated sample), plus one selfie or ID-card-like picture (use a synthetic one, never a real ID).
4. Settings: cloud AI off, unless you have configured a key and want to show it.
5. Close notifications; use a screen recorder with microphone (e.g. OBS, or the system recorder).

## Script

| Time | Action | Narration |
|---|---|---|
| 0:00–0:08 | Show the home page; scroll the hero slightly | "This is BillKit: every bill, in your pocket. It turns a photo of a bill into a checked expense record." |
| 0:08–0:15 | Click **Get started** → already signed in → dashboard | "Here's my dashboard; it only shows bills I've actually saved." |
| 0:15–0:25 | **Scan a bill** → **Choose files** (or **Use camera**, hold up the bill) → preview → **Process** | "I can use the camera or upload. I get a preview, and can rotate, crop or add pages." |
| 0:25–0:35 | Processing steps animate | "These are the real stages on the server: quality check, straightening, OCR, bill detection, extraction, validation." |
| 0:35–0:55 | Review screen: point at the bill-type chip, merchant, date, total and category; click a field to show the highlighted evidence box | "It recognised a grocery receipt. Each value shows where on the bill it came from and how sure the system is, and the score is labelled as a heuristic, not a probability." |
| 0:55–1:10 | Point at a **Needs review** field; edit it (e.g. fix the merchant spelling, or pick the alternative); the badge changes to **User corrected**; tick confirm on any remaining flag | "Uncertain fields are highlighted with text, not just colour. I correct this one; the arithmetic check updates live." |
| 1:10–1:20 | **Approve & save** → toast → bill detail | "Nothing is saved until I approve it. The correction is recorded next to the original AI value." |
| 1:20–1:30 | **Bill history** → search the merchant → open it | "It's in my history, searchable and exportable." |
| 1:30–1:45 | **Scan a bill** → upload the selfie → rejection screen | "If I upload a selfie, BillKit politely says it isn't a bill and explains why. Nothing is saved, and I can still override it if it really is a bill." |
| 1:45–1:55 | Back to the dashboard / analytics | "Totals and charts only use bills I've verified." |

Keep it under 2:00. Re-record rather than editing in AI-generated footage.

## After recording
Check that no real personal data is visible (blur names, card or UPI numbers if your bill shows them), export as MP4 (1080p), and name it `BillKit_demo_Shaik_Gouse_Kareem.mp4`.

© 2026 Shaik Gouse Kareem. All rights reserved.
