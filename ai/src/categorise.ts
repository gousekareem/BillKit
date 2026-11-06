/*
 * BillKit — Every bill, in your pocket.
 * © 2026 Shaik Gouse Kareem. All rights reserved.
 *
 * G8 — Expense categorisation: a hybrid of
 *   (1) merchant / item / context keyword rules (always available),
 *   (2) an optional statistical model (TF-IDF + logistic regression) exported
 *       by training/categorisation and registered in ai/models/,
 *   (3) an optional category suggested by the vision-language model.
 * The categoriser abstains ("Unknown") when evidence is weak instead of forcing
 * a category. User corrections are stored for review; they do NOT retrain any
 * model automatically.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { BuiltInCategory, CategorySuggestion } from '@billkit/shared';
import { BUILT_IN_CATEGORIES, SUBCATEGORIES, isBuiltInCategory } from '@billkit/shared';
import type { LayoutAnalysis } from './layout.ts';
import { CATEGORY_RULES, KNOWN_MERCHANTS } from './lexicon.ts';

export const CATEGORISER_VERSION = 'billkit-categoriser-v1';
const ABSTAIN_SCORE = 2.5;

/* ---------------- Statistical model (exported from Python) ---------------- */

export interface ExportedTfidfModel {
  format: 'billkit-tfidf-logreg/1';
  version: string;
  classes: string[];
  vocabulary: Record<string, number>;
  idf: number[];
  coef: number[][];
  intercept: number[];
  ngramRange: [number, number];
  analyzer: 'word' | 'char_wb';
  lowercase: boolean;
  trainedOn: string;
}

let cachedModel: ExportedTfidfModel | null | undefined;

export function modelsDir(): string {
  return process.env.BILLKIT_MODELS_DIR || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'models');
}

export function loadCategoriserModel(): ExportedTfidfModel | null {
  if (cachedModel !== undefined) return cachedModel;
  try {
    const registry = JSON.parse(fs.readFileSync(path.join(modelsDir(), 'registry.json'), 'utf8')) as { active?: { categoriser?: string } };
    const file = registry.active?.categoriser;
    if (!file) return (cachedModel = null);
    const model = JSON.parse(fs.readFileSync(path.join(modelsDir(), file), 'utf8')) as ExportedTfidfModel;
    if (model.format !== 'billkit-tfidf-logreg/1') return (cachedModel = null);
    cachedModel = model;
  } catch {
    cachedModel = null;
  }
  return cachedModel;
}

export function resetCategoriserModelCache(): void {
  cachedModel = undefined;
}

function tokens(text: string, model: ExportedTfidfModel): string[] {
  const t = model.lowercase ? text.toLowerCase() : text;
  const [lo, hi] = model.ngramRange;
  const out: string[] = [];
  if (model.analyzer === 'word') {
    const words = t.match(/\b\w\w+\b/gu) ?? [];
    for (let n = lo; n <= hi; n++) for (let i = 0; i + n <= words.length; i++) out.push(words.slice(i, i + n).join(' '));
  } else {
    for (const w of t.split(/\s+/).filter(Boolean)) {
      const padded = ` ${w} `;
      for (let n = lo; n <= hi; n++) for (let i = 0; i + n <= padded.length; i++) out.push(padded.slice(i, i + n));
    }
  }
  return out;
}

/** Softmax probabilities from the exported TF-IDF + logistic-regression model (matches scikit-learn's l2-normalised TF-IDF). */
export function predictWithModel(model: ExportedTfidfModel, text: string): Record<string, number> {
  const counts = new Map<number, number>();
  for (const tok of tokens(text, model)) {
    const idx = model.vocabulary[tok];
    if (idx !== undefined) counts.set(idx, (counts.get(idx) ?? 0) + 1);
  }
  const vec = new Map<number, number>();
  let norm = 0;
  for (const [i, c] of counts) {
    const v = c * (model.idf[i] ?? 1);
    vec.set(i, v);
    norm += v * v;
  }
  norm = Math.sqrt(norm) || 1;
  const logits = model.classes.map((_, k) => {
    let z = model.intercept[k] ?? 0;
    for (const [i, v] of vec) z += (model.coef[k]?.[i] ?? 0) * (v / norm);
    return z;
  });
  if (model.classes.length === 2) {
    // scikit-learn binary: a single coefficient row for the positive class
    const p = 1 / (1 + Math.exp(-(logits[0] ?? 0)));
    return { [model.classes[1]!]: p, [model.classes[0]!]: 1 - p };
  }
  const max = Math.max(...logits);
  const exps = logits.map((z) => Math.exp(z - max));
  const sum = exps.reduce((a, b) => a + b, 0);
  return Object.fromEntries(model.classes.map((c, k) => [c, exps[k]! / sum]));
}

/* ---------------- Hybrid categoriser ---------------- */

export interface CategoriseInput {
  layout: LayoutAnalysis;
  merchantName: string | null;
  vlmCategory?: { category: string | null; confidence: number | null } | null;
  customCategories?: string[];
  useStatisticalModel?: boolean;
}

export function categorise(input: CategoriseInput): CategorySuggestion {
  const { layout } = input;
  const scores: Record<string, number> = Object.fromEntries(BUILT_IN_CATEGORIES.map((c) => [c, 0]));
  const subScores: Record<string, Record<string, number>> = {};
  const reasons: Record<string, string[]> = {};
  const add = (cat: string, w: number, reason: string, sub?: string | null) => {
    scores[cat] = (scores[cat] ?? 0) + w;
    (reasons[cat] ??= []).push(reason);
    if (sub) {
      subScores[cat] ??= {};
      subScores[cat][sub] = (subScores[cat][sub] ?? 0) + w;
    }
  };

  const headerText = [input.merchantName ?? '', ...layout.rows.filter((r) => r.region === 'header').map((r) => r.text)].join(' \n ');
  const itemTexts = layout.itemRows.map((i) => layout.rows[i]!.text);
  const fullText = layout.rows.map((r) => r.text).join(' \n ');

  for (const m of KNOWN_MERCHANTS) {
    if (new RegExp(`\\b${m.pattern}\\b`, 'i').test(headerText)) add(m.category, 5, `Recognised merchant “${m.name}”`, m.subcategory);
  }
  for (const [cat, rules] of Object.entries(CATEGORY_RULES)) {
    for (const rule of rules) {
      if (rule.scope === 'merchant') {
        const m = rule.re.exec(headerText);
        if (m) add(cat, rule.weight, `Merchant/header mentions “${m[0]}”`, rule.subcategory);
      } else if (rule.scope === 'any') {
        const m = rule.re.exec(fullText);
        if (m) add(cat, rule.weight, `Bill mentions “${m[0]}”`, rule.subcategory);
      } else {
        const matched = itemTexts.map((t) => rule.re.exec(t)?.[0]).filter((x): x is string => Boolean(x));
        if (matched.length) {
          const w = rule.weight * Math.min(4, matched.length);
          add(cat, w, `${matched.length} item line(s) look like ${cat.toLowerCase()}: ${[...new Set(matched)].slice(0, 4).join(', ')}`, rule.subcategory);
        }
      }
    }
  }

  let source: CategorySuggestion['source'] = 'rules';
  if (input.useStatisticalModel !== false) {
    const model = loadCategoriserModel();
    if (model) {
      const probs = predictWithModel(model, `${input.merchantName ?? ''} ${itemTexts.join(' ')}`.trim() || fullText.slice(0, 500));
      const [bestCat, bestP] = Object.entries(probs).sort((a, b) => b[1] - a[1])[0] ?? [null, 0];
      if (bestCat && bestP >= 0.5 && isBuiltInCategory(bestCat)) {
        add(bestCat, 3 * bestP, `Statistical model ${model.version} suggests ${bestCat} (model score ${bestP.toFixed(2)}, uncalibrated)`);
        source = 'combined';
      }
    }
  }
  if (input.vlmCategory?.category) {
    const c = input.vlmCategory.category;
    const target = isBuiltInCategory(c) ? c : input.customCategories?.includes(c) ? c : null;
    if (target) {
      add(target, 3, `Vision model suggests ${target}`);
      source = 'combined';
    }
  }

  const ranked = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const [topCat, topScore] = ranked[0]!;
  const second = ranked[1]?.[1] ?? 0;
  if (topScore < ABSTAIN_SCORE) {
    return {
      value: null,
      subcategory: null,
      confidence: null,
      confidenceKind: 'none',
      review: 'missing',
      status: 'unknown',
      reasons: topScore > 0 ? [`Weak evidence only (${(reasons[topCat] ?? []).join('; ')}). Please choose a category.`] : ['No category evidence was found on the bill. Please choose a category.'],
      source: 'none',
      scores: roundScores(scores),
    };
  }
  // Heuristic confidence: share of evidence with a margin term; not a probability.
  const confidence = Math.max(0, Math.min(0.97, 0.5 * (topScore / (topScore + second + 1)) + 0.5 * Math.min(1, (topScore - second) / 6)));
  const subs = subScores[topCat];
  const subcategory = subs ? Object.entries(subs).sort((a, b) => b[1] - a[1])[0]![0] : null;
  const validSub = subcategory && (SUBCATEGORIES[topCat as BuiltInCategory] ?? []).includes(subcategory) ? subcategory : null;
  return {
    value: topCat,
    subcategory: validSub,
    confidence: Math.round(confidence * 100) / 100,
    confidenceKind: 'heuristic',
    review: 'needs_review',
    status: 'suggested',
    reasons: reasons[topCat] ?? [],
    source,
    scores: roundScores(scores),
  };
}

function roundScores(s: Record<string, number>): Record<string, number> {
  return Object.fromEntries(Object.entries(s).filter(([, v]) => v > 0).map(([k, v]) => [k, Math.round(v * 100) / 100]));
}
