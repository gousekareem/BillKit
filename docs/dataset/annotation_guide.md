# Annotation guide

## Files
- One JSON file per image in `dataset/annotations/complete_ground_truth/<image_id>.json`. Templates: `dataset/templates/bill_annotation_template.json` and `non_bill_annotation_template.json`.
- Optional CSVs for line items and boxes: `dataset/templates/line_items_template.csv` and `bounding_boxes_template.csv`.
- Required keys: `image_id`, `document_class`, `annotation_status` (`draft` → `reviewed` → `verified`). `validate_dataset.py` enforces these and the rules below.

## Classes
`document_class` for bills: `retail_receipt`, `restaurant_bill`, `grocery_receipt`, `utility_bill`, `invoice`, `handwritten_bill`, `bill_screenshot`, `receipt`. For non-bills: `id_card`, `certificate`, `letter_or_form`, `chat_or_app_screenshot`, `newspaper`, `selfie_or_photo`, `blank_page`, `other_document`. Set `is_bill` accordingly. The value must agree with the manifest's `class`.

## Field rules (write what is printed, not what you think it should be)
| Field | Rule |
|---|---|
| `merchant_name` | The trading name as printed at the top (not the legal entity in the footer, unless that is the only name). Keep the original spelling |
| `bill_date` | ISO `YYYY-MM-DD`. For an ambiguous 03/04 date, use the merchant's country convention and add a note |
| `total_amount` | The final amount the customer pays (grand total / net payable), **after** tax, discount and round-off. Not the amount tendered and not the change |
| `subtotal`, `tax`, `discount`, … | Only if printed. `tax` = the total tax (sum of CGST + SGST + … when only components are printed) |
| `currency` | ISO code. Write `INR` even if the bill shows only "Rs" |
| `category` | One of the 13 built-in categories (see `packages/shared/src/categories.ts`) |
| Not visible | Use `null` and list the field in `not_visible` (for example the total hidden by a fold). Never guess |
| Boxes | `[x, y, width, height]` as fractions of the image |

Non-bill annotations must not contain bill fields.

## Quality control
1. Two annotators per image for the test set. Disagreements are resolved by a reviewer, and the status is set to `verified` only after review.
2. Track agreement (exact match per field). Low agreement on a field means the guideline needs clarifying.
3. Never copy values from BillKit's output into ground truth. Annotate from the image or paper.
4. The validator warns when subtotal + tax ≠ total. Check the labels before "fixing" numbers.

© 2026 Shaik Gouse Kareem. All rights reserved.
