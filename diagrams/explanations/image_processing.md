# Image Processing

**Diagrams:** D02 (G1–G3), D05 (`diagrams/source/*.mmd`, rendered in `diagrams/rendered/`)

**Quality metrics** (`ai/src/quality.ts`): variance of the 4-neighbour Laplacian on a 1000-px greyscale copy (blur; warn < 60, severe < 20), mean luminance (dark < 75), saturated-pixel fraction combined with an absence of dark pixels (overexposure), fraction of almost fully saturated 24-px blocks (glare), range of per-block 80th-percentile brightness (uneven lighting), short side in pixels (resolution), projection-profile skew, and document-mask border contact (possible cropping). Thresholds were chosen on synthetic degradations and are starting points, not validated operating points.

**Preprocessing** (`ai/src/preprocess.ts`): images are limited to 2400 px; an Otsu threshold on a blurred 600-px copy finds the largest bright component; its extreme points give a quadrilateral. If it covers < 93% of the frame, is rectangular (> 0.85) and touches ≤ 1 border, a four-point homography warps it upright. Residual skew is estimated by maximising row-profile variance over ±8° and corrected if ≥ 0.5°. If paper brightness varies by > 35%, the image is divided by a dilated, heavily blurred background estimate (shadow removal). Finally greyscale, 1–99% contrast stretch and mild sharpening; narrow images are upscaled with Lanczos. The original upload is always kept unchanged (subject to the user's retention setting).

---
© 2026 Shaik Gouse Kareem. All rights reserved.
