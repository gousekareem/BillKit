/*
 * BillKit — Every bill, in your pocket.
 * © 2026 Shaik Gouse Kareem. All rights reserved.
 *
 * G2 — Image quality assessment with measurable CV metrics.
 * The report produces warnings and retake suggestions; it never rejects a bill
 * by itself. Thresholds are documented in docs/technical/08_image_preprocessing.md
 * and were chosen on synthetic degradations, so they are starting points rather
 * than validated operating points.
 */
import type { QualityIssueCode, QualityReport } from '@billkit/shared';
import { laplacianVariance, toGray } from './image/raster.ts';
import { blockMeans, detectDocument, estimateSkew } from './preprocess.ts';

export const QUALITY_THRESHOLDS = {
  blurWarn: 60,
  blurSevere: 20,
  darkMean: 75,
  overexposedFraction: 0.45,
  glareBlockFraction: 0.02,
  unevenLighting: 0.38,
  lowResolutionShortSide: 700,
  skewInfo: 3,
  lowOcrConfidence: 0.6,
} as const;

type Issue = QualityReport['issues'][number];

const SUGGESTIONS: Record<QualityIssueCode, string> = {
  blurry: 'The image appears blurry. Hold the phone steady, tap to focus and capture it again.',
  too_dark: 'Lighting is insufficient. Move to a brighter place or turn on more light (avoid direct flash).',
  overexposed: 'The image is overexposed. Reduce direct light or move away from the lamp.',
  glare: 'There is glare on the bill. Tilt the bill or phone slightly to avoid reflections.',
  uneven_lighting: 'Shadows are falling on the bill. Make sure your hand or phone is not blocking the light.',
  low_resolution: 'The image resolution is low. Move closer so the bill fills most of the frame.',
  skewed: 'The document appears tilted. It was straightened automatically — check the result.',
  rotated: 'The document appears rotated. It was rotated automatically — check the result.',
  perspective: 'The bill was photographed at an angle. Perspective was corrected automatically.',
  possibly_cropped: 'The image may be cropped. Make sure all four edges of the bill — especially the total — are visible.',
  low_text_readability: 'Some text could not be read confidently. A sharper, brighter photo will improve accuracy.',
  tiny_image: 'The image is very small. Capture or upload a larger image.',
};

export interface QualityInput {
  png: Buffer;
  width: number;
  height: number;
}

export async function assessQuality(input: QualityInput): Promise<QualityReport> {
  const gray = await toGray(input.png, 1000);
  const lapVar = laplacianVariance(gray);
  let sum = 0;
  let over = 0;
  let under = 0;
  for (const v of gray.data) {
    sum += v;
    if (v >= 253) over++;
    if (v <= 40) under++;
  }
  const n = gray.data.length;
  const meanLum = sum / n;
  const overexposedFraction = over / n;
  const underexposedFraction = under / n;

  // Glare: blocks that are almost entirely saturated while the image overall is not.
  const block = 24;
  let glareBlocks = 0;
  let totalBlocks = 0;
  for (let by = 0; by + block <= gray.height; by += block) {
    for (let bx = 0; bx + block <= gray.width; bx += block) {
      totalBlocks++;
      let sat = 0;
      for (let y = by; y < by + block; y += 2) for (let x = bx; x < bx + block; x += 2) if (gray.data[y * gray.width + x]! >= 252) sat++;
      if (sat / ((block / 2) * (block / 2)) > 0.85) glareBlocks++;
    }
  }
  const glareFraction = totalBlocks ? glareBlocks / totalBlocks : 0;
  const small = await toGray(input.png, 600);
  const detection = detectDocument(small);
  const means = blockMeans(gray, 6);
  const lightingUnevenness = means.length ? (Math.max(...means) - Math.min(...means)) / 255 : 0;
  const skew = estimateSkew(await toGray(input.png, 900));

  const issues: Issue[] = [];
  const T = QUALITY_THRESHOLDS;
  if (lapVar < T.blurSevere) issues.push({ code: 'blurry', severity: 'error', message: `Very low sharpness (Laplacian variance ${lapVar.toFixed(0)}).` });
  else if (lapVar < T.blurWarn) issues.push({ code: 'blurry', severity: 'warning', message: `Low sharpness (Laplacian variance ${lapVar.toFixed(0)}).` });
  if (meanLum < T.darkMean) issues.push({ code: 'too_dark', severity: meanLum < 45 ? 'error' : 'warning', message: `Mean brightness ${meanLum.toFixed(0)}/255.` });
  if (overexposedFraction > T.overexposedFraction && (underexposedFraction < 0.004 || meanLum > 250.5)) issues.push({ code: 'overexposed', severity: 'warning', message: `${(overexposedFraction * 100).toFixed(0)}% of pixels are saturated.` });
  else if (glareFraction > T.glareBlockFraction && glareFraction < 0.5) issues.push({ code: 'glare', severity: 'warning', message: `Saturated highlight patches cover ${(glareFraction * 100).toFixed(1)}% of the frame.` });
  if (lightingUnevenness > T.unevenLighting) issues.push({ code: 'uneven_lighting', severity: 'info', message: `Paper brightness varies by ${(lightingUnevenness * 100).toFixed(0)}% across the image.` });
  const shortSide = Math.min(input.width, input.height);
  if (shortSide < 300) issues.push({ code: 'tiny_image', severity: 'error', message: `Short side is ${shortSide}px.` });
  else if (shortSide < T.lowResolutionShortSide) issues.push({ code: 'low_resolution', severity: 'warning', message: `Short side is ${shortSide}px.` });
  if (skew !== null && Math.abs(skew) >= T.skewInfo) issues.push({ code: 'skewed', severity: 'info', message: `Text lines are tilted by about ${Math.abs(skew).toFixed(1)}°.` });
  if (detection.found && detection.perspectiveDistorted && detection.areaFraction < 0.93) issues.push({ code: 'perspective', severity: 'info', message: 'The document outline is not rectangular in the frame.' });
  if (detection.found && detection.touchesBorderSides >= 2 && detection.touchesBorderSides <= 3) {
    issues.push({ code: 'possibly_cropped', severity: 'warning', message: `The document touches ${detection.touchesBorderSides} edges of the frame.` });
  }

  const score = scoreFromIssues(issues);
  return {
    score,
    verdict: verdictFor(score, issues),
    metrics: {
      width: input.width,
      height: input.height,
      megapixels: Math.round(((input.width * input.height) / 1e6) * 100) / 100,
      laplacianVariance: Math.round(lapVar * 10) / 10,
      meanLuminance: Math.round(meanLum * 10) / 10,
      overexposedFraction: round3(overexposedFraction),
      underexposedFraction: round3(underexposedFraction),
      glareFraction: round3(glareFraction),
      lightingUnevenness: round3(lightingUnevenness),
      skewDegrees: skew,
      documentAreaFraction: detection.found ? round3(detection.areaFraction) : null,
      touchesBorderSides: detection.found ? detection.touchesBorderSides : null,
      meanOcrConfidence: null,
    },
    issues,
    retakeSuggestions: suggestionsFor(issues),
  };
}

/** Add the OCR-derived readability signal after OCR has run. */
export function finaliseQuality(report: QualityReport, meanOcrConfidence: number | null, wordCount: number, rotatedDegrees: number): QualityReport {
  const issues = [...report.issues];
  if (rotatedDegrees) issues.push({ code: 'rotated', severity: 'info', message: `The page was rotated ${rotatedDegrees}° to read the text.` });
  if (meanOcrConfidence !== null && wordCount > 0 && meanOcrConfidence < QUALITY_THRESHOLDS.lowOcrConfidence) {
    issues.push({ code: 'low_text_readability', severity: 'warning', message: `Mean OCR word confidence is ${(meanOcrConfidence * 100).toFixed(0)}%.` });
  }
  const score = scoreFromIssues(issues);
  return {
    ...report,
    score,
    verdict: verdictFor(score, issues),
    metrics: { ...report.metrics, meanOcrConfidence: meanOcrConfidence === null ? null : round3(meanOcrConfidence) },
    issues,
    retakeSuggestions: suggestionsFor(issues),
  };
}

function scoreFromIssues(issues: Issue[]): number {
  let score = 100;
  for (const i of issues) score -= i.severity === 'error' ? 35 : i.severity === 'warning' ? 15 : 4;
  return Math.max(0, Math.min(100, score));
}

function verdictFor(score: number, issues: Issue[]): QualityReport['verdict'] {
  if (issues.some((i) => i.code === 'tiny_image') || score < 20) return 'unusable';
  if (score >= 85) return 'good';
  if (score >= 60) return 'acceptable';
  return 'poor';
}

function suggestionsFor(issues: Issue[]): string[] {
  return [...new Set(issues.filter((i) => i.severity !== 'info' || i.code === 'rotated' || i.code === 'perspective').map((i) => SUGGESTIONS[i.code]))];
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}
