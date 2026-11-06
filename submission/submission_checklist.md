# HR submission checklist

Status as of 6 November 2026. ✅ = done and verified · ⏳ = waiting for an input from the candidate · ❌ = not possible in the build environment.

## Assignment requirements
- ✅ R1 Capture (camera) or upload (gallery/files), with preview — e2e Journey B, `04_scan.png`
- ✅ R2 Bill vs non-bill; non-bills politely rejected (selfie, ID card, screenshot) — backend flow test, e2e Journey C, `08_rejected_selfie.png`
- ✅ R3 Merchant, date, total extracted; category suggested (Food, Utilities, Groceries + 10 more) — ai and backend tests
- ✅ R4 Uncertain and missing fields highlighted; corrections before saving — `review.test.tsx`, Journey B
- ✅ R5 Verified bills saved (SQLite on the server, offline copies in the browser) in a searchable list — Journey D
- ⏳ R6 20-image evaluation: harness, templates and folders ready; **results pending until the 15 bills + 5 non-bills are added** to `dataset/hr_assignment/` and `npm run eval:hr` is run
- ✅ R7 Reflection — `docs/reflection.md` (the HR-results paragraph is to be completed after R6)

## Deliverables
- ✅ GitHub-ready repository: README, `.gitignore`, `.env.example`, docs, ownership notice
- ⏳ Screen recording: **not created** (no genuine recording possible here) — script `demo_script.md` and storyboard `demo_storyboard.md` provided; the candidate records it
- ⏳ 20-image results (CSV/JSON/report) — generated automatically once the images are present
- ✅ Interview preparation and live-change exercise — `docs/interview_preparation.md`, `submission/live_change_exercise.md`
- ✅ Evaluation report template — `submission/evaluation_report_template.md`
- ✅ Tests run (136 unit/integration, 11 e2e, 10 Python), lint, typecheck and build — `docs/testing.md`
- ✅ ZIP `BillKit_Shaik_Gouse_Kareem_Final.zip` built, extracted into a clean folder, installed with `npm ci` and verified

## Before you submit (candidate)
- [ ] Add the 20 images and fill in `dataset/hr_assignment/ground_truth.csv` **from the paper bills**
- [ ] Run `npm run eval:hr`; read `evaluation/results/hr_assignment/report.md`; fill in `submission/evaluation_report_template.md` and the last section of `docs/reflection.md`
- [ ] Decide whether the bill photos may be shared. If not, do not put them in the ZIP (they are excluded by default); share the results only
- [ ] Record the demo following `demo_script.md`
- [ ] Optional: set `AI_PROVIDER_API_KEY` to show the cloud cross-check (it costs money, and images go to the provider)
- [ ] Check that no `.env` or real secrets are in what you send

## Safety checks on the ZIP
- [ ] No `node_modules`, build output, databases, uploads, `.env` or caches
- [ ] No real bill photographs or third-party dataset files
- [ ] Synthetic images are labelled synthetic wherever they appear

© 2026 Shaik Gouse Kareem. All rights reserved.
