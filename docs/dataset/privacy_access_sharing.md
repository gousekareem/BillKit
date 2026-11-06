# Access control and safe sharing of real images

- **Storage.** Real images live only in `dataset/raw/` and `dataset/hr_assignment/` on an encrypted disk. Both paths are git-ignored. Never put them in cloud drives, chat apps or issue trackers.
- **Access.** Only named project members, on a need-to-know basis. Keep a list of who has access.
- **Sharing with reviewers (e.g. HR).** Share results (`predictions.csv`, `report.md`), not images. If images must be shown, share redacted copies in a private, expiring link, and only with the owner's consent scope (b) or (c).
- **Cloud AI.** Running the evaluation with `--allow-vlm` sends images to the AI provider. Do that only if the consent covers it.
- **Screenshots and demos.** Use synthetic samples or your own redacted bills.
- **The ZIP.** It contains no real images. `submission/submission_checklist.md` has a check for this.

© 2026 Shaik Gouse Kareem. All rights reserved.
