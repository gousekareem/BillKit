# 8. Image quality and preprocessing

## Quality assessment (`ai/src/quality.ts`)

Measured on a greyscale copy of the image:

| Metric | How | Threshold (issue) |
|---|---|---|
| Sharpness | Variance of the Laplacian | < 60 warning, < 20 severe (`blurry`) |
| Brightness | Mean luminance | < 75 `too_dark` (< 45 is an error) |
| Over-exposure | Fraction of saturated pixels | > 45 % *and* hardly any dark pixels → `overexposed` |
| Glare | 24-px blocks that are > 85 % saturated | > 2 % of blocks → `glare` |
| Uneven lighting | Spread of 8×8 block means | > 0.38 → `uneven_lighting` |
| Resolution | Short side | < 700 px warning; < 300 px `tiny_image` (error) |
| Skew / perspective / cut-off | From document detection | informational |
| Readability | Mean OCR confidence (after OCR) | < 0.6 → `low_ocr_confidence` |

Score = 100 − 35 per error − 15 per warning − 4 per info. Verdicts: ≥ 85 good, ≥ 60 acceptable, < 60 poor, < 20 or tiny → unusable. Each issue has a plain-language retake tip. **Quality never rejects a bill by itself**: the user decides. The thresholds were set on synthetic degradations, so they are starting points, not validated operating points.

## Preprocessing (`ai/src/preprocess.ts`)

Each step runs only when its own check says it will help, and the original upload is never changed.

1. **Size limit.** Work on at most 2400 px on the long side, which bounds memory and time.
2. **Document detection.** Otsu threshold on a 600-px greyscale copy → the largest bright connected component → its convex quadrilateral (corner extremes). The result also reports area fraction, rectangularity, how many frame borders it touches and whether it is distorted.
3. **Perspective correction.** Only when the quad is convincing: it covers less than 93 % of the frame, rectangularity > 0.85, it touches at most one border, and it is not disabled by the user. A 4-point homography is solved (DLT, 8×8 linear system) and the image is inverse-warped with bilinear sampling.
4. **Deskew.** Projection-profile search over ±8°: the angle at which row sums have the highest variance (text lines line up). Applied when |angle| ≥ 0.5°.
5. **Illumination flattening.** When the 8×8 block means differ by more than 0.35, estimate the background with a 3×3 max filter (to remove thin text) and two box blurs, then divide by it (`pixel / background × 235`). This removes shadows and gradients.
6. **OCR enhancement.** Greyscale, contrast stretch (1st–99th percentile), mild sharpen (σ 0.8), and Lanczos upscaling to at most 1800 px when the page is narrower than 1100 px.

The steps applied are listed in `meta.preprocessing` and shown in the app.

© 2026 Shaik Gouse Kareem. All rights reserved.
