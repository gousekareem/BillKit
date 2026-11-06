# Privacy policy — TEMPLATE

> **Draft template, not legal advice.** It describes how the BillKit software behaves so that an operator can adapt it. It has **not** been reviewed by a lawyer and makes **no claim** of compliance with GDPR, India's Digital Personal Data Protection Act 2023 or any other law. Fill in every `[PLACEHOLDER]` and have it reviewed before you put it in front of real users. The same text (without placeholders) is shown in the app at `/legal/privacy`.

**Operator:** [LEGAL NAME OF THE PERSON/ORGANISATION RUNNING THIS SERVER]
**Contact for privacy questions:** [REAL CONTACT ADDRESS — do not publish until it exists]
**Last updated:** [DATE]

## 1. What BillKit is
BillKit is software created and developed by Shaik Gouse Kareem. This deployment is operated by [OPERATOR], who is responsible for the data described here.

## 2. Data we process
- **Account data:** name, e-mail address and a one-way Argon2id hash of your password.
- **Bill data:** images you upload, the text recognised in them, extracted values, the values you approved, corrections, categories, notes and settings.
- **Operational data:** processing timings, error codes, model/prompt versions, token counts and estimated costs. This contains no bill content.
- **Contact messages** sent through the contact form, together with a truncated, salted hash of your IP address for abuse prevention.

## 3. Where processing happens
- OCR and rule-based extraction run on this server, located at [HOSTING PROVIDER / REGION].
- **Optional cloud AI:** if enabled by the operator *and* by you in Settings, a downscaled image of the bill and its OCR text are sent to [Anthropic PBC] to check uncertain results. No account details are sent. The provider's terms: [LINK]. Retention by the provider: [CHECK AND STATE].
- E-mail (password reset, contact forwarding) is sent through [SMTP PROVIDER], if configured.

## 4. Purposes [AND LEGAL BASES — TO BE DETERMINED WITH COUNSEL]
Providing the service you request; account security; reliability monitoring. Improvement using your corrections happens **only if you opt in**, and only after human review.

## 5. Retention
Saved bills are kept until you delete them or your account. Unsaved scans are deleted after [24] hours. Original photos can be discarded on save (Settings → Privacy). Backups: [OPERATOR BACKUP RETENTION].

## 6. Your choices
Export (CSV/JSON), edit, delete individual bills, turn cloud AI on or off, turn corrections-for-improvement on or off, delete your account. [ADD ANY RIGHTS REQUIRED IN YOUR JURISDICTION AND HOW TO EXERCISE THEM, INCLUDING GRIEVANCE OFFICER DETAILS IF APPLICABLE.]

## 7. Cookies and local storage
One essential cookie (`bk_session`). The theme preference is kept in localStorage, and offline copies of viewed bills in IndexedDB (cleared on sign-out). No advertising or analytics cookies.

## 8. Security
See the in-app Privacy & security page. No system is perfectly secure.

## 9. Children
BillKit is not intended for children. [STATE MINIMUM AGE APPLICABLE TO YOUR JURISDICTION.]

## 10. Changes
[HOW USERS WILL BE NOTIFIED OF CHANGES.]

© 2026 Shaik Gouse Kareem. All rights reserved.
