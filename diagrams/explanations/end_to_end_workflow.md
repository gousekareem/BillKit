# End To End Workflow

**Diagrams:** D03, D17, D18, D20, D22, D23, D24 (`diagrams/source/*.mmd`, rendered in `diagrams/rendered/`)

A user captures a bill → the browser validates type and size and uploads with progress → the API stores the original and queues it → the pipeline runs and reports real stages → a non-bill is politely rejected (the user may override), an ambiguous image asks for confirmation, a bill goes to review → the user corrects or confirms flagged fields → the server re-validates, warns about duplicates and saves with provenance → the bill appears in history and analytics.

**Failures** (D20): invalid uploads get 4xx messages; VLM errors are retried with backoff (429/5xx/network/timeouts) and then fall back to OCR results with a notice; auth or schema errors are not retried; interrupted jobs are failed on restart and queued jobs are re-queued; saves are transactional. **Offline** (D22): the app shell and previously viewed data work offline; scanning needs the server. **Evaluation** (D23) and the **project lifecycle** (D24) close the loop through reviewed corrections and measured results.

---
© 2026 Shaik Gouse Kareem. All rights reserved.
