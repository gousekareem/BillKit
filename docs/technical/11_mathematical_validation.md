# 11. Mathematical validation

`validateBill()` (`packages/shared/src/validation.ts`) is a pure function. It runs on AI output, live in the review form as the user types, and on the server before saving.

## Arithmetic with legitimate interpretations
Receipts differ: prices may include tax, a discount may already be deducted in the subtotal, and there may be a round-off line. So BillKit accepts a total if **any** of these match within a tolerance of `max(1, 0.5 % of total)`:

1. subtotal + tax + service + tip − discount + round-off
2. discount already deducted: subtotal + tax + service + tip + round-off
3. prices include tax: subtotal + service + tip − discount + round-off
4. prices include tax, discount already deducted: subtotal + service + tip + round-off
5. without the round-off line: subtotal + tax + service + tip − discount

The matching interpretation is reported ("Total matches prices include tax"). The fields involved are marked **corroborated**, which raises their confidence. No match → `total_mismatch` warning naming the numbers.

## Other checks
| Check | Severity |
|---|---|
| Merchant, date or total missing | warning |
| Total not a number | error |
| Total negative (refund/credit?), zero, or > 10,000,000 | warning |
| Negative subtotal/tax/discount/service/tip | warning |
| Tax > total; discount > subtotal | error |
| Line items (≥ 2) sum ≠ subtotal (or total), allowing for the discount | info |
| qty × price ≠ line total | info |
| paid + balance ≠ total | warning; paid < total → info (partial payment) |
| Invalid date (e.g. 2026-02-30) | error |
| Future date (beyond tomorrow), before 2000 | warning; older than 3 years → info |
| Ambiguous day/month | warning |
| Due date before bill date | warning |
| Currency not a 3-letter code | error; uncommon code → info |

Overall status: any error → `failed` (save blocked); any warning → `needs_review` (the user must acknowledge); otherwise `passed`.

© 2026 Shaik Gouse Kareem. All rights reserved.
