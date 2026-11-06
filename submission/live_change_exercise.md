# Live-change exercise: add a "Pets" category

**Goal:** show that the codebase is easy to change safely. Expected time: 10 minutes. Do this on a copy or a git branch, **not** on the submitted project.

## Steps

1. Add the category to the shared list. `packages/shared/src/categories.ts`:
   ```ts
   export const BUILT_IN_CATEGORIES = [ ..., 'Personal care', 'Pets', 'Other' ] as const;
   ```
2. Run `npm run typecheck`. It **fails** and points to two places, because both are typed `Record<BuiltInCategory, …>`. This is the point of the exercise: the compiler lists everything that must change.
   - `SUBCATEGORIES` in the same file → add `Pets: ['Pet food', 'Veterinary', 'Grooming', 'Accessories'],`
   - `CATEGORY_RULES` in `ai/src/lexicon.ts` → add
     ```ts
     Pets: [
       { re: /\b(pet\s?(shop|store|food|care)|veterinary|vet\s?clinic|dog|cat\s?food|kennel)\b/i, weight: 3, subcategory: 'Pet food', scope: 'any' },
     ],
     ```
3. Add a test to `ai/tests/categorise.test.ts`:
   ```ts
   it('suggests Pets for a pet store', () => {
     expect(cat(['HAPPY PAWS PET STORE', 'Dog food 3kg|1200.00', 'Total|1200.00']).value).toBe('Pets');
   });
   ```
4. Run `npm run typecheck && npm test -w @billkit/ai` and `npm run dev`. "Pets" now appears in the review form, the history filter and Settings → budgets, because the UI reads `BUILT_IN_CATEGORIES`.

## What it demonstrates
- One source of truth for categories (`packages/shared`), used by the AI, the API validation and the UI.
- The type system guides the change; a test guards it.
- The statistical categoriser does not know "Pets" yet, so it simply never predicts it (the rules handle it). Retraining is a separate, deliberate step (`TRAINING_GUIDE.md`).

**Alternative exercise (2 minutes):** change the default review threshold from 0.85 to 0.9 in `UserSettingsSchema` (`packages/shared/src/schemas.ts`), run the review UI test, and show that more fields are flagged for new users.

© 2026 Shaik Gouse Kareem. All rights reserved.
