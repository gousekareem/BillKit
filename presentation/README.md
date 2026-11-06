# Presentation

- `BillKit_Presentation.pptx`: a 20-slide deck covering the problem, solution, architecture, technology stack, AI/ML pipeline, classification, OCR, extraction, confidence, validation, human review, dataset, training, evaluation, results (**HR results marked PENDING**; synthetic smoke-test numbers labelled as such), failure cases (anticipated, not measured), privacy and security, and future work. It has speaker notes.
- `build_deck.cjs`: the generator (pptxgenjs). Rebuild with `NODE_PATH=$(npm root -g) node presentation/build_deck.cjs` after `npm i -g pptxgenjs`. Update slide 16 after running `npm run eval:hr`.
- `images/`: presentation images rendered from the Mermaid sources in `diagrams/source/`: architecture (D01), AI/ML workflow (D02), bill scanning workflow (D03), dataset lifecycle (D11), training workflow (D12), OCR workflow (D05), human in the loop (D10), database ER (D14), technology stack (D25) and project lifecycle (D24).

© 2026 Shaik Gouse Kareem. All rights reserved.
