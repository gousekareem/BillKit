# Dataset acquisition guide

**Nothing in this repository contains downloaded third-party dataset files.** No public dataset was downloaded, and no real bill photographs are included. This guide explains how to obtain data lawfully and where to put it.

## Public datasets (check each licence yourself before use; licences can change)

| Dataset | Content | Licence / access (as published by its authors) | Fit for BillKit |
|---|---|---|---|
| **CORD** (Clova AI) | About 1,000 Indonesian receipt images with field and line-item labels | CC BY 4.0 | Extraction research. The layout and language differ from Indian receipts |
| **SROIE** (ICDAR 2019) | About 1,000 scanned receipts (mostly Malaysian) with company, date, address and total | Released for the ICDAR competition / research use. Check the terms before any commercial use | Key-field extraction benchmark |
| **FUNSD** | 199 noisy scanned forms with entity labels | Non-commercial research use | Layout/form understanding, and **non-bill** forms |
| **XFUND** | Multilingual forms (7 languages) | CC BY-NC-SA 4.0 (non-commercial) | Multilingual non-bill forms |
| **RVL-CDIP** | 400,000 greyscale documents in 16 classes (letter, form, invoice, …) | Derived from the Legacy Tobacco Documents Library; check the terms of use | Bill vs non-bill classification (the *invoice* class vs the others) |
| **DocVQA** | Document images with questions | Requires registration on the RRC portal and acceptance of its terms | Question answering, not core |

Rules:
1. Record the source, licence and the date you checked it in `dataset/manifests/dataset_manifest.csv` (`source`, `licence` columns).
2. **Non-commercial** datasets (FUNSD, XFUND, possibly SROIE) must not be used to train models that ship in a commercial product.
3. Do not redistribute third-party images in this repository or the ZIP. Keep them in `dataset/raw/` locally (they are git-ignored).
4. Public datasets are not Indian phone photos. A model or threshold tuned on them must be checked on representative data.

## Collecting your own photos (recommended for real-world use)

- Use the folder structure in `dataset/raw/bills/0NN_*` (conditions such as `009_low_light_receipts`, and types such as `016_restaurant_bills`) and `dataset/raw/non_bills/0NN_*`.
- Get **written consent** from the person whose bill it is (see `privacy_consent.md`) and record it with `dataset/templates/consent_record_template.csv`. Store the signed form outside the repository.
- **Redact** personal data before annotation (`redaction_guide.md`).
- Aim for **diversity, not volume**: many merchants, cities, printers, paper types and lighting conditions, and both phones and scanners. About 300 bills plus 150 non-bills across the conditions is a sensible first development set.
- Assign a `document_group_id` per physical bill (several photos of one bill share it) so the split never puts the same bill in two sets.

## Generated data

`ai/scripts/synthetic.ts` generates fictional receipts with degradations. They are useful for unit tests and smoke tests and must **never** be reported as real bills.

## Pipeline after acquisition

```bash
python training/scripts/validate_dataset.py --write-hashes   # manifest, files, annotations, duplicates
python training/scripts/split_dataset.py                     # grouped train/validation/test split
python training/scripts/generate_statistics.py               # dataset/reports/
python training/scripts/augment.py                           # train split only
```

© 2026 Shaik Gouse Kareem. All rights reserved.
