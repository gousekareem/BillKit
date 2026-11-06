# Personal data (PII) found on bills

| Type | Where it appears | Handling |
|---|---|---|
| Names, phone, e-mail, address | Customer details, delivery bills, utility bills | Redact in datasets. In the app it is stored as part of the user's own bill and never sent to analytics or logs |
| Payment data (partial card, UPI ID) | Footer | Redact in datasets. The app extracts only the payment *method* |
| Account/consumer numbers | Utility bills | Redact in datasets |
| Health information | Pharmacy bills | Treat as sensitive; redact item names in datasets |
| Location (EXIF GPS) | Photo metadata | Stripped from processed copies by re-encoding; originals keep EXIF unless the user chooses not to keep originals |
| Faces | Background of photos | Redact in datasets |

The app's processing metrics (`job_metrics`) and logs never contain bill text.

© 2026 Shaik Gouse Kareem. All rights reserved.
