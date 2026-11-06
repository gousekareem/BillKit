/*
 * Website copy — written to match the implemented system exactly.
 * © 2026 Shaik Gouse Kareem. All rights reserved.
 */

export interface Feature {
  id: string;
  title: string;
  what: string;
  why: string;
  how: string;
  limits: string;
}

export const FEATURES: Feature[] = [
  { id: 'scan', title: 'Smart bill scanning', what: 'Turns a photo, screenshot or PDF of a bill into a structured expense draft.', why: 'No more typing totals and dates from crumpled receipts.', how: 'Open Scan, capture or choose a file, and watch each processing stage complete.', limits: 'Very blurry, dark or heavily cropped photos may need a retake.' },
  { id: 'camera', title: 'Camera capture', what: 'Use your phone or laptop camera directly in the browser.', why: 'Capture the bill the moment you get it.', how: 'Tap “Use camera”. On phones the native camera opens; on laptops a live preview appears.', limits: 'Requires camera permission and a secure (HTTPS or localhost) connection.' },
  { id: 'upload', title: 'Gallery & file upload', what: 'Drag and drop or pick JPG, PNG, WebP, HEIC or PDF files — up to 5 pages per bill, 15 MB each.', why: 'Works with photos you already took and e-bills you received.', how: 'Drop files on the scan area or use “Choose files”. Rotate, crop, replace or remove pages before upload.', limits: 'HEIC previews depend on your browser; the server converts HEIC for processing.' },
  { id: 'detect', title: 'Bill / non-bill detection', what: 'Checks whether the image looks like a bill, receipt, invoice or utility bill — and politely rejects selfies, ID cards, chats and other documents.', why: 'Keeps your expense history clean and explains why something was rejected.', how: 'Automatic. If BillKit is unsure, it asks you to confirm or upload a better image.', limits: 'This is a document-type check, not proof that a transaction happened or that a receipt is genuine.' },
  { id: 'ocr', title: 'On-server OCR', what: 'Reads printed text with word-level positions and confidence using the open-source Tesseract engine.', why: 'Every extracted value can be traced back to the exact line it came from.', how: 'Runs automatically on the BillKit server; born-digital PDFs use their embedded text instead.', limits: 'English is bundled. Handwriting and faded thermal paper are read poorly.' },
  { id: 'extract', title: 'AI-assisted extraction', what: 'Finds merchant, date, time, total, subtotal, tax, discount, service charge, tip, invoice number, payment method and line items.', why: 'The details you need for budgeting or reimbursement, without retyping.', how: 'Review the pre-filled form; each value shows the text it was read from.', limits: 'Values that cannot be found are left empty — BillKit never guesses.' },
  { id: 'merchant', title: 'Merchant recognition', what: 'Identifies the business name from the bill header and a list of common merchants.', why: 'Groups spending by where you actually spent it.', how: 'Shown as the first field on the review screen.', limits: 'Logos without text and unusual headers may need correction.' },
  { id: 'date', title: 'Date recognition', what: 'Understands formats like 14/10/2026, 05-Oct-26, 2026-10-05 and Oct 5, 2026.', why: 'Correct dates make monthly summaries meaningful.', how: 'Ambiguous dates such as 04/05/2026 are flagged and interpreted with your day/month preference.', limits: 'If other dates on the bill reveal the format BillKit uses them, otherwise it asks you.' },
  { id: 'total', title: 'Total amount extraction', what: 'Distinguishes the final total from subtotal, tax, amount paid, change and balance due.', why: 'The most common receipt-scanning mistake is picking the wrong number.', how: 'Labelled totals (Grand Total, Net Amount, Amount Payable…) are preferred; unlabelled guesses are clearly marked.', limits: 'Totals that are cut off or covered cannot be recovered.' },
  { id: 'category', title: 'Category suggestions', what: 'Suggests Food, Groceries, Utilities and nine other categories with the reasons behind the suggestion.', why: 'Saves time while keeping you in charge.', how: 'Accept or change the suggestion on the review screen; add your own categories.', limits: 'When evidence is weak, BillKit shows “Unknown” instead of forcing a category.' },
  { id: 'confidence', title: 'Confidence indicators', what: 'Each field is labelled High confidence, Needs review, Missing, Validation warning or You corrected — with icons and text, not just colour.', why: 'You know exactly where to look.', how: 'Hover or focus a badge for an explanation.', limits: 'Scores are heuristic until calibrated on a labelled dataset — they are not probabilities.' },
  { id: 'highlight', title: 'Uncertain field highlighting', what: 'Flags uncertain or missing values and draws the evidence box on the bill image.', why: 'Checking takes seconds instead of re-reading the whole bill.', how: 'Click a field to see where on the image it was found.', limits: 'Evidence boxes are only available for values found by OCR.' },
  { id: 'math', title: 'Mathematical validation', what: 'Checks subtotal + tax + charges − discount ± round-off against the total, line items, paid/balance and date sanity.', why: 'Catches misread digits before they reach your records.', how: 'Warnings appear on the review screen and must be acknowledged before saving.', limits: 'Tax-inclusive prices and other legitimate layouts are recognised, but unusual bills may still trigger a warning.' },
  { id: 'correct', title: 'Manual correction & approval', what: 'Edit any field and approve before saving. Corrections are recorded with what the AI suggested.', why: 'You stay in control of your financial records.', how: 'Flagged required fields must be edited or confirmed before “Approve & save” is enabled.', limits: 'Your corrections are never overwritten by a later AI result.' },
  { id: 'history', title: 'Bill history', what: 'All verified bills with thumbnails, status badges and duplicate warnings.', why: 'Find any bill in seconds.', how: 'Open Bill history, then open a bill to view, edit, export or delete it.', limits: 'Only bills you approved appear in history.' },
  { id: 'search', title: 'Search & filtering', what: 'Search by merchant, category, invoice number or notes; filter by date range, category, merchant and currency; sort by date, amount or merchant.', why: 'Answer “how much did I spend at…?” quickly.', how: 'Use the search bar or the filters above the list.', limits: 'Search covers saved fields, not the full OCR text.' },
  { id: 'analytics', title: 'Expense analytics', what: 'Monthly spending, category and merchant totals, month-on-month comparison, budgets and unusual-expense flags.', why: 'See where your money goes.', how: 'Open Analytics and choose a date range, category or currency.', limits: 'Built only from saved bills. Different currencies are reported separately — no conversion.' },
  { id: 'duplicates', title: 'Duplicate detection', what: 'Warns when the same file, a near-identical photo, the same invoice number, or the same merchant/date/total was saved before.', why: 'Avoid counting an expense twice.', how: 'A warning appears before saving; you decide whether to keep both.', limits: 'BillKit never deletes potential duplicates — repeated purchases are real.' },
  { id: 'export', title: 'Data export', what: 'Download your bills as CSV (spreadsheets) or a JSON backup.', why: 'Your data is yours.', how: 'Bill history → Export, or Settings → Data.', limits: 'Images are not included in exports.' },
  { id: 'offline', title: 'Offline viewing', what: 'BillKit installs as an app (PWA). The app shell and bills you viewed recently are available without a connection.', why: 'Check a past bill even with poor signal.', how: 'Install from your browser menu; open bills while online once to keep a copy on the device.', limits: 'Scanning and saving require a connection to your BillKit server.' },
  { id: 'privacy', title: 'Privacy & data control', what: 'Delete individual bills, choose whether original photos are kept, opt in or out of cloud AI, export everything, or delete your account.', why: 'Bills contain personal and financial information.', how: 'Settings → Privacy and Data.', limits: 'Backups made by your server operator are outside the app’s control.' },
];

export const FAQ: Array<{ q: string; a: string }> = [
  { q: 'What is BillKit?', a: 'BillKit is a web app (installable on phones as a PWA) that scans bills and receipts, extracts the important details, highlights anything uncertain, checks the arithmetic, and saves the bill only after you approve it.' },
  { q: 'How does bill scanning work?', a: 'Your image goes to the BillKit server, which checks image quality, straightens it, reads the text with OCR, decides whether it is a bill, extracts fields with rules that keep a link to the source text, suggests a category, validates the numbers and shows you a review screen. An optional vision-language model can cross-check uncertain results if the server operator configured one and you enabled it.' },
  { q: 'Which bill formats are supported?', a: 'JPG, PNG, WebP, HEIC and PDF. Up to 5 pages per bill and 15 MB per file. Born-digital PDFs are read from their text layer.' },
  { q: 'Can I upload a phone photograph?', a: 'Yes — that is the main use case. BillKit detects the paper against the background, corrects perspective and tilt, and evens out shadows before reading it.' },
  { q: 'Can BillKit read blurry receipts?', a: 'Sometimes. BillKit measures sharpness and brightness, tells you when a retake would help, and still attempts processing. Very blurry text cannot be recovered reliably, so expect more fields marked “Needs review”.' },
  { q: 'Does it support handwritten bills?', a: 'Only partially. The OCR engine is designed for printed text and reads handwriting poorly. The optional vision model may do better, but always check handwritten bills carefully.' },
  { q: 'What happens if the AI makes a mistake?', a: 'You correct it on the review screen before saving. Every field shows the text it was read from, uncertain fields are highlighted, and arithmetic warnings must be acknowledged. Your corrections are stored and never overwritten by the AI.' },
  { q: 'Can I correct extracted values?', a: 'Yes — every field is editable before saving, and saved bills can be edited later. BillKit records which values you changed.' },
  { q: 'How are bills stored?', a: 'Verified bills are stored in a database on the BillKit server you sign in to, together with the bill images (unless you turn off keeping originals). Unsaved scans are deleted automatically after 24 hours by default.' },
  { q: 'Is BillKit free?', a: 'BillKit is an independent project with no paid plans. A server operator who enables the optional cloud vision model pays that provider for usage.' },
  { q: 'Does it work offline?', a: 'Partly. The installed app opens offline and shows bills you viewed recently. Scanning, saving and analytics need a connection to the BillKit server. The server itself does OCR locally and only uses the internet if the optional cloud vision model is enabled.' },
  { q: 'Is my financial data private?', a: 'Your bills are visible only to your account. OCR runs on the BillKit server, not a third-party service. If cloud vision is enabled by the operator and by you, the processed bill image and its OCR text are sent to that AI provider for that bill. Logs do not contain bill content.' },
  { q: 'Which currencies are supported?', a: 'BillKit recognises printed symbols and codes such as ₹/Rs/INR, $, €, £, AED, SGD and more. If no currency is printed, it suggests your default currency and marks it as not printed. Amounts are never converted between currencies.' },
  { q: 'Can I export my expenses?', a: 'Yes, as CSV or as a JSON backup, from Bill history or Settings.' },
  { q: 'How accurate is BillKit?', a: 'We do not publish an accuracy figure yet. The project includes an evaluation harness for a labelled set of real bills, and results will be published only after that evaluation is run on real images. Until then, treat every extraction as a draft to verify.' },
];

export interface LegalDoc {
  slug: string;
  title: string;
  updated: string;
  sections: Array<{ h: string; p: string[] }>;
}

export const LEGAL: LegalDoc[] = [
  {
    slug: 'privacy',
    title: 'Privacy policy',
    updated: '6 November 2026',
    sections: [
      { h: 'Who is responsible', p: ['BillKit is created and developed by Shaik Gouse Kareem. The person or organisation operating a BillKit server is responsible for that server and its data. Contact details are provided on the Contact page of the deployment.'] },
      { h: 'What we collect', p: ['Account data: your name, email address and a one-way password hash (Argon2id). We never store your password itself.', 'Bills: images you upload, the text recognised in them, the values extracted, the values you approved, your corrections, categories, notes and settings.', 'Operational data: processing timings, error codes, model and prompt versions, token counts and estimated cost. This contains no bill content.', 'Contact messages you send through the contact form.'] },
      { h: 'How processing works', p: ['OCR and rule-based extraction run on the BillKit server. If the operator configured a cloud vision-language model and you turned on “Use cloud vision” in Settings, the processed bill image (downscaled) and its OCR text are sent to that provider (currently Anthropic) to cross-check uncertain results. No account details are sent.'] },
      { h: 'Why we use it', p: ['To provide the service you request: extracting, verifying, storing and summarising your bills; to secure accounts; and to monitor reliability. Corrections are used to improve BillKit only if you opt in, and only after human review.'] },
      { h: 'Retention', p: ['Saved bills are kept until you delete them or your account. Unsaved scans are deleted automatically after 24 hours (configurable by the operator). You can choose not to keep original photos after saving.'] },
      { h: 'Your choices and rights', p: ['You can export your data (CSV/JSON), edit or delete any bill, change AI settings, and delete your account and all associated data at any time from Settings.'] },
      { h: 'Cookies', p: ['BillKit uses a single essential session cookie to keep you signed in. There are no advertising or analytics cookies.'] },
      { h: 'Security', p: ['Passwords are hashed with Argon2id, sessions are random tokens stored as hashes, requests are protected against CSRF, uploads are validated by content, and images are only served to their owner. No system is perfectly secure; see the Privacy & security page for limitations.'] },
      { h: 'Legal status of this document', p: ['This is a draft that reflects the implementation. It has not been reviewed by a lawyer and does not claim compliance with GDPR, India’s DPDP Act or any other law. It must be reviewed before commercial deployment.'] },
    ],
  },
  {
    slug: 'terms',
    title: 'Terms of use',
    updated: '6 November 2026',
    sections: [
      { h: 'The service', p: ['BillKit helps you digitise and organise bills. Extraction results are suggestions that you must verify. BillKit is not accounting, tax, legal or financial advice.'] },
      { h: 'Your responsibilities', p: ['Upload only documents you are entitled to process. Do not upload other people’s identity documents or private information without permission. Keep your password secure.'] },
      { h: 'Acceptable use', p: ['Do not attempt to break security controls, overload the service, or use BillKit to create or alter documents for fraud.'] },
      { h: 'No warranty', p: ['BillKit is provided “as is”. We do not guarantee accuracy, availability or fitness for a particular purpose. You are responsible for the records you approve.'] },
      { h: 'Ownership', p: ['© 2026 Shaik Gouse Kareem. All rights reserved. You keep ownership of the bills and data you upload.'] },
      { h: 'Draft', p: ['These terms are a draft requiring legal review before commercial use.'] },
    ],
  },
  {
    slug: 'data-handling',
    title: 'Data handling policy',
    updated: '6 November 2026',
    sections: [
      { h: 'Data minimisation', p: ['Only the data needed to process and store your bills is collected. The optional cloud model receives a downscaled document image and its OCR text — never your name or email.'] },
      { h: 'Storage locations', p: ['Database: SQLite file on the BillKit server. Images: the server’s local disk, under folders named by random identifiers. Offline copies: your browser’s IndexedDB, cleared when you sign out.'] },
      { h: 'Logging', p: ['Request logs omit cookies, authorisation headers and request bodies. Processing metrics contain timings, error codes and model versions only.'] },
      { h: 'Corrections governance', p: ['Corrections are stored with the AI value, your value and model versions. They are exported for improvement only with your consent, and every exported row starts as “unreviewed” — they are not treated as verified training labels until a reviewer accepts them.'] },
      { h: 'Deletion', p: ['Deleting a bill deletes its images, line items and corrections. Deleting your account deletes everything associated with it.'] },
    ],
  },
  {
    slug: 'ai-limitations',
    title: 'AI limitations notice',
    updated: '6 November 2026',
    sections: [
      { h: 'Extraction can be wrong', p: ['OCR can misread characters (for example 8 and B, 0 and O), and rules can pick the wrong line. Always verify the merchant, date and total.'] },
      { h: 'Confidence is not a guarantee', p: ['BillKit’s confidence labels come from heuristic scores that combine OCR confidence, rule strength, agreement between methods and validation results. Until calibrated on a labelled dataset, they are not probabilities of being correct. A vision model’s self-reported confidence is recorded but never used as a probability.'] },
      { h: 'Bill detection is not authenticity checking', p: ['BillKit decides whether an image looks like a bill. It cannot prove that a transaction happened or that a receipt is genuine.'] },
      { h: 'Known weak spots', p: ['Handwriting, faded thermal paper, very long receipts, non-English text (unless extra OCR languages are configured), totals hidden by folds or fingers, and unusual layouts.'] },
      { h: 'Evaluation status', p: ['No accuracy figure is published yet. The required evaluation on real bill images is pending; synthetic test results are not representative of real-world performance.'] },
    ],
  },
  {
    slug: 'cookies',
    title: 'Cookie notice',
    updated: '6 November 2026',
    sections: [
      { h: 'Essential cookie only', p: ['bk_session — an HttpOnly, SameSite=Lax cookie holding a random session token so you stay signed in. It expires 30 days after you sign in (configurable by the operator) or when you sign out.'] },
      { h: 'Other storage', p: ['Your theme preference is stored in localStorage. Offline copies of bills you viewed are stored in IndexedDB and cleared when you sign out. No tracking, advertising or third-party analytics cookies are used.'] },
    ],
  },
  {
    slug: 'data-deletion',
    title: 'Data deletion instructions',
    updated: '6 November 2026',
    sections: [
      { h: 'Delete one bill', p: ['Open Bill history → select the bill → Delete. The bill, its images, line items and correction records are removed.'] },
      { h: 'Discard an unsaved scan', p: ['On the review screen choose Discard. Unsaved scans are also removed automatically after 24 hours by default.'] },
      { h: 'Stop keeping original photos', p: ['Settings → Privacy → turn off “Keep original images”. Future saved bills keep only the corrected page image.'] },
      { h: 'Delete your account', p: ['Settings → Account → Delete account. Enter your password to confirm. All bills, images, corrections, categories, sessions and settings are deleted immediately from the BillKit database and image storage. Server backups, if your operator keeps any, follow the operator’s backup retention.'] },
      { h: 'Clear offline copies', p: ['Sign out — offline copies in your browser are cleared. You can also clear site data in your browser settings.'] },
    ],
  },
];
