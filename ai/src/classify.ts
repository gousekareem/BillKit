/*
 * BillKit — Every bill, in your pocket.
 * © 2026 Shaik Gouse Kareem. All rights reserved.
 *
 * G4 — Bill / non-bill classification.
 *
 * Method "billkit-evidence-v1": a transparent, rule-based scorer over OCR text
 * evidence (bill vocabulary, money rows, dates) and image evidence (amount of
 * text, colourfulness, skin-tone pixels, screenshot traits). It is NOT a
 * trained model and its score is NOT a probability. Every decision lists the
 * observable evidence behind it. Detecting a bill-like document does not prove
 * that a transaction happened or that the document is genuine.
 *
 * When a vision-language model is configured, ambiguous cases are resolved
 * with it (see pipeline.ts); a trained image classifier can be plugged in via
 * training/ (see TRAINING_GUIDE.md).
 */
import type { ClassificationResult, DocumentClass } from '@billkit/shared';
import { findDateCandidates } from '@billkit/shared';
import type { ImageMetadata } from './image/decode.ts';
import { toRgb } from './image/raster.ts';
import type { LayoutAnalysis } from './layout.ts';

export const CLASSIFIER_VERSION = 'billkit-evidence-v1';

export interface ImageTraits {
  colourfulness: number;
  skinFraction: number;
  aspectRatio: number;
  screenshotLikely: boolean;
}

/** Hasler & Süsstrunk colourfulness + YCbCr skin-pixel fraction. */
export async function imageTraits(png: Buffer, width: number, height: number, meta: ImageMetadata | undefined): Promise<ImageTraits> {
  const { data } = await toRgb(png, 300);
  let rgSum = 0, ybSum = 0, rgSq = 0, ybSq = 0, skin = 0;
  const n = data.length / 3;
  for (let i = 0; i < data.length; i += 3) {
    const r = data[i]!, g = data[i + 1]!, b = data[i + 2]!;
    const rg = r - g;
    const yb = 0.5 * (r + g) - b;
    rgSum += rg; ybSum += yb; rgSq += rg * rg; ybSq += yb * yb;
    const cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
    const cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;
    if (cb >= 77 && cb <= 127 && cr >= 137 && cr <= 173 && r > 60) skin++;
  }
  const rgMean = rgSum / n, ybMean = ybSum / n;
  const rgStd = Math.sqrt(Math.max(0, rgSq / n - rgMean ** 2));
  const ybStd = Math.sqrt(Math.max(0, ybSq / n - ybMean ** 2));
  const colourfulness = Math.sqrt(rgStd ** 2 + ybStd ** 2) + 0.3 * Math.sqrt(rgMean ** 2 + ybMean ** 2);
  const aspectRatio = Math.max(width, height) / Math.min(width, height);
  const screenshotLikely =
    !!meta && meta.format === 'png' && !meta.hasExif && (aspectRatio > 1.9 || [720, 750, 828, 1080, 1170, 1179, 1242, 1284, 1290, 1440].includes(Math.min(width, height)));
  return { colourfulness, skinFraction: skin / n, aspectRatio, screenshotLikely };
}

const BILL_STRONG = [
  /\bgrand\s?total\b/i, /\bsub\s?-?total\b/i, /\btotal\b/i, /\binvoice\b/i, /\breceipt\b/i, /\bbill\s?(no|number|#|date)\b/i,
  /\bgstin?\b/i, /\bc\.?gst\b/i, /\bs\.?gst\b/i, /\bvat\b/i, /\bamount\s?(payable|due)\b/i, /\bnet\s?(amount|amt|payable)\b/i,
  /\btax\s?invoice\b/i, /\bcash\s?memo\b/i,
];
const BILL_MEDIUM = [
  /\bqty\b|\bquantity\b/i, /\brate\b/i, /\bprice\b/i, /\bamount\b|\bamt\b/i, /\bchange\b/i, /\bcash\b/i, /\bcard\b/i, /\bupi\b/i,
  /\bpaid\b/i, /\bdiscount\b/i, /\bbill\b/i, /\bdue\s?date\b/i, /\bunits?\s?consumed\b/i, /\bconsumer\s?(no|number)\b/i, /\bkwh\b/i,
  /\bitems?\b/i, /\bmrp\b/i, /\btable\s?(no)?\b/i, /\bcashier\b/i,
];
const BILL_WEAK = [/\bthank\s?you\b/i, /\bvisit\s?again\b/i, /\bcustomer\b/i, /\bstore\b/i, /\bph(one)?\b/i];

const NEGATIVE: Record<'id_card' | 'certificate' | 'letter_or_form' | 'chat_or_app_screenshot' | 'newspaper', RegExp[]> = {
  id_card: [
    /\bdate\s?of\s?birth\b|\bd\.?o\.?b\b/i, /\bgovernment\s?of\b/i, /\baadhaar\b|\buidai\b/i, /\bpassport\b/i, /\bdriving\s?licen[cs]e\b/i,
    /\bnationality\b/i, /\bpermanent\s?account\s?number\b/i, /\bincome\s?tax\s?department\b/i, /\bvoter\b|\belection\s?commission\b/i,
    /\bidentity\s?card\b|\bid\s?card\b/i, /\bblood\s?group\b/i, /\bvalid\s?(till|until|upto)\b/i, /\bsex\b|\bgender\b/i, /\bholder'?s?\s?signature\b/i,
  ],
  certificate: [/\bcertificate\b/i, /\bcertif(y|ied)\b/i, /\bawarded\b/i, /\bsuccessfully\s?completed\b/i, /\bin\s?recognition\b/i, /\bpresented\s?to\b/i],
  letter_or_form: [/\bdear\b/i, /\bsincerely\b/i, /\bregards\b/i, /\byours\s?(faithfully|truly)\b/i, /\bsubject\s?:/i, /\bapplication\s?form\b/i, /\bsignature\s?of\b/i, /\bto\s?whom\s?it\s?may\b/i],
  chat_or_app_screenshot: [/\bonline\b/i, /\btyping\b/i, /\blast\s?seen\b/i, /\bdelivered\b/i, /\bmessage\b/i, /\bwhatsapp\b/i, /\breply\b/i, /\bnotifications?\b/i, /\btoday\b/i, /\byesterday\b/i],
  newspaper: [/\breporter\b/i, /\bedition\b/i, /\bcorrespondent\b/i, /\bcontinued\s?on\s?page\b/i, /\bnews\b/i, /\beditorial\b/i],
};

function countHits(text: string, patterns: RegExp[]): string[] {
  const hits: string[] = [];
  for (const p of patterns) {
    const m = p.exec(text);
    if (m) hits.push(m[0]);
  }
  return hits;
}

function billSubtype(text: string, handwrittenLikely: boolean, screenshot: boolean): DocumentClass {
  if (screenshot) return 'bill_screenshot';
  if (handwrittenLikely) return 'handwritten_bill';
  if (/\b(electricity|kwh|units?\s?consumed|consumer\s?(no|number)|meter\s?(no|reading)|water\s?(bill|charges)|gas\s?bill|broadband|billing\s?period|due\s?date|postpaid)\b/i.test(text)) return 'utility_bill';
  if (/\b(restaurant|cafe|caf[eé]|dine|table\s?(no)?|covers?|kot|steward|waiter|service\s?charge|biryani|pizza|burger|coffee|tea|meals?)\b/i.test(text)) return 'restaurant_bill';
  if (/\b(supermarket|hypermarket|mart|grocery|groceries|kirana|provisions|fresh|vegetables?|fruits?|\d+\s?(kg|gm|g|ltr|l)\b)/i.test(text)) return 'grocery_receipt';
  if (/\binvoice\b/i.test(text)) return 'invoice';
  if (/\b(retail|store|apparel|fashion|electronics|mrp)\b/i.test(text)) return 'retail_receipt';
  return 'receipt';
}

export interface ClassifyInput {
  layout: LayoutAnalysis;
  meanOcrConfidence: number | null;
  traits: ImageTraits;
}

export function classifyDocument(input: ClassifyInput): ClassificationResult {
  const { layout, traits } = input;
  const text = layout.rows.map((r) => r.text).join('\n');
  const goodWords = layout.rows.flatMap((r) => r.words).filter((w) => w.confidence >= 0.5 && w.text.length >= 2 && /[a-z0-9]/i.test(w.text));
  const wordCount = goodWords.length;
  const amountRows = layout.rows.filter((r) => r.amounts.length > 0).length;
  const dates = findDateCandidates(text);

  const strong = countHits(text, BILL_STRONG);
  const medium = countHits(text, BILL_MEDIUM);
  const weak = countHits(text, BILL_WEAK);
  const evidence: string[] = [];
  const counter: string[] = [];
  if (strong.length) evidence.push(`Bill vocabulary: ${strong.slice(0, 6).map((s) => `“${s}”`).join(', ')}`);
  if (medium.length) evidence.push(`Supporting terms: ${medium.slice(0, 6).map((s) => `“${s}”`).join(', ')}`);
  if (amountRows) evidence.push(`${amountRows} line(s) end with monetary amounts`);
  if (dates.length) evidence.push(`Date found: “${dates[0]!.raw}”`);

  const vocabScore = Math.min(1, (strong.length * 3 + medium.length * 1.5 + weak.length * 0.5) / 12);
  const amountScore = Math.min(1, amountRows / 5);
  const billEvidence = 0.6 * vocabScore + 0.3 * amountScore + (dates.length ? 0.1 : 0);

  const negScores = Object.entries(NEGATIVE).map(([cls, pats]) => {
    const hits = countHits(text, pats);
    return { cls: cls as keyof typeof NEGATIVE, hits, score: Math.min(1, hits.length * 0.3) };
  });
  // Chat screenshots: many clock times without totals
  const timeTokens = (text.match(/\b\d{1,2}:\d{2}\s?(am|pm)?\b/gi) ?? []).length;
  const chat = negScores.find((n) => n.cls === 'chat_or_app_screenshot')!;
  if (timeTokens >= 3 && strong.length <= 1) {
    chat.score = Math.min(1, chat.score + 0.3);
    chat.hits.push(`${timeTokens} clock times`);
  }
  if (!traits.screenshotLikely) chat.score *= 0.6;
  const news = negScores.find((n) => n.cls === 'newspaper')!;
  if (wordCount > 250 && amountRows < 3) {
    news.score = Math.min(1, news.score + 0.3);
    news.hits.push(`${wordCount} words of running text`);
  }
  const topNeg = negScores.sort((a, b) => b.score - a.score)[0]!;
  for (const n of negScores) if (n.score >= 0.3) counter.push(`${n.cls.replace(/_/g, ' ')} indicators: ${n.hits.slice(0, 4).map((h) => `“${h}”`).join(', ')}`);

  let billScore = Math.max(0, Math.min(1, billEvidence * (1 - 0.75 * topNeg.score)));
  const method = CLASSIFIER_VERSION;

  // Little or no readable text: decide from image traits.
  if (wordCount < 5) {
    let documentClass: DocumentClass = 'unknown';
    let explanation: string;
    if (traits.skinFraction > 0.12 || traits.colourfulness > 45) {
      documentClass = 'selfie_or_photo';
      counter.push(`Very little readable text (${wordCount} words) in a colourful photo${traits.skinFraction > 0.12 ? ' with many skin-tone pixels' : ''}`);
      explanation = 'This looks like a photograph rather than a bill: almost no printed text was found.';
    } else if (traits.colourfulness < 12) {
      documentClass = 'blank_page';
      counter.push(`Almost no text (${wordCount} words) and a uniform image`);
      explanation = 'The page appears blank or unreadable: no printed text was found.';
    } else {
      counter.push(`Only ${wordCount} readable words`);
      explanation = 'Too little readable text to confirm this is a bill. A clearer photo of the full bill may help.';
    }
    return {
      decision: documentClass === 'unknown' ? 'ambiguous' : 'not_bill',
      documentClass,
      billScore: Math.min(billScore, 0.2),
      confidenceKind: 'heuristic',
      evidence,
      counterEvidence: counter,
      method,
      explanation,
    };
  }

  const handwrittenLikely = (input.meanOcrConfidence ?? 1) < 0.55 && amountRows >= 1;
  if (topNeg.score >= 0.6 && strong.length <= 1) billScore = Math.min(billScore, 0.2);

  if (billScore >= 0.5) {
    const documentClass = billSubtype(text, handwrittenLikely, traits.screenshotLikely);
    return {
      decision: 'bill',
      documentClass,
      billScore,
      confidenceKind: 'heuristic',
      evidence,
      counterEvidence: counter,
      method,
      explanation:
        documentClass === 'bill_screenshot'
          ? 'This looks like a screenshot of a bill or digital receipt. It can be processed, but screenshots are easy to edit — keep the original if you need proof of purchase.'
          : `This looks like a ${documentClass.replace(/_/g, ' ')}: ${evidence.slice(0, 2).join('; ')}.`,
    };
  }
  if (billScore <= 0.22) {
    const documentClass: DocumentClass = topNeg.score >= 0.3 ? topNeg.cls : traits.screenshotLikely ? 'chat_or_app_screenshot' : 'other_document';
    const friendly: Record<string, string> = {
      id_card: 'an identity document',
      certificate: 'a certificate',
      letter_or_form: 'a letter or form',
      chat_or_app_screenshot: 'a screenshot of an app or chat',
      newspaper: 'a newspaper or article',
      other_document: 'a document that is not a bill',
    };
    if (documentClass === 'other_document') counter.push('No totals, prices or other bill structure were found');
    return {
      decision: 'not_bill',
      documentClass,
      billScore,
      confidenceKind: 'heuristic',
      evidence,
      counterEvidence: counter,
      method,
      explanation: `This looks like ${friendly[documentClass] ?? 'something other than a bill'}, so it was not processed as an expense.`,
    };
  }
  return {
    decision: 'ambiguous',
    documentClass: 'unknown',
    billScore,
    confidenceKind: 'heuristic',
    evidence,
    counterEvidence: counter,
    method,
    explanation: 'Some bill-like features were found, but not enough to be sure. Confirm that this is a bill, or upload a clearer photo.',
  };
}
