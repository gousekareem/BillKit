# Accessibility

Target: **WCAG 2.2 level AA where practical**. This is not a certification, and no manual audit by an accessibility specialist or testing with assistive-technology users has been done.

Implemented:
- Semantic landmarks (`header`, `nav`, `main`, `footer`), one `h1` per page, logical heading order, and a "Skip to content" link in both layouts.
- Every form control has a visible label. Errors are linked with `aria-describedby` and announced; required fields are marked in text.
- Visible focus rings (`--color-focus`) on every interactive element; full keyboard operation, including the dialogs (focus trap, Esc, focus returned to the trigger) and the page tray (labelled rotate/crop/remove buttons).
- Processing progress and toasts use `aria-live` regions.
- Review states use icon + text, not colour alone. Contrast pairs ≥ 4.5:1.
- Images have alt text. Decorative icons are `aria-hidden`. Charts have an `aria-label` and a visually hidden data table.
- Respects `prefers-reduced-motion` and `prefers-color-scheme`. Text can be zoomed to 200 % without loss (fluid layout).
- Buttons and inputs are at least 44 px high (icon buttons 44 px wide).

**Automated checks** (`website/e2e/a11y.spec.ts`): axe-core with the WCAG 2.0/2.1/2.2 A and AA rule sets on 9 public pages and 6 app pages. The test fails on any *serious* or *critical* violation and passes in the last run. Automated tools find only part of the issues.

**Known gaps**: the image crop tool is pointer-based (there is a numeric/rotate alternative, but no keyboard cropping); not tested with real screen readers (NVDA, VoiceOver, TalkBack).

© 2026 Shaik Gouse Kareem. All rights reserved.
