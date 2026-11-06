# Redaction guide

Redact **before** annotation and before the image leaves the device it was captured on.

| Redact | Keep |
|---|---|
| Customer name, phone, e-mail, address | Merchant name, merchant address (business data) |
| Card numbers (even partial), UPI IDs/VPAs, bank references, auth codes | Payment *method* ("Card", "UPI") |
| Loyalty/membership numbers, customer IDs | Date, time, totals, tax, items |
| Faces, people, car plates in the background | Merchant GSTIN (a public business identifier) — redact if in doubt |
| QR codes that encode payment or customer data | |
| Prescription details on pharmacy bills (health data) | Item names may be replaced by "Item" if sensitive |

How:
1. Work on a copy. Use solid opaque rectangles (not blur or pixelation, which can be reversed), and flatten or export to a new file.
2. **Strip metadata.** Re-encode the image (for example `python -c "from PIL import Image; Image.open('in.jpg').save('out.jpg')"` drops EXIF and GPS by default), and check with `exiftool out.jpg`.
3. Check that the redaction does not cover a field you need (for example the total).
4. A second person checks the redaction (`redaction_checked_by` in the consent record).

© 2026 Shaik Gouse Kareem. All rights reserved.
