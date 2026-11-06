# BillKit diagrams

Editable **Mermaid** sources (`source/*.mmd`, viewable directly on GitHub) and rendered versions in `rendered/svg`, `rendered/png` (2× scale) and `rendered/pdf` (one PDF per diagram, plus `BillKit_all_diagrams.pdf`). Written explanations are in `explanations/`.

Every diagram describes the implemented system; nothing shown is hypothetical unless labelled *optional* (vision model, SMTP) or *not executed* (image-classifier training).

| ID | Diagram | Explanation |
|---|---|---|
| D01 | Overall system architecture | overall_architecture.md |
| D02 | Complete AI/ML architecture | ai_ml_architecture.md |
| D03 | Bill processing flowchart | end_to_end_workflow.md |
| D04 | Bill/non-bill classification | classification.md |
| D05 | OCR architecture | ocr.md |
| D06 | Document understanding | document_understanding.md |
| D07 | Structured extraction | structured_extraction.md |
| D08 | Confidence and uncertainty | confidence_system.md |
| D09 | Validation | validation.md |
| D10 | Human-in-the-loop | human_review.md |
| D11 | Dataset lifecycle | dataset_lifecycle.md |
| D12 | Model training workflow | model_training.md |
| D13 | Model deployment workflow | model_deployment.md |
| D14 | Database ER diagram | database_architecture.md |
| D15 | API architecture | api_architecture.md |
| D16 | Authentication & authorisation (sequence) | security_architecture.md |
| D17 | Sequence: upload & process | end_to_end_workflow.md |
| D18 | Sequence: correct & save | human_review.md |
| D19 | Deployment architecture | overall_architecture.md |
| D20 | Error handling & recovery | end_to_end_workflow.md |
| D21 | Privacy & security architecture | security_architecture.md |
| D22 | Offline architecture | end_to_end_workflow.md |
| D23 | Evaluation architecture | end_to_end_workflow.md |
| D24 | End-to-end project lifecycle | end_to_end_workflow.md |
| D25 | Technology stack | technology_stack.md |
| W01–W14 | Website: architecture, components, navigation, auth flow, user journey, upload, AI integration, review, API communication, backend integration, database interaction, deployment, responsive strategy, security boundaries | see `docs/website_architecture.md` |

## Re-rendering

```bash
npm run diagrams:render            # needs Chrome/Chromium; set CHROME_PATH if not at /usr/bin/google-chrome
```

The renderer is the official `@mermaid-js/mermaid-cli`. It is fetched with `npx`, not installed as a project dependency, so normal installs stay light.

© 2026 Shaik Gouse Kareem. All rights reserved.
